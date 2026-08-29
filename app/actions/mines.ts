"use server"

import crypto from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { gameHistory, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { notifyAdmins } from "@/lib/admin-notify"

const ALLOWED_MINES = new Set([3, 5, 10, 15])
const RTP = 0.9
const MAX_MULTIPLIER = 1000

type MinesMeta = { status: "active" | "cashed" | "bust"; mineCount: number; revealed: number[]; multiplier: number }
export type MinesState = { roundId: number; mineCount: number; revealed: number[]; multiplier: number; nextMultiplier: number; payout: number; status: "active" | "cashed" | "bust"; mines?: number[]; balance?: number }

function combination(n: number, k: number) {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= Math.min(k, n - k); i++) result = result * (n - i + 1) / i
  return result
}

function minesMultiplier(mineCount: number, safePicks: number) {
  if (safePicks <= 0) return 1
  const fair = combination(25, safePicks) / combination(25 - mineCount, safePicks)
  return Math.min(MAX_MULTIPLIER, Math.floor(fair * RTP * 100) / 100)
}

export async function getActiveMines(): Promise<MinesState | null> {
  const userId = await requireUserId()
  const round = (await db.select().from(gameHistory).where(and(
    eq(gameHistory.userId, userId),
    eq(gameHistory.game, "mines"),
    sql`${gameHistory.meta}->>'status' = 'active'`,
  )).orderBy(desc(gameHistory.id)).limit(1))[0]
  if (!round) return null
  const meta = round.meta as MinesMeta | null
  if (!meta) return null
  const multiplier = minesMultiplier(meta.mineCount, meta.revealed.length)
  return {
    roundId: round.id,
    mineCount: meta.mineCount,
    revealed: meta.revealed,
    multiplier,
    nextMultiplier: minesMultiplier(meta.mineCount, meta.revealed.length + 1),
    payout: meta.revealed.length ? Math.floor(Number(round.bet) * multiplier * 100) / 100 : 0,
    status: "active",
  }
}

function minePositions(roundId: number, userId: string, mineCount: number) {
  const secret = process.env.MINES_SECRET || process.env.CRASH_SECRET || process.env.TELEGRAM_BOT_TOKEN || "puggift-mines"
  return Array.from({ length: 25 }, (_, tile) => ({
    tile,
    score: crypto.createHmac("sha256", secret).update(`${roundId}:${userId}:${tile}`).digest("hex"),
  })).sort((a, b) => a.score.localeCompare(b.score)).slice(0, mineCount).map((item) => item.tile).sort((a, b) => a - b)
}

function adminMineMap(mines: number[]) {
  const mineSet = new Set(mines)
  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, column) => mineSet.has(row * 5 + column) ? "💣" : "▫️").join(""),
  ).join("\n")
}

export async function startMines(betInput: number, mineCountInput: number): Promise<MinesState> {
  const userId = await requireUserId()
  const bet = Math.round(Number(betInput) * 100) / 100
  const mineCount = Number(mineCountInput)
  if (!Number.isFinite(bet) || bet < 1 || bet > 100_000) throw new Error("Enter a bet from 1 to 100,000 Stars")
  if (!ALLOWED_MINES.has(mineCount)) throw new Error("Choose 3, 5, 10 or 15 mines")

  const started = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748223, hashtext(${userId}))`)
    const active = await tx.select({ id: gameHistory.id }).from(gameHistory).where(and(
      eq(gameHistory.userId, userId), eq(gameHistory.game, "mines"), sql`${gameHistory.meta}->>'status' = 'active'`,
    )).limit(1)
    if (active[0]) throw new Error("Finish your current Mines round first")
    const charged = await tx.update(users).set({ balance: sql`${users.balance} - ${bet}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${bet}`)).returning({ balance: users.balance })
    if (!charged[0]) throw new Error("INSUFFICIENT_FUNDS")
    const row = (await tx.insert(gameHistory).values({
      userId, game: "mines", bet: String(bet), result: "0",
      meta: { status: "active", mineCount, revealed: [], multiplier: 1 } satisfies MinesMeta,
    }).returning({ id: gameHistory.id }))[0]
    return { roundId: row.id, balance: Number(charged[0].balance) }
  })
  const mines = minePositions(started.roundId, userId, mineCount)
  await notifyAdmins(`💣 <b>Ставка Mines</b>\n\n👤 User: <code>${userId}</code>\n🎮 Round: <code>${started.roundId}</code>\n⭐ ${bet.toLocaleString("en-US")}\n💥 Mines: ${mineCount}\n📍 Cells: <code>${mines.map((tile) => tile + 1).join(", ")}</code>\n\n${adminMineMap(mines)}`)
  return { ...started, mineCount, revealed: [], multiplier: 1, nextMultiplier: minesMultiplier(mineCount, 1), payout: 0, status: "active" }
}

export async function revealMineTile(roundIdInput: number, tileInput: number): Promise<MinesState> {
  const userId = await requireUserId()
  const roundId = Number(roundIdInput); const tile = Number(tileInput)
  if (!Number.isSafeInteger(roundId) || !Number.isSafeInteger(tile) || tile < 0 || tile >= 25) throw new Error("Invalid tile")
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748224, ${roundId})`)
    const round = (await tx.select().from(gameHistory).where(and(eq(gameHistory.id, roundId), eq(gameHistory.userId, userId), eq(gameHistory.game, "mines"))).limit(1))[0]
    const meta = round?.meta as MinesMeta | null
    if (!round || !meta || meta.status !== "active") throw new Error("Round is no longer active")
    if (meta.revealed.includes(tile)) throw new Error("Tile already opened")
    const mines = minePositions(round.id, userId, meta.mineCount)
    if (mines.includes(tile)) {
      await tx.update(gameHistory).set({ result: "0", meta: { ...meta, status: "bust" } satisfies MinesMeta }).where(eq(gameHistory.id, round.id))
      return { roundId, mineCount: meta.mineCount, revealed: [...meta.revealed, tile], multiplier: meta.multiplier, nextMultiplier: 0, payout: 0, status: "bust", mines }
    }
    const revealed = [...meta.revealed, tile]
    const multiplier = minesMultiplier(meta.mineCount, revealed.length)
    const cleared = revealed.length === 25 - meta.mineCount
    const payout = Math.floor(Number(round.bet) * multiplier * 100) / 100
    if (cleared) {
      const credited = await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, userId)).returning({ balance: users.balance })
      await tx.update(gameHistory).set({ result: String(payout), meta: { ...meta, status: "cashed", revealed, multiplier } satisfies MinesMeta }).where(eq(gameHistory.id, round.id))
      return { roundId, mineCount: meta.mineCount, revealed, multiplier, nextMultiplier: multiplier, payout, status: "cashed", mines, balance: Number(credited[0].balance) }
    }
    await tx.update(gameHistory).set({ meta: { ...meta, revealed, multiplier } satisfies MinesMeta }).where(eq(gameHistory.id, round.id))
    return { roundId, mineCount: meta.mineCount, revealed, multiplier, nextMultiplier: minesMultiplier(meta.mineCount, revealed.length + 1), payout, status: "active" }
  })
}

export async function cashoutMines(roundIdInput: number): Promise<MinesState> {
  const userId = await requireUserId(); const roundId = Number(roundIdInput)
  if (!Number.isSafeInteger(roundId)) throw new Error("Invalid round")
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748224, ${roundId})`)
    const round = (await tx.select().from(gameHistory).where(and(eq(gameHistory.id, roundId), eq(gameHistory.userId, userId), eq(gameHistory.game, "mines"))).limit(1))[0]
    const meta = round?.meta as MinesMeta | null
    if (!round || !meta || meta.status !== "active") throw new Error("Round is no longer active")
    if (!meta.revealed.length) throw new Error("Open at least one safe tile")
    const multiplier = minesMultiplier(meta.mineCount, meta.revealed.length)
    const payout = Math.floor(Number(round.bet) * multiplier * 100) / 100
    const credited = await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, userId)).returning({ balance: users.balance })
    await tx.update(gameHistory).set({ result: String(payout), meta: { ...meta, status: "cashed", multiplier } satisfies MinesMeta }).where(eq(gameHistory.id, round.id))
    return { roundId, mineCount: meta.mineCount, revealed: meta.revealed, multiplier, nextMultiplier: multiplier, payout, status: "cashed", mines: minePositions(round.id, userId, meta.mineCount), balance: Number(credited[0].balance) }
  })
}
