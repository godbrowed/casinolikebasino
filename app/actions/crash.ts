"use server"

import crypto from "crypto"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, gameHistory, inventory, gifts } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { crashRoundPhase, CRASH_ROUND_MS, multiplierAtElapsed, sharedFlightStart, sharedRoundId, sharedRoundStart } from "@/lib/crash-shared"
import { crashPointForRound as rollCrashPoint, crashSecret } from "@/lib/crash-server"
import { giftValueInStars } from "@/lib/pricing"

type RoundPayload = { userId: string; bet: number; roundId: number; startTime: number; historyId: number }

function signRound(p: RoundPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url")
  const sig = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  return `${body}.${sig}`
}

function verifyRound(token: string): RoundPayload | null {
  const idx = token.lastIndexOf(".")
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export type CrashBoard = {
  roundId: number
  flightStart: number
  phase: "betting" | "flying" | "crashed"
  multiplier: number
  secondsLeft: number
  players: {
    name: string
    bet: number
    result: number
    status: "bet" | "cashed" | "bust"
    mode: "stars" | "gift"
    giftName?: string
    giftImage?: string
    giftRarity?: string
  }[]
  recent: { multiplier: number; won: boolean }[]
}

/** Public snapshot for the shared crash board. It deliberately never exposes
 * a future crash point: clients learn it only once the rocket has busted. */
export async function getCrashBoard(): Promise<CrashBoard> {
  const now = Date.now()
  const roundId = sharedRoundId(now)
  const flightStart = sharedFlightStart(now)
  const phase = crashRoundPhase(now)
  const point = rollCrashPoint(roundId)
  const current = phase === "betting" ? 1 : multiplierAtElapsed(now - flightStart)
  const crashed = phase === "flying" && current >= point
  let rows: { bet: string; result: string; meta: unknown; username: string | null; firstName: string | null }[] = []
  try {
    rows = await db
      .select({ bet: gameHistory.bet, result: gameHistory.result, meta: gameHistory.meta, username: users.username, firstName: users.firstName })
      .from(gameHistory)
      .innerJoin(users, eq(gameHistory.userId, users.id))
      .where(and(eq(gameHistory.game, "crash"), gte(gameHistory.createdAt, new Date(now - 24 * 60 * 60 * 1000))))
      .orderBy(desc(gameHistory.createdAt))
      .limit(80)
  } catch {
    // The board must still render during a transient database reconnect.
    // It will populate again on the next lightweight refresh.
  }
  return {
    roundId,
    flightStart,
    phase: crashed ? "crashed" : phase,
    multiplier: crashed ? point : Math.max(1, current),
    secondsLeft: Math.max(0, Math.ceil(((phase === "betting" ? flightStart : sharedRoundStart(now) + CRASH_ROUND_MS) - now) / 1000)),
    players: rows.filter((row) => Number((row.meta as Record<string, unknown> | null)?.roundId) === roundId).map((row) => {
      const meta = (row.meta ?? {}) as Record<string, unknown>
      const status = meta.status === "cashed" || meta.status === "bust" ? meta.status : crashed ? "bust" : "bet"
      return {
        name: row.username ? `@${row.username}` : row.firstName || "Player",
        bet: Number(row.bet),
        result: Number(row.result),
        status,
        mode: meta.mode === "gift" ? "gift" : "stars",
        giftName: typeof meta.giftName === "string" ? meta.giftName : undefined,
        giftImage: typeof meta.giftImage === "string" ? meta.giftImage : typeof meta.imageUrl === "string" ? meta.imageUrl : undefined,
        giftRarity: typeof meta.giftRarity === "string" ? meta.giftRarity : typeof meta.rarity === "string" ? meta.rarity : undefined,
      }
    }),
    // These are the actual deterministic results of completed shared rounds,
    // so history is present even when a round had no wagers. No fake LIVE
    // players or random client-only numbers are injected.
    recent: Array.from({ length: 18 }, (_, index) => {
      const latestCompleted = crashed ? roundId : roundId - 1
      const multiplier = rollCrashPoint(latestCompleted - index)
      return { multiplier, won: multiplier >= 2 }
    }),
  }
}

export async function startCrash(bet: number): Promise<{
  token: string
  startTime: number
  balance: number
}> {
  const userId = await requireUserId()
  if (!(bet > 0)) throw new Error("Invalid bet")
  if (crashRoundPhase() !== "betting") throw new Error("BETTING_CLOSED")

  return db.transaction(async (tx) => {
    const user = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!user) throw new Error("Unauthorized")
    if (Number(user.balance) < bet) throw new Error("INSUFFICIENT_FUNDS")

    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} - ${bet}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${bet}`))
      .returning({ balance: users.balance })

    if (updated.length === 0) throw new Error("INSUFFICIENT_FUNDS")

    const roundId = sharedRoundId()
    const startTime = sharedFlightStart()
    const history = await tx.insert(gameHistory).values({
      userId, game: "crash", bet: String(bet), result: "0", meta: { roundId, mode: "stars", status: "active" },
    }).returning({ id: gameHistory.id })
    const token = signRound({ userId, bet, roundId, startTime, historyId: history[0].id })

    return { token, startTime, balance: Number(updated[0].balance) }
  })
}

export async function cashoutCrash(token: string): Promise<{
  success: boolean
  multiplier: number
  crashPoint: number
  payout: number
  balance: number | null
}> {
  const userId = await requireUserId()
  const round = verifyRound(token)
  if (!round || round.userId !== userId) throw new Error("Invalid round")

  const crashPoint = rollCrashPoint(round.roundId)
  const elapsed = Date.now() - round.startTime
  const current = multiplierAtElapsed(elapsed)
  const crashed = current >= crashPoint

  if (crashed) {
    await db.update(gameHistory).set({ result: "0", meta: { roundId: round.roundId, crashPoint, status: "bust" } }).where(eq(gameHistory.id, round.historyId))
    return {
      success: false,
      multiplier: crashPoint,
      crashPoint,
      payout: 0,
      balance: null,
    }
  }

  const mult = Math.min(current, crashPoint)
  const payout = Math.round(round.bet * mult * 100) / 100

  const updated = await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${payout}` })
    .where(eq(users.id, userId))
    .returning({ balance: users.balance })

  await db.update(gameHistory).set({ result: String(payout), meta: { roundId: round.roundId, crashPoint, status: "cashed", multiplier: mult } }).where(eq(gameHistory.id, round.historyId))

  return {
    success: true,
    multiplier: Math.round(mult * 100) / 100,
    crashPoint,
    payout,
    balance: Number(updated[0].balance),
  }
}

/** Settle a round that busted without the client cashing out (for history). */
export async function settleCrashBust(token: string): Promise<void> {
  const userId = await requireUserId()
  const round = verifyRound(token)
  if (!round || round.userId !== userId) return
  await db.update(gameHistory).set({ result: "0", meta: { roundId: round.roundId, crashPoint: rollCrashPoint(round.roundId), status: "bust" } }).where(eq(gameHistory.id, round.historyId))
}

/* ----------------------------- Gift Crash ----------------------------- */
// Wager an owned NFT gift. The multiplier climbs; cashing out swaps your gift
// for a real gift whose value is closest to (staked value * multiplier).
// Busting loses the staked gift.

type GiftRound = {
  userId: string
  inventoryId: number
  stakeValue: number
  roundId: number
  startTime: number
  historyId: number
  giftName: string
  giftImage: string
  giftRarity: string
}

export type OwnedGift = {
  id: number
  name: string
  rarity: string
  imageUrl: string
  value: number
}

/** A handful of gift images for the rocket's floating collectibles (decorative). */
export async function getGiftImages(): Promise<string[]> {
  const rows = await db
    .select({ imageUrl: gifts.imageUrl })
    .from(gifts)
    .orderBy(sql`${gifts.value} desc`)
    .limit(5)
  return rows.map((r) => r.imageUrl)
}

export async function getCrashGifts(): Promise<OwnedGift[]> {
  const userId = await requireUserId()
  const rows = await db
    .select({
      id: inventory.id,
      value: inventory.value,
      floorTon: gifts.floorTon,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
    })
    .from(inventory)
    .innerJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
    .orderBy(sql`${inventory.value} desc`)
  return rows
    .map(({ floorTon, ...r }) => ({ ...r, value: giftValueInStars(r.value, floorTon) }))
    .sort((a, b) => b.value - a.value)
}

export async function startGiftCrash(inventoryId: number): Promise<{
  token: string
  startTime: number
  stakeValue: number
}> {
  const userId = await requireUserId()
  if (crashRoundPhase() !== "betting") throw new Error("BETTING_CLOSED")
  return db.transaction(async (tx) => {
    const item = (
      await tx
        .select({
          id: inventory.id,
          value: inventory.value,
          floorTon: gifts.floorTon,
          name: gifts.name,
          rarity: gifts.rarity,
          imageUrl: gifts.imageUrl,
        })
        .from(inventory)
        .innerJoin(gifts, eq(inventory.giftId, gifts.id))
        .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId), eq(inventory.status, "owned")))
        .limit(1)
    )[0]
    if (!item) throw new Error("Gift not found")

    // Lock the gift for the duration of the round.
    await tx.update(inventory).set({ status: "wagered" }).where(eq(inventory.id, inventoryId))

    const startTime = sharedFlightStart()
    // Same 90% RTP for gift crash (payout is a real NFT).
    const roundId = sharedRoundId()
    const stakeValue = giftValueInStars(item.value, item.floorTon)
    const history = await tx.insert(gameHistory).values({
      userId,
      game: "crash",
      bet: String(stakeValue),
      result: "0",
      meta: {
        roundId,
        mode: "gift",
        status: "active",
        giftName: item.name,
        giftImage: item.imageUrl,
        giftRarity: item.rarity,
      },
    }).returning({ id: gameHistory.id })
    const token = signGiftRound({
      userId,
      inventoryId,
      stakeValue,
      roundId,
      startTime,
      historyId: history[0].id,
      giftName: item.name,
      giftImage: item.imageUrl,
      giftRarity: item.rarity,
    })
    return { token, startTime, stakeValue }
  })
}

export async function cashoutGiftCrash(token: string): Promise<{
  success: boolean
  multiplier: number
  crashPoint: number
  gift: OwnedGift | null
}> {
  const userId = await requireUserId()
  const round = verifyGiftRound(token)
  if (!round || round.userId !== userId) throw new Error("Invalid round")

  const crashPoint = rollCrashPoint(round.roundId)
  const elapsed = Date.now() - round.startTime
  const current = multiplierAtElapsed(elapsed)

  if (current >= crashPoint) {
    // Bust — the wagered gift is lost.
    await db.update(inventory).set({ status: "lost" }).where(eq(inventory.id, round.inventoryId))
    await db.update(gameHistory).set({ result: "0", meta: { roundId: round.roundId, mode: "gift", crashPoint, status: "bust", giftName: round.giftName, giftImage: round.giftImage, giftRarity: round.giftRarity } }).where(eq(gameHistory.id, round.historyId))
    revalidatePath("/profile")
    return { success: false, multiplier: crashPoint, crashPoint, gift: null }
  }

  const mult = Math.min(current, crashPoint)
  const targetValue = round.stakeValue * mult

  return db.transaction(async (tx) => {
    // Pick the gift whose value is closest to (and not above) the target,
    // falling back to the cheapest gift if none qualify.
    const all = (await tx.select().from(gifts)).map((gift) => ({
      gift,
      value: giftValueInStars(gift.value, gift.floorTon),
    }))
    const affordable = all
      .filter((entry) => entry.value <= targetValue)
      .sort((a, b) => b.value - a.value)
    const chosenEntry = affordable[0] ?? all.sort((a, b) => a.value - b.value)[0]
    if (!chosenEntry) throw new Error("No gifts available")
    const chosen = chosenEntry.gift
    const chosenValue = chosenEntry.value

    await tx
      .update(inventory)
      .set({ giftId: chosen.id, value: String(chosenValue), source: "crash", status: "owned" })
      .where(eq(inventory.id, round.inventoryId))

    await tx.update(gameHistory).set({ result: String(chosenValue), meta: { roundId: round.roundId, mode: "gift", crashPoint, status: "cashed", multiplier: mult, giftName: chosen.name, giftImage: chosen.imageUrl, giftRarity: chosen.rarity } }).where(eq(gameHistory.id, round.historyId))

    revalidatePath("/profile")
    return {
      success: true,
      multiplier: Math.round(mult * 100) / 100,
      crashPoint,
      gift: {
        id: chosen.id,
        name: chosen.name,
        rarity: chosen.rarity,
        imageUrl: chosen.imageUrl,
        value: chosenValue,
      },
    }
  })
}

export async function settleGiftBust(token: string): Promise<void> {
  const userId = await requireUserId()
  const round = verifyGiftRound(token)
  if (!round || round.userId !== userId) return
  // Only lose it if still wagered (avoid double-settle after cashout).
  const item = (
    await db.select().from(inventory).where(eq(inventory.id, round.inventoryId)).limit(1)
  )[0]
  if (!item || item.status !== "wagered") return
  await db.update(inventory).set({ status: "lost" }).where(eq(inventory.id, round.inventoryId))
  await db.update(gameHistory).set({ result: "0", meta: { roundId: round.roundId, mode: "gift", crashPoint: rollCrashPoint(round.roundId), status: "bust", giftName: round.giftName, giftImage: round.giftImage, giftRarity: round.giftRarity } }).where(eq(gameHistory.id, round.historyId))
  revalidatePath("/profile")
}

function signGiftRound(p: GiftRound): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url")
  const sig = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  return `${body}.${sig}`
}

function verifyGiftRound(token: string): GiftRound | null {
  const idx = token.lastIndexOf(".")
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return null
  }
}
