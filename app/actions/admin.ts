"use server"

import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { transactions, users } from "@/lib/db/schema"
import { isAdminId } from "@/lib/admin"
import { requireUserId } from "@/lib/session"

export async function creditBalance(targetUserId: string, amount: number) {
  const adminId = await requireUserId()
  if (!isAdminId(adminId)) throw new Error("Unauthorized")

  const target = targetUserId.trim()
  if (!/^\d{3,20}$/.test(target)) throw new Error("Enter a valid Telegram ID")
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
