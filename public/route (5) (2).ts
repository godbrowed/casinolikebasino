"use server"

import { and, eq, isNull, lt, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { levelProgress } from "@/lib/level"
import { DAILY_REWARDS, type RewardState } from "@/lib/rewards-shared"
import { isDailyChannelMember } from "@/lib/telegram-membership"

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function dayDiff(a: Date, b: Date) {
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  const db2 = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  return Math.round((da - db2) / 86400000)
}

export async function getRewardState(): Promise<RewardState> {
  const userId = await requireUserId()
  const u = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!u) throw new Error("Unauthorized")

  const now = new Date()
  const last = u.lastDailyClaim ? new Date(u.lastDailyClaim) : null
  let streak = u.dailyStreak
  let canClaim = true
  if (last) {
    if (sameDay(last, now)) canClaim = false
    else if (dayDiff(now, last) > 1) streak = 0 // broke the streak
  } else {
    streak = 0
  }

  const nextIndex = streak % DAILY_REWARDS.length
  const xp = Number(u.xp)
  const prog = levelProgress(xp)

  return {
    canClaim,
    streak,
    nextIndex,
    rewards: DAILY_REWARDS,
    level: prog.level,
    xp,
    levelPct: prog.pct,
    toNext: prog.toNext,
  }
}

export async function claimDaily(): Promise<{ reward: number; streak: number; balance: number }> {
  const userId = await requireUserId()
  const subscribed = await isDailyChannelMember(userId)
  if (!subscribed) throw new Error("SUBSCRIPTION_REQUIRED")

  return db.transaction(async (tx) => {
    const u = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!u) throw new Error("Unauthorized")

    const now = new Date()
    const last = u.lastDailyClaim ? new Date(u.lastDailyClaim) : null
    if (last && sameDay(last, now)) throw new Error("ALREADY_CLAIMED")

    let streak = u.dailyStreak
    if (!last || dayDiff(now, last) > 1) streak = 0
    const index = streak % DAILY_REWARDS.length
    const reward = DAILY_REWARDS[index]
    const newStreak = streak + 1

    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const updated = await tx
      .update(users)
      .set({
        balance: sql`${users.balance} + ${reward}`,
        dailyStreak: newStreak,
        lastDailyClaim: now,
        xp: sql`${users.xp} + ${reward}`,
      })
      .where(
        and(
          eq(users.id, userId),
          or(isNull(users.lastDailyClaim), lt(users.lastDailyClaim, startOfToday)),
        ),
      )
      .returning({ balance: users.balance })

    if (updated.length === 0) throw new Error("ALREADY_CLAIMED")
    revalidatePath("/")
    return { reward, streak: newStreak, balance: Number(updated[0].balance) }
  })
}
