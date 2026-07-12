"use server"

import crypto from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users, gameHistory, inventory, gifts } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { multiplierAtElapsed } from "@/lib/crash-shared"

function crashSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "v0-local-crash-development-secret"
  throw new Error("SESSION_SECRET is required in production")
}

type RoundPayload = { userId: string; bet: number; crashPoint: number; startTime: number }

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

// For point = edge/(1-r) with anytime cashout the theoretical RTP equals `edge`.
// edge = 0.20 => RTP 20% (house edge 80%). No separate instabust needed: the
// formula already busts ~80% of rounds at 1.00x on its own.
function rollCrashPoint(edge = 0.2): number {
  const r = Math.random()
  const point = edge / (1 - r)
  return Math.max(1.0, Math.floor(point * 100) / 100)
}

export async function startCrash(bet: number): Promise<{
  token: string
  startTime: number
  balance: number
  crashPoint: number
}> {
  const userId = await requireUserId()
  if (!(bet > 0)) throw new Error("Invalid bet")

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

    const startTime = Date.now()
    const crashPoint = rollCrashPoint()
    const token = signRound({ userId, bet, crashPoint, startTime })

    return { token, startTime, balance: Number(updated[0].balance), crashPoint }
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

  const elapsed = Date.now() - round.startTime
  const current = multiplierAtElapsed(elapsed)
  const crashed = current >= round.crashPoint

  if (crashed) {
    await db.insert(gameHistory).values({
      userId,
      game: "crash",
      bet: String(round.bet),
      result: "0",
      meta: { crashPoint: round.crashPoint, cashedOut: false },
    })
    return {
      success: false,
      multiplier: round.crashPoint,
      crashPoint: round.crashPoint,
      payout: 0,
      balance: null,
    }
  }

  const mult = Math.min(current, round.crashPoint)
  const payout = Math.round(round.bet * mult * 100) / 100

  const updated = await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${payout}` })
    .where(eq(users.id, userId))
    .returning({ balance: users.balance })

  await db.insert(gameHistory).values({
    userId,
    game: "crash",
    bet: String(round.bet),
    result: String(payout),
    meta: { crashPoint: round.crashPoint, cashedOut: true, multiplier: mult },
  })

  return {
    success: true,
    multiplier: Math.round(mult * 100) / 100,
    crashPoint: round.crashPoint,
    payout,
    balance: Number(updated[0].balance),
  }
}

/** Settle a round that busted without the client cashing out (for history). */
export async function settleCrashBust(token: string): Promise<void> {
  const userId = await requireUserId()
  const round = verifyRound(token)
  if (!round || round.userId !== userId) return
  await db.insert(gameHistory).values({
    userId,
    game: "crash",
    bet: String(round.bet),
    result: "0",
    meta: { crashPoint: round.crashPoint, cashedOut: false },
  })
}

/* ----------------------------- Gift Crash ----------------------------- */
// Wager an owned NFT gift. The multiplier climbs; cashing out swaps your gift
// for a real gift whose value is closest to (staked value * multiplier).
// Busting loses the staked gift.

type GiftRound = { userId: string; inventoryId: number; stakeValue: number; crashPoint: number; startTime: number }

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
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
    })
    .from(inventory)
    .innerJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
    .orderBy(sql`${inventory.value} desc`)
  return rows.map((r) => ({ ...r, value: Number(r.value) }))
}

export async function startGiftCrash(inventoryId: number): Promise<{
  token: string
  startTime: number
  crashPoint: number
  stakeValue: number
}> {
  const userId = await requireUserId()
  return db.transaction(async (tx) => {
    const item = (
      await tx
        .select()
        .from(inventory)
        .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId), eq(inventory.status, "owned")))
        .limit(1)
    )[0]
    if (!item) throw new Error("Gift not found")

    // Lock the gift for the duration of the round.
    await tx.update(inventory).set({ status: "wagered" }).where(eq(inventory.id, inventoryId))

    const startTime = Date.now()
    // Same 20% RTP for gift crash (payout is a real NFT).
    const crashPoint = rollCrashPoint(0.2)
    const stakeValue = Number(item.value)
    const token = signGiftRound({ userId, inventoryId, stakeValue, crashPoint, startTime })
    return { token, startTime, crashPoint, stakeValue }
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

  const elapsed = Date.now() - round.startTime
  const current = multiplierAtElapsed(elapsed)

  if (current >= round.crashPoint) {
    // Bust — the wagered gift is lost.
    await db.update(inventory).set({ status: "lost" }).where(eq(inventory.id, round.inventoryId))
    await db.insert(gameHistory).values({
      userId,
      game: "crash",
      bet: String(round.stakeValue),
      result: "0",
      meta: { mode: "gift", crashPoint: round.crashPoint, cashedOut: false },
    })
    revalidatePath("/profile")
    return { success: false, multiplier: round.crashPoint, crashPoint: round.crashPoint, gift: null }
  }

  const mult = Math.min(current, round.crashPoint)
  const targetValue = round.stakeValue * mult

  return db.transaction(async (tx) => {
    // Pick the gift whose value is closest to (and not above) the target,
    // falling back to the cheapest gift if none qualify.
    const all = await tx.select().from(gifts)
    const affordable = all
      .filter((g) => Number(g.value) <= targetValue)
      .sort((a, b) => Number(b.value) - Number(a.value))
    const chosen = affordable[0] ?? all.sort((a, b) => Number(a.value) - Number(b.value))[0]
    if (!chosen) throw new Error("No gifts available")

    await tx
      .update(inventory)
      .set({ giftId: chosen.id, value: String(Number(chosen.value)), source: "crash", status: "owned" })
      .where(eq(inventory.id, round.inventoryId))

    await tx.insert(gameHistory).values({
      userId,
      game: "crash",
      bet: String(round.stakeValue),
      result: String(Number(chosen.value)),
      meta: { mode: "gift", crashPoint: round.crashPoint, cashedOut: true, multiplier: mult, giftName: chosen.name },
    })

    revalidatePath("/profile")
    return {
      success: true,
      multiplier: Math.round(mult * 100) / 100,
      crashPoint: round.crashPoint,
      gift: {
        id: chosen.id,
        name: chosen.name,
        rarity: chosen.rarity,
        imageUrl: chosen.imageUrl,
        value: Number(chosen.value),
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
  await db.insert(gameHistory).values({
    userId,
    game: "crash",
    bet: String(round.stakeValue),
    result: "0",
    meta: { mode: "gift", crashPoint: round.crashPoint, cashedOut: false },
  })
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
