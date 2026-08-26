import "server-only"

import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { referrals, users } from "@/lib/db/schema"
import { botUsername, telegramCall } from "@/lib/giveaways"

export const FREE_CASE_REQUIRED_REFERRALS = 3

export type FreeCaseClaimStatus = {
  qualified: number
  required: number
  ready: boolean
  inviteUrl: string
}

type TelegramOwnedGifts = { total_count?: number; gifts?: unknown[] }

async function hasTelegramNftGift(userId: string): Promise<boolean> {
  const numericUserId = Number(userId)
  if (!Number.isSafeInteger(numericUserId) || numericUserId <= 0) return false
  try {
    const response = await telegramCall<TelegramOwnedGifts>("getUserGifts", {
      user_id: numericUserId,
      exclude_unlimited: true,
      exclude_limited_upgradable: false,
      exclude_limited_non_upgradable: false,
      exclude_from_blockchain: false,
      exclude_unique: false,
      offset: "",
      limit: 1,
    })
    if (!response.ok || !response.result) return false
    return Number(response.result.total_count ?? response.result.gifts?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function refreshQualifiedReferrals(inviterUserId: string): Promise<void> {
  const candidates = await db
    .select({ referralId: referrals.id, referredUserId: referrals.referredUserId })
    .from(referrals)
    .innerJoin(users, eq(users.id, referrals.referredUserId))
    .where(and(
      eq(referrals.inviterUserId, inviterUserId),
      eq(users.isPremium, true),
      isNull(referrals.qualifiedAt),
    ))

  await Promise.all(candidates.map(async (candidate) => {
    if (!(await hasTelegramNftGift(candidate.referredUserId))) return
    await db.update(referrals).set({ qualifiedAt: new Date() }).where(and(
      eq(referrals.id, candidate.referralId),
      eq(referrals.inviterUserId, inviterUserId),
    ))
  }))
}

export async function getFreeCaseClaimStatus(userId: string, refresh = true): Promise<FreeCaseClaimStatus> {
  const existingQualified = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.inviterUserId, userId), isNotNull(referrals.qualifiedAt)))
  if (refresh && existingQualified.length < FREE_CASE_REQUIRED_REFERRALS) await refreshQualifiedReferrals(userId)

  const qualifiedRows = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.inviterUserId, userId), isNotNull(referrals.qualifiedAt)))
  const qualified = Math.min(FREE_CASE_REQUIRED_REFERRALS, qualifiedRows.length)
  return {
    qualified,
    required: FREE_CASE_REQUIRED_REFERRALS,
    ready: qualified >= FREE_CASE_REQUIRED_REFERRALS,
    inviteUrl: `https://t.me/${botUsername()}?startapp=ref_${userId}`,
  }
}

export function assertFreeCaseGiftUnlocked(source: string, ready: boolean): void {
  if (source === "free-case" && !ready) throw new Error("FREE_CASE_REFERRALS_REQUIRED")
}
