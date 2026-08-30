"use server"

import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { transactions, users } from "@/lib/db/schema"
import { isAdminId } from "@/lib/admin"
import { requireUserId } from "@/lib/session"

export type UserRestrictionState = {
  id: string
  name: string
  username: string | null
  casinoBlocked: boolean
  nftWithdrawalsBlocked: boolean
}

function validTelegramId(value: string) {
  const target = value.trim()
  if (!/^\d{3,20}$/.test(target)) throw new Error("Enter a valid Telegram ID")
  return target
}

async function requireAdminId() {
  const adminId = await requireUserId()
  if (!isAdminId(adminId)) throw new Error("Unauthorized")
  return adminId
}

function restrictionState(user: typeof users.$inferSelect): UserRestrictionState {
  return {
    id: user.id,
    name: user.firstName || user.username || user.id,
    username: user.username,
    casinoBlocked: user.casinoBlocked,
    nftWithdrawalsBlocked: user.nftWithdrawalsBlocked,
  }
}

export async function getUserRestrictions(targetUserId: string): Promise<UserRestrictionState> {
  await requireAdminId()
  const target = validTelegramId(targetUserId)
  const user = (await db.select().from(users).where(eq(users.id, target)).limit(1))[0]
  if (!user) throw new Error("User has not opened the bot yet")
  return restrictionState(user)
}

export async function setUserRestriction(
  targetUserId: string,
  kind: "casino" | "nft-withdrawals",
  blocked: boolean,
): Promise<UserRestrictionState> {
  const adminId = await requireAdminId()
  const target = validTelegramId(targetUserId)
  if (isAdminId(target)) throw new Error("Administrator accounts cannot be restricted")

  const updated = await db.update(users).set(kind === "casino"
    ? { casinoBlocked: Boolean(blocked) }
    : { nftWithdrawalsBlocked: Boolean(blocked) })
    .where(eq(users.id, target))
    .returning()
  if (!updated[0]) throw new Error("User has not opened the bot yet")

  await db.insert(transactions).values({
    userId: target,
    type: "admin_restriction",
    currency: "system",
    amount: "0",
    credited: "0",
    status: "completed",
    meta: { adminId, kind, blocked: Boolean(blocked) },
  })
  revalidatePath("/admin")
  return restrictionState(updated[0])
}

export async function creditBalance(targetUserId: string, amount: number) {
  const adminId = await requireAdminId()

  const target = validTelegramId(targetUserId)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new Error("Amount must be from 0.01 to 1,000,000")
  }
  const normalizedAmount = Math.round(amount * 100) / 100

  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${normalizedAmount}` })
      .where(eq(users.id, target))
      .returning({ id: users.id, firstName: users.firstName, username: users.username, balance: users.balance })
    const user = updated[0]
    if (!user) throw new Error("User has not opened the bot yet")

    await tx.insert(transactions).values({
      userId: target,
      type: "admin_credit",
      currency: "stars",
      amount: String(normalizedAmount),
      credited: String(normalizedAmount),
      status: "completed",
      meta: { adminId },
    })
    return user
  })

  revalidatePath("/admin")
  return {
    name: result.firstName || result.username || result.id,
    balance: Number(result.balance),
    amount: normalizedAmount,
  }
}
