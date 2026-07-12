import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, inventory, transactions } from "@/lib/db/schema"
import { getRelayerGifts, transferGiftToUser, notifyUser, relayerConfigured } from "@/lib/telegram-gifts"

export const dynamic = "force-dynamic"

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("secret")
  return provided === secret
}

/** Credit a confirmed NFT gift deposit to the user's inventory. */
async function creditDeposit(tx: typeof transactions.$inferSelect) {
  const meta = (tx.meta as any) ?? {}
  await db.transaction(async (t) => {
    await t.insert(inventory).values({
      userId: tx.userId,
      giftId: meta.giftId,
      value: String(Number(tx.credited)),
      status: "owned",
      source: "deposit",
    })
    await t.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id))
  })
  await notifyUser(tx.userId, `Your <b>${meta.giftName ?? "gift"}</b> deposit was credited. Good luck!`)
}

/** Fulfill a pending withdrawal by transferring a matching relayer gift to the user. */
async function fulfillWithdraw(tx: typeof transactions.$inferSelect, pool: Awaited<ReturnType<typeof getRelayerGifts>>) {
  const meta = (tx.meta as any) ?? {}
  const match = pool.find((g) => g.canBeTransferred && g.name && meta.giftName && g.name === meta.giftName)
  if (!match) return false

  await transferGiftToUser(match.ownedGiftId, tx.userId, match.transferStarCount)
  await db.transaction(async (t) => {
    await t.update(inventory).set({ status: "withdrawn" }).where(eq(inventory.id, meta.inventoryId))
    await t.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id))
  })
  await notifyUser(tx.userId, `Your <b>${meta.giftName}</b> has been sent to your account. Enjoy!`)
  // Remove the consumed gift from the local pool so it isn't reused this run.
  pool.splice(pool.indexOf(match), 1)
  return true
}

/** Admin/cron: process pending gift withdrawals (and auto-credit detected deposits). */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get("action") ?? "process"

  // Manual admin confirmation of a specific deposit or withdrawal.
  if (action === "confirm") {
    const txId = Number(url.searchParams.get("txId"))
    const tx = (await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1))[0]
    if (!tx) return NextResponse.json({ ok: false, error: "tx not found" }, { status: 404 })
    if (tx.type === "gift_deposit" && tx.status === "pending") {
      await creditDeposit(tx)
      return NextResponse.json({ ok: true, credited: true })
    }
    if (tx.type === "gift_withdraw" && tx.status === "pending") {
      const meta = (tx.meta as any) ?? {}
      await db.transaction(async (t) => {
        await t.update(inventory).set({ status: "withdrawn" }).where(eq(inventory.id, meta.inventoryId))
        await t.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id))
      })
      await notifyUser(tx.userId, `Your <b>${meta.giftName}</b> withdrawal was processed.`)
      return NextResponse.json({ ok: true, withdrawn: true })
    }
    return NextResponse.json({ ok: false, error: "nothing to do" })
  }

  // Automated processing requires a configured relayer (bot + business connection).
  if (!relayerConfigured()) {
    return NextResponse.json({ ok: true, automated: false, note: "relayer not configured; use manual confirm" })
  }

  const pending = await db
    .select()
    .from(transactions)
    .where(and(sql`${transactions.type} = 'gift_withdraw'`, eq(transactions.status, "pending")))
    .limit(50)

  let fulfilled = 0
  if (pending.length) {
    const pool = await getRelayerGifts()
    for (const tx of pending) {
      try {
        if (await fulfillWithdraw(tx, pool)) fulfilled++
      } catch {
        // leave pending for next run
      }
    }
  }

  return NextResponse.json({ ok: true, automated: true, pending: pending.length, fulfilled })
}

export async function GET(req: Request) {
  return POST(req)
}
