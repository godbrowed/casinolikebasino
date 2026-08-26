"use server"

import { and, desc, eq, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, inventory, gifts, gameHistory } from "@/lib/db/schema"
import { requireUserId, getCurrentUser } from "@/lib/session"
import { isAdminId } from "@/lib/admin"
import { giftValueInStars } from "@/lib/pricing"
import { assertFreeCaseGiftUnlocked, getFreeCaseClaimStatus } from "@/lib/free-case-referrals"

export async function getMe() {
  const user = await getCurrentUser()
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    photoUrl: user.photoUrl,
    balance: Number(user.balance),
    isDemo: user.isDemo,
    xp: Number(user.xp),
    totalDepositedStars: Number(user.totalDepositedStars),
    totalDepositedTon: Number(user.totalDepositedTon),
    tonWalletAddress: user.tonWalletAddress,
    isAdmin: isAdminId(user.id),
  }
}

export async function getInventory(includeLocked = false) {
  const userId = await requireUserId()
  const claim = await getFreeCaseClaimStatus(userId, false)
  const rows = await db
    .select({
      id: inventory.id,
      value: inventory.value,
      status: inventory.status,
      source: inventory.source,
      createdAt: inventory.createdAt,
      giftId: gifts.id,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      slug: gifts.slug,
      floorTon: gifts.floorTon,
    })
    .from(inventory)
    .innerJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(and(
      eq(inventory.userId, userId),
      or(eq(inventory.status, "owned"), eq(inventory.status, "withdraw_pending")),
      includeLocked || claim.ready ? sql`true` : sql`${inventory.source} <> 'free-case'`,
    ))
    .orderBy(desc(inventory.value), desc(inventory.createdAt))

  return rows.map(({ floorTon, ...r }) => ({ ...r, sending: r.status === "withdraw_pending", locked: r.source === "free-case" && !claim.ready, value: giftValueInStars(r.value, floorTon) }))
}

export async function sellGift(inventoryId: number) {
  const userId = await requireUserId()
  const claim = await getFreeCaseClaimStatus(userId)
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: inventory.id, value: inventory.value, floorTon: gifts.floorTon, source: inventory.source })
      .from(inventory)
      .innerJoin(gifts, eq(inventory.giftId, gifts.id))
      .where(
        and(
          eq(inventory.id, inventoryId),
          eq(inventory.userId, userId),
          eq(inventory.status, "owned"),
        ),
      )
      .limit(1)
    const item = rows[0]
    if (!item) throw new Error("Item not found")
    assertFreeCaseGiftUnlocked(item.source, claim.ready)
    const currentValue = giftValueInStars(item.value, item.floorTon)

    await tx.update(inventory).set({ status: "sold" }).where(eq(inventory.id, inventoryId))
    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${currentValue}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })

    revalidatePath("/profile")
    return { balance: Number(updated[0].balance), value: currentValue }
  })
}

export async function sellAll() {
  const userId = await requireUserId()
  const claim = await getFreeCaseClaimStatus(userId)
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: inventory.id, value: inventory.value, floorTon: gifts.floorTon })
      .from(inventory)
      .innerJoin(gifts, eq(inventory.giftId, gifts.id))
      .where(and(
        eq(inventory.userId, userId),
        eq(inventory.status, "owned"),
        claim.ready ? sql`true` : sql`${inventory.source} <> 'free-case'`,
      ))
    if (owned.length === 0) return { balance: null, total: 0 }

    const total = owned.reduce((s, r) => s + giftValueInStars(r.value, r.floorTon), 0)
    await tx
      .update(inventory)
      .set({ status: "sold" })
      .where(and(
        eq(inventory.userId, userId),
        eq(inventory.status, "owned"),
        claim.ready ? sql`true` : sql`${inventory.source} <> 'free-case'`,
      ))
    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${total}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })

    revalidatePath("/profile")
    return { balance: Number(updated[0].balance), total }
  })
}

export async function getHistory() {
  const userId = await requireUserId()
  const rows = await db
    .select()
    .from(gameHistory)
    .where(eq(gameHistory.userId, userId))
    .orderBy(desc(gameHistory.createdAt))
    .limit(40)
  return rows.map((r) => ({
    id: r.id,
    game: r.game,
    bet: Number(r.bet),
    result: Number(r.result),
    meta: r.meta as Record<string, unknown> | null,
    createdAt: r.createdAt,
  }))
}
