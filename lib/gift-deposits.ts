import "server-only"

import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { gifts, inventory, transactions, users } from "@/lib/db/schema"
import {
  configuredRelayerUserId,
  getRelayerDepositEvents,
  notifyUser,
  relayerBotConfigured,
  relayerUsername,
  type RelayerDepositEvent,
} from "@/lib/telegram-gifts"

type DepositTransaction = typeof transactions.$inferSelect

function normalized(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function eventMatchesGiftAndTime(event: RelayerDepositEvent, tx: DepositTransaction): boolean {
  // Ignore older profile gifts; a transfer must happen after this intent was made.
  if (event.sendDate * 1000 < tx.createdAt.getTime() - 120_000) return false
  const meta = (tx.meta as Record<string, unknown> | null) ?? {}
  const wantedName = normalized(meta.giftName)
  const wantedSlug = normalized(meta.giftSlug)
  const actualName = normalized(event.giftName)
  const actualSlug = normalized(event.giftSlug)
  return Boolean(
    (wantedName && actualName && wantedName === actualName) ||
    (wantedSlug && actualSlug && (actualSlug === wantedSlug || actualSlug.startsWith(wantedSlug))),
  )
}

/** Resolve the normal relayer account. The env ID is preferred; as a fallback,
 * opening PugGift once from @pugsrelayer records its Telegram ID in users. */
export async function resolveRelayerUserId(): Promise<number | null> {
  const configured = configuredRelayerUserId()
  if (configured) return configured
  const username = relayerUsername()
  if (!username) return null
  const row = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1)
  )[0]
  const value = Number(row?.id)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export async function personalGiftRelayerReady(): Promise<boolean> {
  return relayerBotConfigured() && Boolean(await resolveRelayerUserId())
}

/** Credit exactly one detected gift. The fingerprint advisory lock and JSON
 * check make repeated cron/client polls idempotent. */
export async function creditGiftDeposit(tx: DepositTransaction, event?: RelayerDepositEvent): Promise<boolean> {
  const meta = (tx.meta as Record<string, unknown> | null) ?? {}
  const completed = await db.transaction(async (t) => {
    if (event) {
      await t.execute(sql`select pg_advisory_xact_lock(hashtext(${event.fingerprint}))`)
      const used = await t
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, "gift_deposit"),
            eq(transactions.status, "completed"),
            sql`${transactions.meta}->>'relayerFingerprint' = ${event.fingerprint}`,
          ),
        )
        .limit(1)
      if (used.length) return false
    }

    const claimed = await t
      .update(transactions)
      .set({ status: "processing" })
      .where(and(eq(transactions.id, tx.id), eq(transactions.status, "pending")))
      .returning({ id: transactions.id })
    if (!claimed.length) return false

    await t.insert(inventory).values({
      userId: tx.userId,
      giftId: Number(meta.giftId),
      value: String(Number(tx.credited)),
      status: "owned",
      source: "deposit",
    })
    await t
      .update(transactions)
      .set({
        status: "completed",
        meta: event
          ? {
              ...meta,
              relayerFingerprint: event.fingerprint,
              relayerGiftSlug: event.giftSlug,
              relayerSendDate: event.sendDate,
            }
          : meta,
      })
      .where(eq(transactions.id, tx.id))
    return true
  })

  if (completed) {
    await notifyUser(
      tx.userId,
      `✅ Поповнення зараховано!\n\n🎁 <b>${String(meta.giftName ?? "Telegram Gift")}</b>\n⭐ Вартість: <b>${Number(tx.credited).toLocaleString("en-US")}</b> Stars\n\nПодарунок уже у твоєму інвентарі PugGift.`,
    )
  }
  return completed
}

export async function processPersonalGiftDeposits(options?: {
  transactionId?: number
  userId?: string
}): Promise<{ configured: boolean; scanned: number; credited: number }> {
  if (!relayerBotConfigured()) return { configured: false, scanned: 0, credited: 0 }
  const relayerUserId = await resolveRelayerUserId()
  if (!relayerUserId) return { configured: false, scanned: 0, credited: 0 }

  const conditions = [eq(transactions.type, "gift_deposit"), eq(transactions.status, "pending")]
  if (options?.transactionId != null) conditions.push(eq(transactions.id, options.transactionId))
  if (options?.userId) conditions.push(eq(transactions.userId, options.userId))
  const pending = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(asc(transactions.createdAt))
    .limit(100)
  if (!pending.length) return { configured: true, scanned: 0, credited: 0 }

  const events = await getRelayerDepositEvents(relayerUserId)
  const available = [...pending]
  const claimedEvents = new Set<string>()
  let credited = 0
  for (const event of events) {
    if (claimedEvents.has(event.fingerprint)) continue
    const candidates = available.filter((tx) => {
      if (!eventMatchesGiftAndTime(event, tx)) return false
      return event.senderUserId ? event.senderUserId === tx.userId : true
    })
    // Private Telegram gifts omit sender_user. They can still be credited
    // without a code when exactly one pending intent matches the gift/time.
    // Ambiguous transfers are intentionally left pending instead of crediting
    // the wrong player.
    if (candidates.length !== 1) continue
    const tx = candidates[0]
    if (await creditGiftDeposit(tx, event)) {
      claimedEvents.add(event.fingerprint)
      available.splice(available.findIndex((candidate) => candidate.id === tx.id), 1)
      credited++
    }
  }
  return { configured: true, scanned: events.length, credited }
}
