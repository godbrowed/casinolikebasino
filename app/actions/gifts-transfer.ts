"use server"

import crypto from "crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, gifts, inventory, transactions } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { relayerConfigured, relayerUsername } from "@/lib/telegram-gifts"
import { GIFT_VALUE_PER_TON } from "@/lib/pricing"

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
  return rows.map(({ floorTon, ...r }) => ({ ...r, value: Number(floorTon) > 0 ? Math.round(Number(floorTon) * GIFT_VALUE_PER_TON) : Number(r.value) }))
}

export type RelayerInfo = {
  username: string | null
  automated: boolean
}

/** Public info the deposit UI needs to instruct the user where to send a gift. */
export async function getRelayerInfo(): Promise<RelayerInfo> {
  return { username: relayerUsername(), automated: relayerConfigured() }
}

/**
 * Create a pending NFT gift deposit. The user is told to send the chosen gift to
 * the relayer account with the returned code in the comment. A relayer poll (or
 * an admin) then confirms it and credits the gift to the user's inventory.
 */
export async function createGiftDepositIntent(giftSlug: string): Promise<{
  transactionId: number
  code: string
  relayerUsername: string | null
  automated: boolean
  giftName: string
  value: number
}> {
  const userId = await requireUserId()
  const gift = (await db.select().from(gifts).where(eq(gifts.slug, giftSlug)).limit(1))[0]
  if (!gift) throw new Error("Unknown gift")
  const starValue = Number(gift.floorTon) > 0 ? Math.round(Number(gift.floorTon) * GIFT_VALUE_PER_TON) : Number(gift.value)

  const code = `GFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  const row = await db
    .insert(transactions)
    .values({
      userId,
      type: "gift_deposit",
      currency: "nft",
      amount: "0",
      credited: String(starValue),
      status: "pending",
      externalId: code,
      meta: { giftId: gift.id, giftSlug: gift.slug, giftName: gift.name },
    })
    .returning({ id: transactions.id })

  return {
    transactionId: row[0].id,
    code,
    relayerUsername: relayerUsername(),
    automated: relayerConfigured(),
    giftName: gift.name,
    value: starValue,
  }
}

/**
 * Request to withdraw an owned inventory gift to the user's Telegram account.
 * Locks the item and creates a pending withdrawal for the relayer to fulfill via
 * transferGift (or an admin manually). A small Stars network fee can be applied.
 */
export async function requestGiftWithdraw(inventoryId: number): Promise<{ ok: true }> {
  const userId = await requireUserId()

  await db.transaction(async (tx) => {
    const item = (
      await tx
        .select({ id: inventory.id, giftId: inventory.giftId, value: inventory.value, status: inventory.status })
        .from(inventory)
        .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId)))
        .limit(1)
    )[0]
    if (!item) throw new Error("Gift not found")
    if (item.status !== "owned") throw new Error("Gift is not available to withdraw")

    const gift = (await tx.select().from(gifts).where(eq(gifts.id, item.giftId)).limit(1))[0]

    await tx.update(inventory).set({ status: "withdraw_pending" }).where(eq(inventory.id, inventoryId))

    await tx.insert(transactions).values({
      userId,
      type: "gift_withdraw",
      currency: "nft",
      amount: "0",
      credited: String(Number(item.value)),
      status: "pending",
      externalId: `wd_${inventoryId}`,
      meta: { inventoryId, giftId: item.giftId, giftSlug: gift?.slug, giftName: gift?.name },
    })
  })

  revalidatePath("/profile")
  return { ok: true }
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
