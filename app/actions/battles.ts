"use server"

import crypto from "node:crypto"
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { battleRooms, battleSlots, gameHistory, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { notifyAdmins } from "@/lib/admin-notify"

const MATCH_WINDOW_MS = 30_000
const UNARMED_ROOM_MS = 24 * 60 * 60 * 1000
const GLOBAL_CAPACITY = 1_000
const MIN_BET = 10
const MAX_BET_PER_ACTION = 100_000
const HOUSE_PAYOUT = 0.9

export type BattleGift = { id: number; name: string; rarity: string; imageUrl: string; value: number }
export type BattlePull = { round: number; gift: BattleGift }
export type BattlePlayer = {
  slot: number; name: string; photoUrl: string | null; isBot: boolean; isYou: boolean
  pulls: BattleGift[]; total: number
}
export type BattleResult = {
  caseName: string; coverUrl: string; rounds: number; players: BattlePlayer[]
  winnerSlot: number; pot: number; grossBank: number; youWon: boolean; youWinAmount: number; balance: number
}
export type MatchSlot = {
  slot: number; name: string; photoUrl: string | null; isBot: boolean; isYou: boolean
  stake: number; chance: number
}
export type MatchState = {
  roomId: number; status: "waiting" | "countdown" | "resolving" | "done"
  capacity: number; rounds: number; entryCost: number; caseName: string
  bank: number; payout: number; myStake: number; secondsLeft: number | null
  slots: MatchSlot[]; result: BattleResult | null
}
export type BattleSession = {
  roomId: number; bet: number; bank: number; payout: number; myStake: number
  players: number; capacity: number; status: "waiting" | "countdown"; secondsLeft: number | null
  names: string[]; photos: (string | null)[]; stakes: number[]; chances: number[]; isYou: boolean[]
}

type StoredPlayer = Omit<BattlePlayer, "isYou"> & { userId: string | null }
type StoredResult = {
  caseName: string; coverUrl: string; rounds: number; pot: number; grossBank: number
  winnerSlot: number; players: StoredPlayer[]
}

function countdownStarted(room: { createdAt: Date; startsAt: Date }) {
  return room.startsAt.getTime() - room.createdAt.getTime() < 5 * 60 * 1000
}
function payoutFor(bank: number) { return Math.max(0, Math.floor(bank * HOUSE_PAYOUT)) }
function chanceFor(stake: number, bank: number) { return bank > 0 ? (stake / bank) * 100 : 0 }

async function resolveExpiredGlobalRoom() {
  const expired = (await db
    .select({ id: battleRooms.id, startsAt: battleRooms.startsAt, createdAt: battleRooms.createdAt })
    .from(battleRooms)
    .where(and(eq(battleRooms.status, "waiting"), isNull(battleRooms.caseId)))
    .orderBy(asc(battleRooms.createdAt))
  ).find((room) => countdownStarted(room) && room.startsAt.getTime() <= Date.now())
  if (expired) await resolveRoom(expired.id)
}

export async function joinBattle(input: { bet: number; roomId?: number }): Promise<{ roomId: number }> {
  const userId = await requireUserId()
  const stake = Math.round(Number(input.bet))
  if (!Number.isFinite(stake) || stake < MIN_BET || stake > MAX_BET_PER_ACTION) throw new Error("INVALID_BET")
  await resolveExpiredGlobalRoom()

  const joined = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748219, 1)`)
    const user = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!user) throw new Error("Unauthorized")

    const charged = await tx.update(users)
      .set({ balance: sql`${users.balance} - ${stake}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${stake}`))
      .returning({ balance: users.balance })
    if (charged.length === 0) throw new Error("INSUFFICIENT_FUNDS")

    let room = (await tx.select().from(battleRooms)
      .where(and(eq(battleRooms.status, "waiting"), isNull(battleRooms.caseId)))
      .orderBy(asc(battleRooms.createdAt)).limit(1))[0]
    if (!room) {
      room = (await tx.insert(battleRooms).values({
        capacity: GLOBAL_CAPACITY, rounds: 1, entryCost: "0", status: "waiting",
        startsAt: new Date(Date.now() + UNARMED_ROOM_MS),
      }).returning())[0]
    }

    const existing = (await tx.select().from(battleSlots)
      .where(and(eq(battleSlots.roomId, room.id), eq(battleSlots.userId, userId), eq(battleSlots.isBot, false)))
      .limit(1))[0]
    if (existing) {
      await tx.update(battleSlots).set({ stake: sql`${battleSlots.stake} + ${stake}` }).where(eq(battleSlots.id, existing.id))
    } else {
      const taken = await tx.select({ slot: battleSlots.slot }).from(battleSlots).where(eq(battleSlots.roomId, room.id))
      const used = new Set(taken.map((item) => item.slot))
      let slot = 0
      while (used.has(slot)) slot++
      await tx.insert(battleSlots).values({
        roomId: room.id, slot, userId, name: user.firstName || user.username || "Player",
        photoUrl: user.photoUrl, isBot: false, stake: stake.toFixed(2),
      })
    }

    const participantCount = (await tx.select({ count: sql<number>`count(*)::int` }).from(battleSlots)
      .where(and(eq(battleSlots.roomId, room.id), eq(battleSlots.isBot, false))))[0]?.count ?? 0
    if (participantCount >= 2 && !countdownStarted(room)) {
      await tx.update(battleRooms).set({ startsAt: new Date(Date.now() + MATCH_WINDOW_MS) }).where(eq(battleRooms.id, room.id))
    }
    return { roomId: room.id }
  })
  revalidatePath("/battles")
  await notifyAdmins(`⚔️ <b>Ставка PvP</b>\n\n👤 User: <code>${userId}</code>\n⭐ ${stake.toLocaleString("en-US")}\n🎮 Room: ${joined.roomId}`)
  return joined
}

export async function leaveBattle(roomId: number): Promise<void> {
  const userId = await requireUserId()
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(748219, 1)`)
    const room = (await tx.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
    if (!room || room.status !== "waiting" || countdownStarted(room)) return
    const mine = (await tx.select().from(battleSlots)
      .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.userId, userId), eq(battleSlots.isBot, false)))
      .limit(1))[0]
    if (!mine) return
    const refund = Number(mine.stake)
    await tx.delete(battleSlots).where(eq(battleSlots.id, mine.id))
    await tx.update(users).set({ balance: sql`${users.balance} + ${refund}` }).where(eq(users.id, userId))
    const left = (await tx.select({ count: sql<number>`count(*)::int` }).from(battleSlots)
      .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.isBot, false))))[0]?.count ?? 0
    if (left === 0) await tx.delete(battleRooms).where(eq(battleRooms.id, roomId))
  })
  revalidatePath("/battles")
}

async function roomSlots(roomId: number) {
  return db.select().from(battleSlots)
    .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.isBot, false)))
    .orderBy(asc(battleSlots.slot))
}

export async function getMatchState(roomId: number): Promise<MatchState> {
  const userId = await requireUserId()
  let room = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  if (!room) throw new Error("Room not found")
  if (room.status === "waiting" && countdownStarted(room) && room.startsAt.getTime() <= Date.now()) {
    await resolveRoom(roomId)
    room = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  }
  const slots = await roomSlots(roomId)
  const bank = slots.reduce((sum, slot) => sum + Number(slot.stake), 0)
  return {
    roomId,
    status: room.status === "waiting" && countdownStarted(room) ? "countdown" : room.status as MatchState["status"],
    capacity: room.capacity, rounds: 1, entryCost: 0, caseName: "Global PvP",
    bank, payout: payoutFor(bank), myStake: Number(slots.find((slot) => slot.userId === userId)?.stake ?? 0),
    secondsLeft: countdownStarted(room) ? Math.max(0, Math.ceil((room.startsAt.getTime() - Date.now()) / 1000)) : null,
    slots: slots.map((slot) => ({
      slot: slot.slot, name: slot.name, photoUrl: slot.photoUrl, isBot: false, isYou: slot.userId === userId,
      stake: Number(slot.stake), chance: chanceFor(Number(slot.stake), bank),
    })),
    result: room.status === "done" && room.result ? personalizeResult(room.result as StoredResult, userId) : null,
  }
}

async function resolveRoom(roomId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const claimed = await tx.update(battleRooms).set({ status: "resolving" })
      .where(and(eq(battleRooms.id, roomId), eq(battleRooms.status, "waiting"))).returning()
    if (claimed.length === 0) return
    const slots = await tx.select().from(battleSlots)
      .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.isBot, false))).orderBy(asc(battleSlots.slot))
    if (slots.length < 2) {
      await tx.update(battleRooms).set({ status: "waiting", startsAt: new Date(Date.now() + UNARMED_ROOM_MS) }).where(eq(battleRooms.id, roomId))
      return
    }

    const grossBank = slots.reduce((sum, slot) => sum + Math.round(Number(slot.stake)), 0)
    const payout = payoutFor(grossBank)
    let ticket = crypto.randomInt(grossBank)
    let winnerSlot = slots[slots.length - 1].slot
    for (const slot of slots) {
      ticket -= Math.round(Number(slot.stake))
      if (ticket < 0) { winnerSlot = slot.slot; break }
    }
    const players: StoredPlayer[] = slots.map((slot) => ({
      slot: slot.slot, name: slot.name, photoUrl: slot.photoUrl, isBot: false, userId: slot.userId,
      pulls: [], total: Number(slot.stake),
    }))
    const winner = players.find((player) => player.slot === winnerSlot)!
    if (winner.userId) await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, winner.userId))

    for (const player of players) {
      if (!player.userId) continue
      const won = player.slot === winnerSlot
      await tx.update(users).set({ xp: sql`${users.xp} + ${Math.round(player.total)}` }).where(eq(users.id, player.userId))
      await tx.insert(gameHistory).values({
        userId: player.userId, game: "battle", bet: String(player.total), result: String(won ? payout : 0),
        meta: { roomId, mode: "global-jackpot", caseName: "Global PvP", players: players.length, rounds: 1,
          winnerName: winner.name, winnerIsYou: won, chance: chanceFor(player.total, grossBank), pot: payout, grossBank },
      })
    }
    const stored: StoredResult = { caseName: "Global PvP", coverUrl: "", rounds: 1, pot: payout, grossBank, winnerSlot, players }
    await tx.update(battleRooms).set({ status: "done", result: stored }).where(eq(battleRooms.id, roomId))
  })
  revalidatePath("/battles")
  revalidatePath("/profile")
}

function personalizeResult(stored: StoredResult, userId: string): BattleResult {
  const mine = stored.players.find((player) => player.userId === userId)
  const youWon = mine?.slot === stored.winnerSlot
  return {
    caseName: stored.caseName, coverUrl: stored.coverUrl, rounds: stored.rounds,
    players: stored.players.map((player) => ({ ...player, isYou: player.userId === userId })),
    winnerSlot: stored.winnerSlot, pot: stored.pot, grossBank: stored.grossBank ?? stored.pot,
    youWon, youWinAmount: youWon ? stored.pot : 0, balance: 0,
  }
}

export async function getBattleSessions(): Promise<BattleSession[]> {
  const userId = await requireUserId()
  await resolveExpiredGlobalRoom()
  const room = (await db.select().from(battleRooms)
    .where(and(eq(battleRooms.status, "waiting"), isNull(battleRooms.caseId)))
    .orderBy(asc(battleRooms.createdAt)).limit(1))[0]
  if (!room) return []
  const slots = await roomSlots(room.id)
  const bank = slots.reduce((sum, slot) => sum + Number(slot.stake), 0)
  const started = countdownStarted(room)
  return [{
    roomId: room.id, bet: 0, bank, payout: payoutFor(bank),
    myStake: Number(slots.find((slot) => slot.userId === userId)?.stake ?? 0),
    players: slots.length, capacity: room.capacity, status: started ? "countdown" : "waiting",
    secondsLeft: started ? Math.max(0, Math.ceil((room.startsAt.getTime() - Date.now()) / 1000)) : null,
    names: slots.map((slot) => slot.name), photos: slots.map((slot) => slot.photoUrl),
    stakes: slots.map((slot) => Number(slot.stake)), chances: slots.map((slot) => chanceFor(Number(slot.stake), bank)),
    isYou: slots.map((slot) => slot.userId === userId),
  }]
}

export async function getRecentBattles(): Promise<
  { id: number; caseName: string; winnerName: string; pot: number; players: number; youWon: boolean }[]
> {
  const rows = await db.select().from(gameHistory).where(eq(gameHistory.game, "battle")).orderBy(desc(gameHistory.createdAt)).limit(40)
  const seen = new Set<number>()
  const output: { id: number; caseName: string; winnerName: string; pot: number; players: number; youWon: boolean }[] = []
  for (const row of rows) {
    const meta = (row.meta ?? {}) as Record<string, unknown>
    const roomId = meta.roomId != null ? Number(meta.roomId) : null
    if (roomId != null && seen.has(roomId)) continue
    if (roomId != null) seen.add(roomId)
    output.push({ id: row.id, caseName: (meta.caseName as string) ?? "Global PvP",
      winnerName: (meta.winnerName as string) ?? "Player", pot: Number(meta.pot ?? 0),
      players: Number(meta.players ?? 2), youWon: Boolean(meta.winnerIsYou) })
    if (output.length >= 15) break
  }
  return output
}
