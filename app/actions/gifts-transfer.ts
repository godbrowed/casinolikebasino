"use server"

import crypto from "crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { gifts, inventory, transactions, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { relayerUsername } from "@/lib/telegram-gifts"
import { giftValueInStars } from "@/lib/pricing"
import { personalGiftRelayerReady, processPersonalGiftDeposits } from "@/lib/gift-deposits"
import { assertFreeCaseGiftUnlocked, getFreeCaseClaimStatus } from "@/lib/free-case-referrals"
import { freeCaseRequirements, resetFreeCaseProgress } from "@/lib/free-case"
import { notifyAdmins } from "@/lib/admin-notify"

export type DepositGift = {
  slug: string
  name: string
  rarity: string
  imageUrl: string
  value: number
}

/** Gift catalog the user can deposit (real Telegram collectible gifts). */
export async function getDepositGiftCatalog(): Promise<DepositGift[]> {
  const rows = await db
    .select({
      slug: gifts.slug,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      value: gifts.value,
      floorTon: gifts.floorTon,
    })
    .from(gifts)
    .orderBy(desc(gifts.value))
  return rows.map(({ floorTon, ...r }) => ({ ...r, value: giftValueInStars(r.value, floorTon) }))
}

export type RelayerInfo = {
  username: string | null
  url: string
  automated: boolean
}

/** Public info the deposit UI needs to instruct the user where to send a gift. */
export async function getRelayerInfo(): Promise<RelayerInfo> {
  const username = relayerUsername() ?? "pugsrelayer"
  return {
    username,
    url: `https://t.me/${username}`,
    automated: await personalGiftRelayerReady(),
  }
}

/**
 * Create a pending NFT gift deposit. The sender's Telegram ID, gift name and
 * transfer time are matched automatically; no user-visible comment code exists.
 */
export async function createGiftDepositIntent(giftSlug: string): Promise<{
  transactionId: number
  relayerUsername: string | null
  relayerUrl: string
  automated: boolean
  giftName: string
  value: number
}> {
  const userId = await requireUserId()
  const gift = (await db.select().from(gifts).where(eq(gifts.slug, giftSlug)).limit(1))[0]
  if (!gift) throw new Error("Unknown gift")
  const starValue = giftValueInStars(gift.value, gift.floorTon)

  // Random internal correlation id; users no longer need to copy a code.
  const externalId = `gdep_${crypto.randomBytes(12).toString("hex")}`
  const row = await db.transaction(async (tx) => {
    // A fresh selection replaces abandoned intents from the same player. This
    // keeps code-free matching deterministic, including private gift sends.
    await tx
      .update(transactions)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "gift_deposit"),
          eq(transactions.status, "pending"),
        ),
      )
    return tx
      .insert(transactions)
      .values({
        userId,
        type: "gift_deposit",
        currency: "nft",
        amount: "0",
        credited: String(starValue),
        status: "pending",
        externalId,
        meta: { giftId: gift.id, giftSlug: gift.slug, giftName: gift.name },
      })
      .returning({ id: transactions.id })
  })

  return {
    transactionId: row[0].id,
    relayerUsername: relayerUsername(),
    relayerUrl: `https://t.me/${relayerUsername() ?? "pugsrelayer"}`,
    automated: await personalGiftRelayerReady(),
    giftName: gift.name,
    value: starValue,
  }
}

/** Called by the open deposit screen. It is safe to poll: matching and credit
 * are idempotent and restricted to the current Telegram user. */
export async function checkGiftDeposit(transactionId: number): Promise<{
  status: string
  completed: boolean
}> {
  const userId = await requireUserId()
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) throw new Error("Invalid deposit")
  const mine = (
    await db
      .select({ id: transactions.id, status: transactions.status })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), eq(transactions.type, "gift_deposit")))
      .limit(1)
  )[0]
  if (!mine) throw new Error("Deposit not found")
  if (mine.status === "pending") {
    await processPersonalGiftDeposits({ transactionId, userId })
  }
  const current = (
    await db
      .select({ status: transactions.status })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1)
  )[0]
  const status = current?.status ?? "pending"
  return { status, completed: status === "completed" }
}

export async function cancelGiftDeposit(transactionId: number): Promise<void> {
  const userId = await requireUserId()
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) return
  await db
    .update(transactions)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.type, "gift_deposit"),
        eq(transactions.status, "pending"),
      ),
    )
}

/**
 * Request to withdraw an owned inventory gift to the user's Telegram account.
 * Locks the item and creates a pending withdrawal for the relayer to fulfill via
 * transferGift (or an admin manually). A small Stars network fee can be applied.
 */
export async function requestGiftWithdraw(inventoryId: number): Promise<{ ok: true; balance: number; fee: number }> {
  const userId = await requireUserId()
  const withdrawFee = 25
  const ruleItem = (await db.select({ source: inventory.source, status: inventory.status }).from(inventory).where(and(
    eq(inventory.id, inventoryId),
    eq(inventory.userId, userId),
  )).limit(1))[0]
  if (!ruleItem || ruleItem.status !== "owned") throw new Error("Gift is not available to withdraw")

  const freeCaseClaimReady = ruleItem.source === "free-case"
    ? (await getFreeCaseClaimStatus(userId)).ready
    : true
  const giveawayTasksReady = ruleItem.source === "giveaway"
    ? (await freeCaseRequirements(userId)).ready
    : true
  if (!giveawayTasksReady) throw new Error("GIVEAWAY_WITHDRAW_REQUIREMENTS")

  const withdraw = await db.transaction(async (tx) => {
    const item = (
      await tx
        .select({ id: inventory.id, giftId: inventory.giftId, value: inventory.value, status: inventory.status, source: inventory.source, floorTon: gifts.floorTon })
        .from(inventory)
        .innerJoin(gifts, eq(inventory.giftId, gifts.id))
        .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId)))
        .limit(1)
    )[0]
    if (!item) throw new Error("Gift not found")
    if (item.status !== "owned") throw new Error("Gift is not available to withdraw")
    assertFreeCaseGiftUnlocked(item.source, freeCaseClaimReady)

    const gift = (await tx.select().from(gifts).where(eq(gifts.id, item.giftId)).limit(1))[0]

    const charged = await tx
      .update(users)
      .set({ balance: sql`${users.balance} - ${withdrawFee}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${withdrawFee}`))
      .returning({ balance: users.balance })
    if (!charged[0]) throw new Error("WITHDRAW_FEE_REQUIRED")

    await tx.update(inventory).set({ status: "withdraw_pending" }).where(eq(inventory.id, inventoryId))

    const created = await tx.insert(transactions).values({
      userId,
      type: "gift_withdraw",
      currency: "nft",
      amount: "0",
      credited: String(giftValueInStars(item.value, item.floorTon)),
      status: "pending",
      externalId: `wd_${inventoryId}`,
      meta: { inventoryId, giftId: item.giftId, giftSlug: gift?.slug, giftName: gift?.name, feeStars: withdrawFee },
    }).returning({ id: transactions.id })
    return { transactionId: created[0].id, giftName: gift?.name ?? "Telegram Gift", balance: Number(charged[0].balance) }
  })

  await notifyAdmins(`📤 <b>Новий вивід NFT</b>\n\n👤 User: <code>${userId}</code>\n🎁 ${withdraw.giftName}\n⭐ Комісія: ${withdrawFee}\n🧾 ID: <code>${withdraw.transactionId}</code>\n\nПісля ручної відправки натисни підтвердження.`, {
    inline_keyboard: [[{ text: "✅ Підтвердити відправку", callback_data: `admin_wd_confirm:${withdraw.transactionId}` }]],
  })

  if (ruleItem.source === "giveaway") await resetFreeCaseProgress(userId).catch(() => undefined)

  revalidatePath("/profile")
  return { ok: true, balance: withdraw.balance, fee: withdrawFee }
}

export type WithdrawRow = {
  id: number
  giftName: string
  value: number
  status: string
  createdAt: string
}

/** Withdrawals + gift deposits for the current user (for the profile history). */
export async function getMyTransfers(): Promise<WithdrawRow[]> {
  const userId = await requireUserId()
  const rows = await db
    .select({
      id: transactions.id,
      credited: transactions.credited,
      status: transactions.status,
      type: transactions.type,
      meta: transactions.meta,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.type} in ('gift_withdraw','gift_deposit')`,
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    giftName: (r.meta as any)?.giftName ?? "Gift",
    value: Number(r.credited),
    status: `${r.type === "gift_deposit" ? "Deposit" : "Withdraw"} · ${r.status}`,
    createdAt: r.createdAt.toISOString(),
  }))
}
