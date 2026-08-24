"use server"

import crypto from "node:crypto"
import { eq, sql, desc, and, gt, lte, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { cases, caseItems, gifts, users, gameHistory, battleRooms, battleSlots } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { readFile } from "node:fs/promises"
import path from "node:path"

export type BattlePull = { round: number; gift: BattleGift }
export type BattleGift = {
  id: number
  name: string
  rarity: string
  imageUrl: string
  value: number
}
export type BattlePlayer = {
  slot: number
  name: string
  photoUrl: string | null
  isBot: boolean
  isYou: boolean
  pulls: BattleGift[]
  total: number
}
export type BattleResult = {
  caseName: string
  coverUrl: string
  rounds: number
  players: BattlePlayer[]
  winnerSlot: number
  pot: number
  youWon: boolean
  youWinAmount: number
  balance: number
}

const BOT_NAMES = [
  "anton.wave",
  "luna.ton",
  "kira.nft",
  "max.blox",
  "sasha.play",
  "zen.gram",
  "mira.case",
  "danylo.ton",
  "vlad.drop",
  "nora.gift",
  "alex.box",
  "kate.nft",
]

let parsedNamesCache: string[] | null = null

async function getBotNames(): Promise<string[]> {
  if (parsedNamesCache) return parsedNamesCache
  try {
    const contents = await readFile(path.join(process.cwd(), "parsed.txt"), "utf8")
    const names = contents
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^@/, "").split(/[\s,;|]+/)[0])
      .filter((name) => /^[\p{L}\p{N}_.-]{3,32}$/u.test(name))
    if (names.length) return (parsedNamesCache = [...new Set(names)])
  } catch {
    // parsed.txt is optional while it is being prepared by the owner.
  }
  return BOT_NAMES
}

function weightedPick(items: { weight: number }[]): number {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight
    if (r <= 0) return i
  }
  return items.length - 1
}

async function runBattle(input: {
  caseId: number
  players: number // 2..4 total (you + bots)
  rounds: number // 1..3
}): Promise<BattleResult> {
  const userId = await requireUserId()
  const playerCount = Math.min(4, Math.max(2, Math.floor(input.players)))
  const rounds = Math.min(3, Math.max(1, Math.floor(input.rounds)))

  const caseRow = (await db.select().from(cases).where(eq(cases.id, input.caseId)).limit(1))[0]
  if (!caseRow) throw new Error("Case not found")
  if (caseRow.isFree) throw new Error("FREE_CASE_NOT_ALLOWED")
  const price = Number(caseRow.price)
  const entryCost = price * rounds

  const list = await db
    .select({
      weight: caseItems.weight,
      id: gifts.id,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      value: gifts.value,
    })
    .from(caseItems)
    .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
    .where(eq(caseItems.caseId, input.caseId))

  if (list.length === 0) throw new Error("Empty case")

  return db.transaction(async (tx) => {
    const u = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!u) throw new Error("Unauthorized")
    if (Number(u.balance) < entryCost) throw new Error("INSUFFICIENT_FUNDS")

    // Build players: slot 0 = you, rest = bots.
    const botNames = [...BOT_NAMES].sort(() => Math.random() - 0.5)
    const players: BattlePlayer[] = []
    for (let s = 0; s < playerCount; s++) {
      players.push({
        slot: s,
        name: s === 0 ? u.firstName || u.username || "You" : botNames[s - 1],
        photoUrl: s === 0 ? u.photoUrl : null,
        isBot: s !== 0,
        isYou: s === 0,
        pulls: [],
        total: 0,
      })
    }

    // Resolve pulls round-by-round for every player.
    for (let r = 0; r < rounds; r++) {
      for (const p of players) {
        const idx = weightedPick(list.map((i) => ({ weight: Number(i.weight) })))
        const g = list[idx]
        const gift: BattleGift = {
          id: g.id,
          name: g.name,
          rarity: g.rarity,
          imageUrl: g.imageUrl,
          value: Number(g.value),
        }
        p.pulls.push(gift)
        p.total += gift.value
      }
    }

    const pot = players.reduce((s, p) => s + p.total, 0)
    // Winner = highest total; tie-break favors lowest slot (you win ties).
    let winnerSlot = 0
    let best = -1
    for (const p of players) {
      if (p.total > best) {
        best = p.total
        winnerSlot = p.slot
      }
    }

    const youWon = winnerSlot === 0
    const youWinAmount = youWon ? pot : 0
    const balanceDelta = youWinAmount - entryCost

    const updated = await tx
      .update(users)
      .set({
        balance: sql`${users.balance} + ${balanceDelta}`,
        xp: sql`${users.xp} + ${entryCost}`,
      })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance })

    // Record for the live feed / history.
    const winner = players[winnerSlot]
    await tx.insert(gameHistory).values({
      userId,
      game: "battle",
      bet: String(entryCost),
      result: String(youWinAmount),
      meta: {
        caseName: caseRow.name,
        players: playerCount,
        rounds,
        winnerName: winner.name,
        winnerIsYou: youWon,
        pot,
      },
    })

    revalidatePath("/battles")
    revalidatePath("/profile")

    return {
      caseName: caseRow.name,
      coverUrl: caseRow.coverUrl,
      rounds,
      players,
      winnerSlot,
      pot,
      youWon,
      youWinAmount,
      balance: Number(updated[0].balance),
    }
  })
}

/* --------------------------- Live matchmaking --------------------------- */
// The first stake creates a public room. The second participant arms one
// shared 30-second deadline; everybody in that room sees the same result.

const MATCH_WINDOW_MS = 30_000
const UNARMED_ROOM_MS = 24 * 60 * 60 * 1000
const FIRST_OPPONENT_DELAY_MS = 5_000
const MAX_STAKE_PLAYERS = 4

function countdownStarted(room: { createdAt: Date; startsAt: Date }) {
  return room.startsAt.getTime() - room.createdAt.getTime() < 5 * 60 * 1000
}

export type MatchSlot = {
  slot: number
  name: string
  photoUrl: string | null
  isBot: boolean
  isYou: boolean
}

export type MatchState = {
  roomId: number
  status: "waiting" | "countdown" | "resolving" | "done"
  capacity: number
  rounds: number
  entryCost: number
  caseName: string
  secondsLeft: number | null
  slots: MatchSlot[]
  result: BattleResult | null
}

export async function joinBattle(input: {
  bet: number
  capacity?: number
  roomId?: number
}): Promise<{ roomId: number }> {
  const userId = await requireUserId()
  const capacity = MAX_STAKE_PLAYERS
  const entryCost = Math.round(Number(input.bet))
  const rounds = 1
  if (!Number.isFinite(entryCost) || entryCost < 10 || entryCost > 100_000) throw new Error("INVALID_BET")

  return db.transaction(async (tx) => {
    const u = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!u) throw new Error("Unauthorized")
    if (Number(u.balance) < entryCost) throw new Error("INSUFFICIENT_FUNDS")

    // Find an open room for the same params with a free slot.
    const now = new Date()
    const openRooms = await tx
      .select()
      .from(battleRooms)
      .where(
        and(
          eq(battleRooms.status, "waiting"),
          eq(battleRooms.caseId, 0),
          eq(battleRooms.capacity, capacity),
          eq(battleRooms.rounds, rounds),
          eq(battleRooms.entryCost, entryCost.toFixed(2)),
        ),
      )
      .orderBy(asc(battleRooms.createdAt))

    let roomId: number | null = null
    const orderedRooms = [...openRooms].sort((a, b) => Number(b.id === input.roomId) - Number(a.id === input.roomId))
    for (const room of orderedRooms) {
      if (input.roomId != null && room.id !== input.roomId) continue
      const slots = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, room.id))
      if (slots.some((s) => s.userId === userId)) return { roomId: room.id } // already queued
      if (countdownStarted(room) && room.startsAt.getTime() <= Date.now()) continue
      if (slots.length < room.capacity) {
        roomId = room.id
        break
      }
    }

    if (roomId === null && input.roomId != null) throw new Error("SESSION_CLOSED")

    if (roomId === null) {
      const created = await tx
        .insert(battleRooms)
        .values({
          caseId: 0,
          capacity,
          rounds,
          entryCost: entryCost.toFixed(2),
          status: "waiting",
          // The clock is intentionally unarmed. It starts only when a second
          // stake reaches this public room.
          startsAt: new Date(Date.now() + UNARMED_ROOM_MS),
        })
        .returning({ id: battleRooms.id })
      roomId = created[0].id
    }

    // Charge entry and take the lowest free slot.
    const charged = await tx
      .update(users)
      .set({ balance: sql`${users.balance} - ${entryCost}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${entryCost}`))
      .returning({ balance: users.balance })
    if (charged.length === 0) throw new Error("INSUFFICIENT_FUNDS")
    const taken = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
    const used = new Set(taken.map((s) => s.slot))
    let slot = 0
    while (used.has(slot)) slot++
    await tx.insert(battleSlots).values({
      roomId,
      slot,
      userId,
      name: u.firstName || u.username || "You",
      photoUrl: u.photoUrl,
      isBot: false,
    })

    const joined = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
    const currentRoom = (await tx.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
    if (joined.length >= 2 && currentRoom && !countdownStarted(currentRoom)) {
      await tx.update(battleRooms).set({ startsAt: new Date(Date.now() + MATCH_WINDOW_MS) }).where(eq(battleRooms.id, roomId))
    }

    return { roomId }
  })
}

export async function leaveBattle(roomId: number): Promise<void> {
  const userId = await requireUserId()
  await db.transaction(async (tx) => {
    const room = (await tx.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
    // A stake can be withdrawn only before the second player starts the clock.
    if (!room || room.status !== "waiting") return
    if (countdownStarted(room)) return
    const mine = (
      await tx
        .select()
        .from(battleSlots)
        .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.userId, userId)))
        .limit(1)
    )[0]
    if (!mine) return
    await tx.delete(battleSlots).where(eq(battleSlots.id, mine.id))
    await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${Number(room.entryCost)}` })
      .where(eq(users.id, userId))
    const remaining = await tx.select({ id: battleSlots.id }).from(battleSlots).where(eq(battleSlots.roomId, roomId))
    if (remaining.length === 0) {
      await tx.delete(battleRooms).where(eq(battleRooms.id, roomId))
      return
    }
  })
  revalidatePath("/battles")
}

export async function getMatchState(roomId: number): Promise<MatchState> {
  const userId = await requireUserId()
  const room = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  if (!room) throw new Error("Room not found")
  const caseRow = (await db.select().from(cases).where(eq(cases.id, room.caseId)).limit(1))[0]

  if (room.status === "waiting") {
    const elapsedMs = Math.max(0, Date.now() - room.createdAt.getTime())
    await maybeAddBots(roomId, room.capacity, elapsedMs, room)
    const afterBots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
    const afterRoom = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
    // Capacity never skips the advertised 30-second shared countdown.
    if (afterBots.length >= 2 && countdownStarted(afterRoom) && afterRoom.startsAt.getTime() <= Date.now()) {
      await resolveRoom(roomId)
    }
  }

  const fresh = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  const slots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId)).orderBy(asc(battleSlots.slot))

  return {
    roomId,
    status: fresh.status === "waiting" && countdownStarted(fresh) ? "countdown" : fresh.status as MatchState["status"],
    capacity: fresh.capacity,
    rounds: fresh.rounds,
    entryCost: Number(fresh.entryCost),
    caseName: room.caseId === 0 ? "Stars PvP" : caseRow?.name ?? "Case",
    secondsLeft: countdownStarted(fresh) ? Math.max(0, Math.ceil((fresh.startsAt.getTime() - Date.now()) / 1000)) : null,
    slots: slots.map((s) => ({
      slot: s.slot,
      name: s.name,
      photoUrl: s.photoUrl,
      isBot: s.isBot,
      isYou: s.userId === userId,
    })),
    result: fresh.status === "done" && fresh.result ? personalizeResult(fresh.result as StoredResult, userId) : null,
  }
}

async function maybeAddBots(roomId: number, capacity: number, elapsedMs: number, room: { createdAt: Date; startsAt: Date }) {
  const slots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
  const started = countdownStarted(room)
  const secondsLeft = started ? Math.max(0, Math.ceil((room.startsAt.getTime() - Date.now()) / 1000)) : null
  // parsed.txt opponents behave like public users: the first arrives after a
  // short wait and starts the same 30-second clock. Remaining seats stay open
  // for real people, then fill only near the end.
  let targetPlayers = slots.length
  if (!started && slots.length === 1 && elapsedMs >= FIRST_OPPONENT_DELAY_MS) targetPlayers = 2
  if (started && secondsLeft !== null && secondsLeft <= 12) targetPlayers = Math.max(targetPlayers, 3)
  if (started && secondsLeft !== null && secondsLeft <= 5) targetPlayers = capacity
  const botsShould = Math.max(0, targetPlayers - slots.filter((s) => !s.isBot).length)
  const currentBots = slots.filter((s) => s.isBot).length
  const free = capacity - slots.length
  const toAdd = Math.min(free, botsShould - currentBots)
  if (toAdd <= 0) return

  const usedNames = new Set(slots.map((s) => s.name))
  const names = (await getBotNames()).filter((n) => !usedNames.has(n)).sort(() => Math.random() - 0.5)
  const used = new Set(slots.map((s) => s.slot))
  for (let i = 0; i < toAdd; i++) {
    let slot = 0
    while (used.has(slot)) slot++
    used.add(slot)
    try {
      await db.insert(battleSlots).values({ roomId, slot, name: names[i] ?? `Practice ${slot + 1}`, isBot: true })
    } catch {
      // slot race — ignore
    }
  }
  const filled = await db.select({ id: battleSlots.id }).from(battleSlots).where(eq(battleSlots.roomId, roomId))
  if (filled.length >= 2 && !started) {
    await db.update(battleRooms).set({ startsAt: new Date(Date.now() + MATCH_WINDOW_MS) }).where(and(eq(battleRooms.id, roomId), eq(battleRooms.status, "waiting")))
  }
}

type StoredResult = {
  caseName: string
  coverUrl: string
  rounds: number
  pot: number
  winnerSlot: number
  players: (Omit<BattlePlayer, "isYou"> & { userId: string | null })[]
}

async function resolveRoom(roomId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Claim the room so only one caller resolves it.
    const claimed = await tx
      .update(battleRooms)
      .set({ status: "resolving" })
      .where(and(eq(battleRooms.id, roomId), eq(battleRooms.status, "waiting")))
      .returning()
    if (claimed.length === 0) return
    const room = claimed[0]

    const existing = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
    if (existing.length < 2) {
      await tx.update(battleRooms).set({ status: "waiting", startsAt: new Date(Date.now() + UNARMED_ROOM_MS) }).where(eq(battleRooms.id, roomId))
      return
    }

    const slots = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, roomId)).orderBy(asc(battleSlots.slot))
    const caseRow = (await tx.select().from(cases).where(eq(cases.id, room.caseId)).limit(1))[0]

    if (room.caseId === 0) {
      const entryCost = Number(room.entryCost)
      const playerCount = slots.length
      const grossBank = entryCost * playerCount
      // Equal-stake PvP with a 90% RTP: every occupied seat has the same
      // probability and the winner receives 90% of the shared bank.
      const payout = Math.max(entryCost, Math.floor(grossBank * 0.9))
      const players: StoredResult["players"] = slots.map((s) => ({
        slot: s.slot,
        name: s.name,
        photoUrl: s.photoUrl,
        isBot: s.isBot,
        userId: s.userId,
        pulls: [],
        total: entryCost,
      }))
      const winnerSlot = players[crypto.randomInt(players.length)].slot
      const winner = players.find((p) => p.slot === winnerSlot)!

      if (!winner.isBot && winner.userId) {
        await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, winner.userId))
      }
      for (const p of players) {
        if (p.isBot || !p.userId) continue
        const youWon = p.slot === winnerSlot
        await tx.update(users).set({ xp: sql`${users.xp} + ${entryCost}` }).where(eq(users.id, p.userId))
        await tx.insert(gameHistory).values({
          userId: p.userId,
          game: "battle",
          bet: String(entryCost),
          result: String(youWon ? payout : 0),
          meta: { roomId, mode: "stake", caseName: "Stars PvP", players: playerCount, rounds: 1, winnerName: winner.name, winnerIsYou: youWon, pot: payout, grossBank },
        })
      }
      const stored: StoredResult = { caseName: "Stars PvP", coverUrl: "", rounds: 1, pot: payout, winnerSlot, players }
      await tx.update(battleRooms).set({ status: "done", result: stored }).where(eq(battleRooms.id, roomId))
      return
    }

    const list = await tx
      .select({
        weight: caseItems.weight,
        id: gifts.id,
        name: gifts.name,
        rarity: gifts.rarity,
        imageUrl: gifts.imageUrl,
        value: gifts.value,
      })
      .from(caseItems)
      .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
      .where(eq(caseItems.caseId, room.caseId))

    const players: StoredResult["players"] = slots.map((s) => ({
      slot: s.slot,
      name: s.name,
      photoUrl: s.photoUrl,
      isBot: s.isBot,
      userId: s.userId,
      pulls: [],
      total: 0,
    }))

    for (let r = 0; r < room.rounds; r++) {
      for (const p of players) {
        const idx = weightedPick(list.map((i) => ({ weight: Number(i.weight) })))
        const g = list[idx]
        const gift: BattleGift = { id: g.id, name: g.name, rarity: g.rarity, imageUrl: g.imageUrl, value: Number(g.value) }
        p.pulls.push(gift)
        p.total += gift.value
      }
    }

    const pot = players.reduce((s, p) => s + p.total, 0)
    let winnerSlot = 0
    let best = -1
    for (const p of players) {
      if (p.total > best) {
        best = p.total
        winnerSlot = p.slot
      }
    }
    const winner = players.find((p) => p.slot === winnerSlot)!
    const entryCost = Number(room.entryCost)

    // Credit the winner (if a real player) with the whole pot.
    if (!winner.isBot && winner.userId) {
      await tx.update(users).set({ balance: sql`${users.balance} + ${pot}` }).where(eq(users.id, winner.userId))
    }

    // Award XP and record history for every real player.
    for (const p of players) {
      if (p.isBot || !p.userId) continue
      const youWon = p.slot === winnerSlot
      await tx.update(users).set({ xp: sql`${users.xp} + ${entryCost}` }).where(eq(users.id, p.userId))
      await tx.insert(gameHistory).values({
        userId: p.userId,
        game: "battle",
        bet: String(entryCost),
        result: String(youWon ? pot : 0),
        meta: {
          roomId,
          caseName: caseRow?.name ?? "Case",
          players: room.capacity,
          rounds: room.rounds,
          winnerName: winner.name,
          winnerIsYou: youWon,
          pot,
        },
      })
    }

    const stored: StoredResult = {
      caseName: caseRow?.name ?? "Case",
      coverUrl: caseRow?.coverUrl ?? "",
      rounds: room.rounds,
      pot,
      winnerSlot,
      players,
    }
    await tx.update(battleRooms).set({ status: "done", result: stored }).where(eq(battleRooms.id, roomId))
  })

  revalidatePath("/battles")
  revalidatePath("/profile")
}

function personalizeResult(stored: StoredResult, userId: string): BattleResult {
  const you = stored.players.find((p) => p.userId === userId)
  const youWon = you ? you.slot === stored.winnerSlot : false
  return {
    caseName: stored.caseName,
    coverUrl: stored.coverUrl,
    rounds: stored.rounds,
    players: stored.players.map((p) => ({
      slot: p.slot,
      name: p.name,
      photoUrl: p.photoUrl,
      isBot: p.isBot,
      isYou: p.userId === userId,
      pulls: p.pulls,
      total: p.total,
    })),
    winnerSlot: stored.winnerSlot,
    pot: stored.pot,
    youWon,
    youWinAmount: youWon ? stored.pot : 0,
    balance: 0,
  }
}

export type BattleSession = {
  roomId: number
  bet: number
  players: number
  capacity: number
  status: "waiting" | "countdown"
  secondsLeft: number | null
  names: string[]
}

export async function getBattleSessions(): Promise<BattleSession[]> {
  const rooms = await db
    .select()
    .from(battleRooms)
    .where(and(eq(battleRooms.status, "waiting"), eq(battleRooms.caseId, 0)))
    .orderBy(asc(battleRooms.createdAt))
    .limit(12)
  const now = Date.now()
  const sessions: BattleSession[] = []
  for (const room of rooms) {
    const slots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, room.id)).orderBy(asc(battleSlots.slot))
    if (slots.length === 0) continue
    const started = countdownStarted(room)
    if (started && room.startsAt.getTime() <= now) continue
    sessions.push({
      roomId: room.id,
      bet: Number(room.entryCost),
      players: slots.length,
      capacity: room.capacity,
      status: started ? "countdown" : "waiting",
      secondsLeft: started ? Math.max(0, Math.ceil((room.startsAt.getTime() - now) / 1000)) : null,
      names: slots.map((slot) => slot.name),
    })
  }
  return sessions
}

export async function getRecentBattles(): Promise<
  { id: number; caseName: string; winnerName: string; pot: number; players: number; youWon: boolean }[]
> {
  const rows = await db
    .select()
    .from(gameHistory)
    .where(eq(gameHistory.game, "battle"))
    .orderBy(desc(gameHistory.createdAt))
    .limit(40)
  const seen = new Set<number>()
  const out: { id: number; caseName: string; winnerName: string; pot: number; players: number; youWon: boolean }[] = []
  for (const r of rows) {
    const m = (r.meta ?? {}) as Record<string, unknown>
    // Multi-player rooms write one row per real player — dedupe by roomId.
    const roomId = m.roomId != null ? Number(m.roomId) : null
    if (roomId != null) {
      if (seen.has(roomId)) continue
      seen.add(roomId)
    }
    out.push({
      id: r.id,
      caseName: (m.caseName as string) ?? "Case",
      winnerName: (m.winnerName as string) ?? "Player",
      pot: Number(m.pot ?? 0),
      players: Number(m.players ?? 2),
      youWon: Boolean(m.winnerIsYou),
    })
    if (out.length >= 15) break
  }
  return out
}
