"use server"

import crypto from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, transactions } from "@/lib/db/schema"
import { requireUserId, getCurrentUser } from "@/lib/session"
import { starsToGram, tonToStars } from "@/lib/deposit-shared"
import { awardReferralCommission } from "@/lib/referrals"
import { notifyAdmins } from "@/lib/admin-notify"

/** Demo-only instant top up so the preview is fully playable. */
export async function addDemoBalance(amount: number): Promise<{ balance: number }> {
  const userId = await requireUserId()
  const me = await getCurrentUser()
  if (!me?.isDemo) throw new Error("Demo top-up is only available for demo accounts")
  if (!(amount > 0) || amount > 100000) throw new Error("Invalid amount")

  const updated = await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${amount}` })
    .where(eq(users.id, userId))
    .returning({ balance: users.balance })

  await db.insert(transactions).values({
    userId,
    type: "deposit",
    currency: "demo",
    amount: String(amount),
    credited: String(amount),
    status: "completed",
  })

  revalidatePath("/deposit")
  return { balance: Number(updated[0].balance) }
}

/** Create a Telegram Stars invoice link. Client opens it via WebApp.openInvoice. */
export async function createStarsInvoice(stars: number): Promise<{ link: string }> {
  const userId = await requireUserId()
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("Stars payments are not configured (missing TELEGRAM_BOT_TOKEN)")
  // Telegram Stars invoices use whole XTR units. Accept a custom amount while
  // keeping it inside Telegram's documented 1–10,000 Stars range.
  if (!Number.isInteger(stars) || stars < 1 || stars > 10_000) throw new Error("Enter an amount from 1 to 10,000 Stars")
  const credited = starsToGram(stars)

  const payload = JSON.stringify({ userId, stars, n: crypto.randomBytes(6).toString("hex") })

  const res = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `${stars} Stars`,
      description: `Top up your PugGift balance with ${credited} Stars`,
      payload,
      currency: "XTR",
      prices: [{ label: `${stars} Stars`, amount: stars }],
    }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || "Failed to create invoice")

  await db.insert(transactions).values({
    userId,
    type: "deposit",
    currency: "stars",
    amount: String(stars),
    credited: String(credited),
    status: "pending",
    externalId: payload,
  })

  return { link: data.result as string }
}

/** Create a TON deposit intent: returns receiver + memo the client sends via TON Connect. */
export async function createTonIntent(ton: number): Promise<{
  transactionId: number
  receiver: string
  amountNano: string
  memo: string
  credited: number
}> {
  const userId = await requireUserId()
  const receiver = process.env.TON_RECEIVER_ADDRESS
  if (!receiver) throw new Error("TON deposits are not configured (missing TON_RECEIVER_ADDRESS)")
  if (!(ton > 0)) throw new Error("Invalid amount")

  const credited = tonToStars(ton)
  // TON Connect does not accept a plain-text comment as payload. Give every
  // intent a unique nanoTON amount instead, so Toncenter can match it exactly.
  const amountNano = String(Math.round(ton * 1e9) + crypto.randomInt(1, 1000))
  const memo = ""

  const row = await db
    .insert(transactions)
    .values({
      userId,
      type: "deposit",
      currency: "ton",
      amount: String(ton),
      credited: String(credited),
      status: "pending",
      externalId: `nano:${amountNano}`,
    })
    .returning({ id: transactions.id })

  return { transactionId: row[0].id, receiver, amountNano, memo, credited }
}

/** Verify a TON deposit against toncenter and credit the balance if found. */
export async function verifyTonDeposit(transactionId: number): Promise<{
  status: "completed" | "pending"
  balance: number | null
}> {
  const userId = await requireUserId()
  const receiver = process.env.TON_RECEIVER_ADDRESS
  if (!receiver) throw new Error("TON deposits are not configured")

  const tx = (
    await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1)
  )[0]
  if (!tx || tx.userId !== userId) throw new Error("Transaction not found")
  if (tx.status === "completed") {
    const u = await getCurrentUser()
    return { status: "completed", balance: u ? Number(u.balance) : null }
  }

  const base = "https://toncenter.com/api/v3"
  const apiKey = process.env.TONCENTER_API_KEY
  const url =
    `${base}/transactions?account=${encodeURIComponent(receiver)}&limit=30&sort=desc` +
    (apiKey ? `&api_key=${apiKey}` : "")

  const res = await fetch(url, { headers: { accept: "application/json" } })
  const data = await res.json().catch(() => null)
  const txs: any[] = data?.transactions ?? []

  const storedNano = tx.externalId?.startsWith("nano:") ? Number(tx.externalId.slice(5)) : NaN
  const expectedNano = Number.isSafeInteger(storedNano) ? storedNano : Math.round(Number(tx.amount) * 1e9)

  const match = txs.find((t) => {
    const inMsg = t.in_msg
    if (!inMsg) return false
    const value = Number(inMsg.value ?? 0)
    return value === expectedNano
  })

  if (!match) return { status: "pending", balance: null }

  const updated = await db.transaction(async (t) => {
    const claimed = await t
      .update(transactions)
      .set({
        status: "completed",
        meta: { tonTransactionHash: match.hash ?? match.transaction_id?.hash ?? null },
      })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.status, "pending"),
        ),
      )
      .returning({ id: transactions.id })

    if (claimed.length === 0) {
      const current = await t.select({ balance: users.balance }).from(users).where(eq(users.id, userId)).limit(1)
      return current[0] ? { ...current[0], claimed: false } : null
    }

    const u = await t
      .update(users)
      .set({
        balance: sql`${users.balance} + ${Number(tx.credited)}`,
        totalDepositedTon: sql`${users.totalDepositedTon} + ${Number(tx.amount)}`,
      })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })
    return u[0] ? { ...u[0], claimed: true } : null
  })

  if (!updated) throw new Error("User not found")
  if (updated.claimed) {
    await awardReferralCommission(userId, transactionId, Number(tx.credited)).catch(() => undefined)
    await notifyAdmins(`📥 <b>TON депозит зараховано</b>\n\n👤 User: <code>${userId}</code>\n💎 ${Number(tx.amount)} TON\n⭐ ${Number(tx.credited).toLocaleString("en-US")}`)
  }
  revalidatePath("/deposit")
  return { status: "completed", balance: Number(updated.balance) }
}
