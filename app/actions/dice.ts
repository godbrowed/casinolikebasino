"use server"

import crypto from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { gameHistory, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { notifyAdmins } from "@/lib/admin-notify"

const ALLOWED_MULTIPLIERS = new Set([2, 3, 5, 10])
const RTP_PERCENT = 90

export type DiceResult = { roll: number; multiplier: number; chance: number; won: boolean; payout: number; balance: number }

export async function rollPugDice(betInput: number, multiplierInput: number): Promise<DiceResult> {
  const userId = await requireUserId()
  const bet = Math.round(Number(betInput) * 100) / 100
  const multiplier = Number(multiplierInput)
  if (!Number.isFinite(bet) || bet < 1 || bet > 100_000) throw new Error("Enter a bet from 1 to 100,000 Stars")
  if (!ALLOWED_MULTIPLIERS.has(multiplier)) throw new Error("Choose a valid multiplier")
  const chance = RTP_PERCENT / multiplier
  const roll = crypto.randomInt(1, 10_001) / 100
  const won = roll <= chance
  const payout = won ? Math.floor(bet * multiplier * 100) / 100 : 0

  const settled = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748225, hashtext(${userId}))`)
    const charged = await tx.update(users).set({ balance: sql`${users.balance} - ${bet}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${bet}`)).returning({ balance: users.balance })
    if (!charged[0]) throw new Error("INSUFFICIENT_FUNDS")
    const balance = payout > 0
      ? Number((await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, userId)).returning({ balance: users.balance }))[0].balance)
      : Number(charged[0].balance)
    await tx.insert(gameHistory).values({ userId, game: "dice", bet: String(bet), result: String(payout), meta: { roll, multiplier, chance, won } })
    return balance
  })
  void notifyAdmins(`🎲 <b>Pug Dice</b>\n\n👤 <code>${userId}</code>\n⭐ ${bet.toLocaleString("en-US")} · ${multiplier}×\n🎯 ${roll.toFixed(2)} / ${chance.toFixed(2)}\n${won ? `✅ ${payout.toLocaleString("en-US")}` : "❌ Lost"}`)
  return { roll, multiplier, chance, won, payout, balance: settled }
}
