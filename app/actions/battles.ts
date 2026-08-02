"use server"

import { eq, sql, desc, and, gt, lte, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { cases, caseItems, gifts, users, gameHistory, battleRooms, battleSlots } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"

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
// Players join a shared room. It resolves only after every seat is occupied
// by a real player; queued players can leave and receive a refund beforehand.

const MATCH_WINDOW_MS = 30_000
// Retained for backwards-compatible settlement code; matchmaking never calls it.
const BOT_INTERVAL_MS = 6_000

export type MatchSlot = {
  slot: number
  name: string
  photoUrl: string | null
  isBot: boolean
  isYou: boolean
}

export type MatchState = {
  roomId: number
  status: "waiting" | "resolving" | "done"
  capacity: number
  rounds: number
  entryCost: number
  caseName: string
  secondsLeft: number
  slots: MatchSlot[]
  result: BattleResult | null
}

export async function joinBattle(input: {
  caseId: number
  capacity: number
  rounds: number
}): Promise<{ roomId: number }> {
  const userId = await requireUserId()
  const capacity = Math.min(4, Math.max(2, Math.floor(input.capacity)))
  const rounds = Math.min(3, Math.max(1, Math.floor(input.rounds)))

  const caseRow = (await db.select().from(cases).where(eq(cases.id, input.caseId)).limit(1))[0]
  if (!caseRow) throw new Error("Case not found")
  if (caseRow.isFree) throw new Error("FREE_CASE_NOT_ALLOWED")
  const caseHasItems = await db
    .select({ id: caseItems.id })
    .from(caseItems)
    .where(eq(caseItems.caseId, input.caseId))
    .limit(1)
  if (caseHasItems.length === 0) throw new Error("EMPTY_CASE")
  const entryCost = Number(caseRow.price) * rounds

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
          eq(battleRooms.caseId, input.caseId),
          eq(battleRooms.capacity, capacity),
          eq(battleRooms.rounds, rounds),
        ),
      )
      .orderBy(asc(battleRooms.createdAt))

    let roomId: number | null = null
    for (const room of openRooms) {
      const slots = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, room.id))
      if (slots.some((s) => s.userId === userId)) return { roomId: room.id } // already queued
      if (slots.length < room.capacity) {
        roomId = room.id
        break
      }
    }

    if (roomId === null) {
      const created = await tx
        .insert(battleRooms)
        .values({
          caseId: input.caseId,
          capacity,
          rounds,
          entryCost: entryCost.toFixed(2),
          status: "waiting",
          startsAt: new Date(Date.now() + MATCH_WINDOW_MS),
        })
        .returning({ id: battleRooms.id })
      roomId = created[0].id
    }

    // Charge entry and take the lowest free slot.
    await tx.update(users).set({ balance: sql`${users.balance} - ${entryCost}` }).where(eq(users.id, userId))
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

    return { roomId }
  })
}

export async function leaveBattle(roomId: number): Promise<void> {
  const userId = await requireUserId()
  await db.transaction(async (tx) => {
    const room = (await tx.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
    // Only allow leaving (and refunding) while the room is still open.
    if (!room || room.status !== "waiting") return
    const mine = (
      await tx
        .select()
        .from(battleSlots)
        .where(and(eq(battleSlots.roomId, roomId), eq(battleSlots.userId, userId)))
        .limit(1)
    )[0]
    if (!mine) return
    await tx.delete(battleSlots).where(eq(battleSlots.id, mine.id))
    const remaining = await tx.select({ id: battleSlots.id }).from(battleSlots).where(eq(battleSlots.roomId, roomId))
    if (remaining.length === 0) {
      await tx.delete(battleRooms).where(eq(battleRooms.id, roomId))
      return
    }
    await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${Number(room.entryCost)}` })
      .where(eq(users.id, userId))
  })
  revalidatePath("/battles")
}

export async function getMatchState(roomId: number): Promise<MatchState> {
  const userId = await requireUserId()
  const room = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  if (!room) throw new Error("Room not found")
  const caseRow = (await db.select().from(cases).where(eq(cases.id, room.caseId)).limit(1))[0]

  if (room.status === "waiting") {
    const current = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
    if (current.length >= room.capacity) {
      await resolveRoom(roomId)
    }
  }

  const fresh = (await db.select().from(battleRooms).where(eq(battleRooms.id, roomId)).limit(1))[0]
  const slots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId)).orderBy(asc(battleSlots.slot))

  return {
    roomId,
    status: fresh.status as MatchState["status"],
    capacity: fresh.capacity,
    rounds: fresh.rounds,
    entryCost: Number(fresh.entryCost),
    caseName: caseRow?.name ?? "Case",
    secondsLeft: Math.max(0, Math.ceil((fresh.startsAt.getTime() - Date.now()) / 1000)),
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

async function maybeAddBots(roomId: number, capacity: number, elapsedMs: number) {
  // Keep one seat open for a real opponent during the search window; the final
  // seat is backfilled by resolveRoom at the deadline if nobody joins.
  const maxBotsNow = Math.max(0, capacity - 1)
  const botsShould = Math.min(maxBotsNow, Math.floor(elapsedMs / BOT_INTERVAL_MS))
  const slots = await db.select().from(battleSlots).where(eq(battleSlots.roomId, roomId))
  const currentBots = slots.filter((s) => s.isBot).length
  const free = capacity - slots.length
  const toAdd = Math.min(free, botsShould - currentBots)
  if (toAdd <= 0) return

  const usedNames = new Set(slots.map((s) => s.name))
  const names = BOT_NAMES.filter((n) => !usedNames.has(n)).sort(() => Math.random() - 0.5)
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
    if (existing.length < room.capacity) {
      // A concurrent leave can race with resolution. Reopen instead of ever
      // manufacturing an opponent.
      await tx.update(battleRooms).set({ status: "waiting" }).where(eq(battleRooms.id, roomId))
      return
    }

    const slots = await tx.select().from(battleSlots).where(eq(battleSlots.roomId, roomId)).orderBy(asc(battleSlots.slot))
    const caseRow = (await tx.select().from(cases).where(eq(cases.id, room.caseId)).limit(1))[0]

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
