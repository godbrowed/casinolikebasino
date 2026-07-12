"use server"

import crypto from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, transactions } from "@/lib/db/schema"
import { requireUserId, getCurrentUser } from "@/lib/session"
import { TON_TO_GRAM, STAR_PACKS } from "@/lib/deposit-shared"

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
  if (!STAR_PACKS.includes(stars)) throw new Error("Invalid pack")

  const payload = JSON.stringify({ userId, stars, n: crypto.randomBytes(6).toString("hex") })

  const res = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `${stars} Stars`,
      description: `Top up ${stars} Stars to your casino balance`,
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
    credited: "0",
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

  const memo = `dep_${crypto.randomBytes(5).toString("hex")}`
  const credited = ton * TON_TO_GRAM
  const amountNano = String(Math.round(ton * 1e9))

  const row = await db
    .insert(transactions)
    .values({
      userId,
      type: "deposit",
      currency: "ton",
      amount: String(ton),
      credited: String(credited),
      status: "pending",
      externalId: memo,
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

  const memo = tx.externalId ?? ""
  const expectedNano = Math.round(Number(tx.amount) * 1e9)

  const match = txs.find((t) => {
    const inMsg = t.in_msg
    if (!inMsg) return false
    const comment: string = inMsg.message_content?.decoded?.comment ?? inMsg.comment ?? ""
    const value = Number(inMsg.value ?? 0)
    return comment.includes(memo) && value >= expectedNano * 0.98
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
      return current[0]
    }

    const u = await t
      .update(users)
      .set({
        balance: sql`${users.balance} + ${Number(tx.credited)}`,
        totalDepositedTon: sql`${users.totalDepositedTon} + ${Number(tx.amount)}`,
      })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })
    return u[0]
  })

  if (!updated) throw new Error("User not found")
  revalidatePath("/deposit")
  return { status: "completed", balance: Number(updated.balance) }
}
