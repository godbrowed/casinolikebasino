"use server"

import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, inventory, gifts, gameHistory } from "@/lib/db/schema"
import { requireUserId, getCurrentUser } from "@/lib/session"
import { isAdminId } from "@/lib/admin"

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

export async function getInventory() {
  const userId = await requireUserId()
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
    })
    .from(inventory)
    .innerJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
    .orderBy(desc(inventory.value), desc(inventory.createdAt))

  return rows.map((r) => ({ ...r, value: Number(r.value) }))
}

export async function sellGift(inventoryId: number) {
  const userId = await requireUserId()
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(inventory)
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

    await tx.update(inventory).set({ status: "sold" }).where(eq(inventory.id, inventoryId))
    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${item.value}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })

    revalidatePath("/profile")
    return { balance: Number(updated[0].balance), value: Number(item.value) }
  })
}

export async function sellAll() {
  const userId = await requireUserId()
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: inventory.id, value: inventory.value })
      .from(inventory)
      .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
    if (owned.length === 0) return { balance: null, total: 0 }

    const total = owned.reduce((s, r) => s + Number(r.value), 0)
    await tx
      .update(inventory)
      .set({ status: "sold" })
      .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
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
