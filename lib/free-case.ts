import "server-only"

import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { freeCaseProgress } from "@/lib/db/schema"
import { botUsername, telegramCall } from "@/lib/giveaways"

export const FREE_CASE_CHANNEL = "PugGift"
export const FREE_CASE_CHANNEL_URL = `https://t.me/${FREE_CASE_CHANNEL}`
export const FREE_CASE_TRADE_URL = "https://t.me/GorillaCaseBot/app?startapp=r_1708543238"
// Telegram confirms one prepared-message share operation, not the number of
// recipients selected in its native share sheet. Requiring one confirmed send
// makes this task reliable on both iOS and Android.
export const FREE_CASE_REQUIRED_SHARES = 1

const MEMBER_STATUSES = new Set(["member", "administrator", "creator"])

export type FreeCaseRequirements = {
  shares: number
  requiredShares: number
  subscribed: boolean
  channelCheckAvailable: boolean
  tradeVisited: boolean
  ready: boolean
  channelUrl: string
  tradeUrl: string
}

async function progressFor(userId: string) {
  return (await db.select().from(freeCaseProgress).where(eq(freeCaseProgress.userId, userId)).limit(1))[0]
}

async function channelState(userId: string): Promise<{ subscribed: boolean; available: boolean }> {
  const telegramUserId = Number(userId)
  if (!Number.isSafeInteger(telegramUserId)) return { subscribed: false, available: false }
  const result = await telegramCall<{ status?: string; is_member?: boolean }>("getChatMember", {
    chat_id: `@${FREE_CASE_CHANNEL}`,
    user_id: telegramUserId,
  })
  if (!result.ok || !result.result) return { subscribed: false, available: false }
  const status = result.result.status || ""
  return {
    subscribed: MEMBER_STATUSES.has(status) || (status === "restricted" && result.result.is_member === true),
    available: true,
  }
}

export async function freeCaseRequirements(userId: string): Promise<FreeCaseRequirements> {
  const [progress, membership] = await Promise.all([progressFor(userId), channelState(userId)])
  const shares = Math.min(FREE_CASE_REQUIRED_SHARES, progress?.shareCount ?? 0)
  const subscribed = membership.subscribed
  return {
    shares,
    requiredShares: FREE_CASE_REQUIRED_SHARES,
    subscribed,
    channelCheckAvailable: membership.available,
    tradeVisited: Boolean(progress?.tradeVisitedAt),
    ready: shares >= FREE_CASE_REQUIRED_SHARES && subscribed,
    channelUrl: FREE_CASE_CHANNEL_URL,
    tradeUrl: FREE_CASE_TRADE_URL,
  }
}

export async function recordFreeCaseShare(userId: string): Promise<void> {
  await db.insert(freeCaseProgress).values({ userId, shareCount: 1 }).onConflictDoUpdate({
    target: freeCaseProgress.userId,
    set: {
      shareCount: sql`least(${freeCaseProgress.shareCount} + 1, ${FREE_CASE_REQUIRED_SHARES})`,
      updatedAt: new Date(),
    },
  })
}

export async function recordTradeVisit(userId: string): Promise<void> {
  const now = new Date()
  await db.insert(freeCaseProgress).values({ userId, tradeVisitedAt: now, updatedAt: now }).onConflictDoUpdate({
    target: freeCaseProgress.userId,
    set: { tradeVisitedAt: now, updatedAt: now },
  })
}

export async function resetFreeCaseProgress(userId: string): Promise<void> {
  await db.insert(freeCaseProgress).values({ userId }).onConflictDoUpdate({
    target: freeCaseProgress.userId,
    set: { shareCount: 0, tradeVisitedAt: null, updatedAt: new Date() },
  })
}

export async function prepareFreeCaseShare(userId: string): Promise<string> {
  const telegramUserId = Number(userId)
  if (!Number.isSafeInteger(telegramUserId)) throw new Error("TELEGRAM_REQUIRED")
  const username = botUsername()
  const result = await telegramCall<{ id?: string }>("savePreparedInlineMessage", {
    user_id: telegramUserId,
    result: {
      type: "article",
      id: `puggift-free-${Date.now()}`,
      title: "Open a free PugGift case",
      description: "Complete the tasks and spin for a Telegram NFT gift",
      input_message_content: {
        message_text: "🎁 Open a free PugGift case and try to catch a Telegram NFT gift!",
      },
      reply_markup: {
        inline_keyboard: [[{ text: "Open free case", url: `https://t.me/${username}?startapp=freecase` }]],
      },
    },
    allow_user_chats: true,
    allow_group_chats: true,
    allow_bot_chats: false,
    allow_channel_chats: false,
  })
  if (!result.ok || !result.result?.id) throw new Error(result.description || "SHARE_UNAVAILABLE")
  return result.result.id
}
