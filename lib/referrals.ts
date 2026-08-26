import "server-only"

import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { referralCommissions, referrals, transactions, users } from "@/lib/db/schema"
import { botUsername } from "@/lib/giveaways"
import { notifyUser } from "@/lib/telegram-gifts"

export const REFERRAL_COMMISSION_RATE = 0.1

export async function awardReferralCommission(referredUserId: string, depositTransactionId: number, creditedStars: number) {
  const amount = Math.round(creditedStars * REFERRAL_COMMISSION_RATE * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) return false

  const credited = await db.transaction(async (tx) => {
    const referral = (await tx.select().from(referrals).where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.program, "commission"))).limit(1))[0]
    if (!referral || referral.inviterUserId === referredUserId) return null

    const inserted = await tx.insert(referralCommissions).values({
      referralId: referral.id,
      depositTransactionId,
      amount: amount.toFixed(2),
    }).onConflictDoNothing().returning({ id: referralCommissions.id })
    if (!inserted[0]) return null

    await tx.update(users).set({ balance: sql`${users.balance} + ${amount}` }).where(eq(users.id, referral.inviterUserId))
    await tx.insert(transactions).values({
      userId: referral.inviterUserId,
      type: "referral_commission",
      currency: "stars",
      amount: amount.toFixed(2),
      credited: amount.toFixed(2),
      status: "completed",
      externalId: `referral:${depositTransactionId}`,
      meta: { referredUserId, depositTransactionId, rate: REFERRAL_COMMISSION_RATE },
    })
    return { inviterUserId: referral.inviterUserId, amount }
  })
  if (!credited) return false
  await notifyUser(credited.inviterUserId, `🤝 Реферальний бонус зараховано!\n\n⭐ <b>+${credited.amount.toLocaleString("en-US")}</b> Stars — 10% від підтвердженого депозиту твого реферала.`)
  return true
}

export async function getReferralDashboard(userId: string) {
  const invited = await db.select({ id: referrals.id }).from(referrals).where(and(eq(referrals.inviterUserId, userId), eq(referrals.program, "commission")))
  const earnings = await db.select({ total: sql<string>`coalesce(sum(${referralCommissions.amount}), 0)` })
    .from(referralCommissions)
    .innerJoin(referrals, eq(referralCommissions.referralId, referrals.id))
    .where(and(eq(referrals.inviterUserId, userId), eq(referrals.program, "commission")))
  return {
    invited: invited.length,
    earned: Number(earnings[0]?.total ?? 0),
    ratePercent: REFERRAL_COMMISSION_RATE * 100,
    inviteUrl: `https://t.me/${botUsername()}?startapp=refer_${userId}`,
  }
}
