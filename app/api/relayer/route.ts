import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { inventory, transactions } from "@/lib/db/schema"
import { getRelayerGifts, transferGiftToUser, notifyUser, businessRelayerConfigured } from "@/lib/telegram-gifts"
import { creditGiftDeposit, processPersonalGiftDeposits } from "@/lib/gift-deposits"

export const dynamic = "force-dynamic"

function authorized(req: Request): boolean {
  const secrets = [process.env.ADMIN_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value))
  if (!secrets.length) return false
  const url = new URL(req.url)
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("secret")
  return Boolean(provided && secrets.includes(provided))
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
      await creditGiftDeposit(tx)
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

  // Normal-account deposits use getUserGifts and need no Business connection.
  const deposits = await processPersonalGiftDeposits().catch((error) => ({
    configured: false,
    scanned: 0,
    credited: 0,
    error: error instanceof Error ? error.message : "deposit scan failed",
  }))

  const pending = await db
    .select()
    .from(transactions)
    .where(and(sql`${transactions.type} = 'gift_withdraw'`, eq(transactions.status, "pending")))
    .limit(50)

  // Withdrawals intentionally stay pending until an administrator confirms
  // the inline request in Telegram after manually sending the NFT.
  return NextResponse.json({ ok: true, automated: deposits.configured, deposits, withdrawals: { configured: businessRelayerConfigured(), pending: pending.length, fulfilled: 0, manualConfirmation: true } })
}

export async function GET(req: Request) {
  return POST(req)
}
