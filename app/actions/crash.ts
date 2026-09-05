"use server"

import crypto from "crypto"
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { db } from "@/lib/db"
import { users, gameHistory, inventory, gifts } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { crashRoundPhase, CRASH_MAINTENANCE, CRASH_ROUND_MS, CRASH_BETTING_MS, multiplierAtElapsed, sharedFlightStart, sharedRoundId, sharedRoundStart } from "@/lib/crash-shared"
import { crashPointForRound as rollCrashPoint, crashSecret, getPublicCrashClock } from "@/lib/crash-server"
import { giftValueInStars } from "@/lib/pricing"
import { assertFreeCaseGiftUnlocked, getFreeCaseClaimStatus } from "@/lib/free-case-referrals"
import { notifyAdmins } from "@/lib/admin-notify"

type RoundPayload = { userId: string; bet: number; roundId: number; startTime: number; historyId: number }

function signRound(p: RoundPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url")
  const sig = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  return `${body}.${sig}`
}

function verifyRound(token: string): RoundPayload | null {
  if (typeof token !== "string" || token.length > 4096) return null
  const idx = token.lastIndexOf(".")
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const round = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RoundPayload
    return validRoundIdentity(round) && Number.isFinite(round.bet) && round.bet > 0 ? round : null
  } catch {
    return null
  }
}

function validRoundIdentity(round: RoundPayload | GiftRound): boolean {
  return Boolean(round && typeof round.userId === "string" && Number.isSafeInteger(round.historyId) && round.historyId > 0
    && Number.isSafeInteger(round.roundId) && round.roundId >= 0
    && round.startTime === round.roundId * CRASH_ROUND_MS + CRASH_BETTING_MS)
}

function assertBettingRound(roundId: number): void {
  const now = Date.now()
  if (sharedRoundId(now) !== roundId || crashRoundPhase(now) !== "betting") throw new Error("BETTING_CLOSED")
}

type HistoryMeta = Record<string, unknown>
function checkedHistoryMeta(row: typeof gameHistory.$inferSelect | undefined, round: RoundPayload | GiftRound, mode: "stars" | "gift"): HistoryMeta {
  const meta = (row?.meta ?? {}) as HistoryMeta
  if (!row || row.userId !== round.userId || row.game !== "crash" || Number(meta.roundId) !== round.roundId
    || (meta.mode ?? "stars") !== mode) throw new Error("Invalid round")
  return meta
}

export type CrashBoard = {
  serverTime: number
  roundId: number
  flightStart: number
  nextRoundAt: number
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
  let rows: { bet: string; result: string; meta: unknown; username: string | null; firstName: string | null }[] = []
  try {
    rows = await db
      .select({ bet: gameHistory.bet, result: gameHistory.result, meta: gameHistory.meta, username: users.username, firstName: users.firstName })
      .from(gameHistory)
      .innerJoin(users, eq(gameHistory.userId, users.id))
      .where(and(eq(gameHistory.game, "crash"), gte(gameHistory.createdAt, new Date(sharedRoundStart(now)))))
      .orderBy(desc(gameHistory.createdAt))
      .limit(60)
  } catch {
    // The board must still render during a transient database reconnect.
    // It will populate again on the next lightweight refresh.
  }
  // Snapshot time after the database query; a slow reconnect must not send a
  // seconds-old flight clock to clients. Player rows are filtered to that clock.
  const clock = getPublicCrashClock()
  const { roundId } = clock
  const crashed = clock.phase === "crashed"
  return {
    ...clock,
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
  }
}

export async function startCrash(bet: number): Promise<{
  token: string
  startTime: number
  balance: number
}> {
  if (CRASH_MAINTENANCE) throw new Error("CRASH_MAINTENANCE")
  const userId = await requireUserId()
  if (!Number.isFinite(bet) || !Number.isSafeInteger(Math.round(bet * 100))) throw new Error("Invalid bet")
  bet = Math.round(bet * 100) / 100
  if (!(bet > 0)) throw new Error("Invalid bet")
  const roundId = sharedRoundId()
  assertBettingRound(roundId)

  const result = await db.transaction(async (tx) => {
    assertBettingRound(roundId)
    const user = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!user) throw new Error("Unauthorized")
    if (Number(user.balance) < bet) throw new Error("INSUFFICIENT_FUNDS")

    const updated = await tx
      .update(users)
      .set({ balance: sql`${users.balance} - ${bet}` })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${bet}`))
      .returning({ balance: users.balance })

    if (updated.length === 0) throw new Error("INSUFFICIENT_FUNDS")

    // Reject and roll back the debit if a lock/connection wait passed launch.
    assertBettingRound(roundId)
    const startTime = roundId * CRASH_ROUND_MS + CRASH_BETTING_MS
    const history = await tx.insert(gameHistory).values({
      userId, game: "crash", bet: String(bet), result: "0", meta: { roundId, mode: "stars", status: "active" },
    }).returning({ id: gameHistory.id })
    const token = signRound({ userId, bet, roundId, startTime, historyId: history[0].id })

    return { token, startTime, balance: Number(updated[0].balance) }
  })
  after(() => notifyAdmins(`🚀 <b>Ставка Crash</b>\n\n👤 User: <code>${userId}</code>\n⭐ ${bet.toLocaleString("en-US")}\n🎮 Round: ${roundId}`))
  return result
}

export async function cashoutCrash(token: string): Promise<{
  success: boolean
  multiplier: number
  payout: number
  balance: number | null
}> {
  const requestedAt = Date.now()
  const userId = await requireUserId()
  const round = verifyRound(token)
  if (!round || round.userId !== userId) throw new Error("Invalid round")
  if (requestedAt < round.startTime) throw new Error("ROUND_NOT_STARTED")

  return db.transaction(async (tx) => {
    // The history row is the settlement lock: retries and simultaneous requests
    // return the original result, and the credit commits in the same transaction.
    const row = (await tx.select().from(gameHistory).where(eq(gameHistory.id, round.historyId)).limit(1).for("update"))[0]
    const meta = checkedHistoryMeta(row, round, "stars")
    if (meta.status === "cashed") {
      const user = (await tx.select({ balance: users.balance }).from(users).where(eq(users.id, userId)).limit(1))[0]
      return { success: true, multiplier: Math.round(Number(meta.multiplier) * 100) / 100, payout: Number(row.result), balance: user ? Number(user.balance) : null }
    }
    const point = rollCrashPoint(round.roundId)
    if (meta.status === "bust") return { success: false, multiplier: point, payout: 0, balance: null }
    if (meta.status !== "active") throw new Error("ROUND_NOT_ACTIVE")

    const current = multiplierAtElapsed(requestedAt - round.startTime)
    if (current >= point) {
      await tx.update(gameHistory).set({ result: "0", meta: { ...meta, crashPoint: point, status: "bust" } }).where(eq(gameHistory.id, row.id))
      return { success: false, multiplier: point, payout: 0, balance: null }
    }
    const payout = Math.round(Number(row.bet) * current * 100) / 100
    const updated = await tx.update(users).set({ balance: sql`${users.balance} + ${payout}` }).where(eq(users.id, userId)).returning({ balance: users.balance })
    if (!updated.length) throw new Error("Unauthorized")
    // Never save or return a future crash point with a successful cashout.
    await tx.update(gameHistory).set({ result: String(payout), meta: { ...meta, status: "cashed", multiplier: current } }).where(eq(gameHistory.id, row.id))
    return { success: true, multiplier: Math.round(current * 100) / 100, payout, balance: Number(updated[0].balance) }
  })
}

/** Settle a round that busted without the client cashing out (for history). */
export async function settleCrashBust(token: string): Promise<void> {
  const userId = await requireUserId()
  const round = verifyRound(token)
  if (!round || round.userId !== userId) return
  const point = rollCrashPoint(round.roundId)
  if (Date.now() < round.startTime || multiplierAtElapsed(Date.now() - round.startTime) < point) throw new Error("ROUND_NOT_FINISHED")
  await db.transaction(async (tx) => {
    const row = (await tx.select().from(gameHistory).where(eq(gameHistory.id, round.historyId)).limit(1).for("update"))[0]
    const meta = checkedHistoryMeta(row, round, "stars")
    if (meta.status !== "active") return
    await tx.update(gameHistory).set({ result: "0", meta: { ...meta, crashPoint: point, status: "bust" } }).where(eq(gameHistory.id, row.id))
  })
}

/* ----------------------------- Gift Crash ----------------------------- */
// Wager an owned NFT gift. The multiplier climbs; cashing out swaps your gift
// for a real gift whose value is closest to (staked value * multiplier).
// Busting loses the staked gift.

type GiftRound = {
  userId: string
  inventoryIds: number[]
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
  const claim = await getFreeCaseClaimStatus(userId, false)
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
    .where(and(
      eq(inventory.userId, userId),
      eq(inventory.status, "owned"),
      claim.ready ? sql`true` : sql`${inventory.source} <> 'free-case'`,
    ))
    .orderBy(sql`${inventory.value} desc`)
  return rows
    .map(({ floorTon, ...r }) => ({ ...r, value: giftValueInStars(r.value, floorTon) }))
    .sort((a, b) => b.value - a.value)
}

export async function startGiftCrash(inventoryIds: number[]): Promise<{
  token: string
  startTime: number
  stakeValue: number
}> {
  if (CRASH_MAINTENANCE) throw new Error("CRASH_MAINTENANCE")
  const userId = await requireUserId()
  const claim = await getFreeCaseClaimStatus(userId)
  const roundId = sharedRoundId()
  assertBettingRound(roundId)
  if (!Array.isArray(inventoryIds)) throw new Error("Choose valid gifts")
  const uniqueIds = [...new Set(inventoryIds.map(Number))]
  if (!uniqueIds.length || uniqueIds.length > 20 || uniqueIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Choose valid gifts")
  const result = await db.transaction(async (tx) => {
    assertBettingRound(roundId)
    const items = await tx
        .select({
          id: inventory.id,
          value: inventory.value,
          floorTon: gifts.floorTon,
          name: gifts.name,
          rarity: gifts.rarity,
          imageUrl: gifts.imageUrl,
          source: inventory.source,
        })
        .from(inventory)
        .innerJoin(gifts, eq(inventory.giftId, gifts.id))
        .where(and(inArray(inventory.id, uniqueIds), eq(inventory.userId, userId), eq(inventory.status, "owned")))
        .orderBy(inventory.id)
        .for("update", { of: inventory })
    if (items.length !== uniqueIds.length) throw new Error("One of the gifts is no longer available")
    items.forEach((item) => assertFreeCaseGiftUnlocked(item.source, claim.ready))
    const item = items[0]

    // Lock the gift for the duration of the round.
    const locked = await tx.update(inventory).set({ status: "wagered" })
      .where(and(inArray(inventory.id, uniqueIds), eq(inventory.userId, userId), eq(inventory.status, "owned")))
      .returning({ id: inventory.id })
    if (locked.length !== uniqueIds.length) throw new Error("One of the gifts is no longer available")

    assertBettingRound(roundId)
    const startTime = roundId * CRASH_ROUND_MS + CRASH_BETTING_MS
    // Gifts and Stars use the same authoritative shared crash point.
    const stakeValue = Math.round(items.reduce((sum, gift) => sum + giftValueInStars(gift.value, gift.floorTon), 0) * 100) / 100
    if (!Number.isFinite(stakeValue) || stakeValue <= 0) throw new Error("Invalid gift value")
    const history = await tx.insert(gameHistory).values({
      userId,
      game: "crash",
      bet: String(stakeValue),
      result: "0",
      meta: {
        roundId,
        mode: "gift",
        status: "active",
        giftName: items.length > 1 ? `${items.length} gifts` : item.name,
        giftImage: item.imageUrl,
        giftRarity: item.rarity,
      },
    }).returning({ id: gameHistory.id })
    const token = signGiftRound({
      userId,
      inventoryIds: uniqueIds,
      stakeValue,
      roundId,
      startTime,
      historyId: history[0].id,
      giftName: items.length > 1 ? `${items.length} gifts` : item.name,
      giftImage: item.imageUrl,
      giftRarity: item.rarity,
    })
    return { token, startTime, stakeValue }
  })
  after(() => notifyAdmins(`🚀 <b>Ставка Gift Crash</b>\n\n👤 User: <code>${userId}</code>\n🎁 ${uniqueIds.length} NFT\n⭐ ${result.stakeValue.toLocaleString("en-US")}`))
  return result
}

export async function cashoutGiftCrash(token: string): Promise<{
  success: boolean
  multiplier: number
  gift: OwnedGift | null
}> {
  const requestedAt = Date.now()
  const userId = await requireUserId()
  const round = verifyGiftRound(token)
  if (!round || round.userId !== userId) throw new Error("Invalid round")
  if (requestedAt < round.startTime) throw new Error("ROUND_NOT_STARTED")

  return db.transaction(async (tx) => {
    const row = (await tx.select().from(gameHistory).where(eq(gameHistory.id, round.historyId)).limit(1).for("update"))[0]
    const meta = checkedHistoryMeta(row, round, "gift")
    if (meta.status === "cashed") {
      const reward = meta.reward as OwnedGift | undefined
      return {
        success: true,
        multiplier: Math.round(Number(meta.multiplier) * 100) / 100,
        gift: reward ?? { id: round.inventoryIds[0], name: String(meta.giftName), imageUrl: String(meta.giftImage), rarity: String(meta.giftRarity), value: Number(row.result) },
      }
    }
    const point = rollCrashPoint(round.roundId)
    if (meta.status === "bust") return { success: false, multiplier: point, gift: null }
    if (meta.status !== "active") throw new Error("ROUND_NOT_ACTIVE")
    const locked = await tx.select().from(inventory)
      .where(and(inArray(inventory.id, round.inventoryIds), eq(inventory.userId, userId), eq(inventory.status, "wagered")))
      .orderBy(inventory.id).for("update")
    if (locked.length !== round.inventoryIds.length) throw new Error("ROUND_NOT_ACTIVE")

    const mult = multiplierAtElapsed(requestedAt - round.startTime)
    if (mult >= point) {
      await tx.update(inventory).set({ status: "lost" }).where(and(inArray(inventory.id, round.inventoryIds), eq(inventory.userId, userId), eq(inventory.status, "wagered")))
      await tx.update(gameHistory).set({ result: "0", meta: { ...meta, crashPoint: point, status: "bust" } }).where(eq(gameHistory.id, row.id))
      revalidatePath("/profile")
      return { success: false, multiplier: point, gift: null }
    }

    const targetValue = Number(row.bet) * mult
    // Never award a more expensive gift just because no catalogue floor fits.
    // A stale/missing catalogue leaves the wager unchanged and can be retried.
    const all = (await tx.select().from(gifts)).map((gift) => ({
      gift,
      value: giftValueInStars(gift.value, gift.floorTon),
    }))
    const affordable = all
      .filter((entry) => entry.value > 0 && entry.value <= targetValue)
      .sort((a, b) => b.value - a.value)
    const chosenEntry = affordable[0]
    if (!chosenEntry) throw new Error("NO_AFFORDABLE_GIFT")
    const chosen = chosenEntry.gift
    const chosenValue = chosenEntry.value

    await tx
      .update(inventory)
      .set({ giftId: chosen.id, value: String(chosenValue), source: "crash", status: "owned" })
      .where(and(eq(inventory.id, round.inventoryIds[0]), eq(inventory.userId, userId), eq(inventory.status, "wagered")))
    if (round.inventoryIds.length > 1) await tx.update(inventory).set({ status: "lost" }).where(and(inArray(inventory.id, round.inventoryIds.slice(1)), eq(inventory.userId, userId), eq(inventory.status, "wagered")))

    const reward = { id: round.inventoryIds[0], name: chosen.name, rarity: chosen.rarity, imageUrl: chosen.imageUrl, value: chosenValue }
    await tx.update(gameHistory).set({ result: String(chosenValue), meta: { ...meta, status: "cashed", multiplier: mult, giftName: chosen.name, giftImage: chosen.imageUrl, giftRarity: chosen.rarity, reward } }).where(eq(gameHistory.id, row.id))

    revalidatePath("/profile")
    return {
      success: true,
      multiplier: Math.round(mult * 100) / 100,
      gift: reward,
    }
  })
}

export async function settleGiftBust(token: string): Promise<void> {
  const userId = await requireUserId()
  const round = verifyGiftRound(token)
  if (!round || round.userId !== userId) return
  const point = rollCrashPoint(round.roundId)
  if (Date.now() < round.startTime || multiplierAtElapsed(Date.now() - round.startTime) < point) throw new Error("ROUND_NOT_FINISHED")
  await db.transaction(async (tx) => {
    const row = (await tx.select().from(gameHistory).where(eq(gameHistory.id, round.historyId)).limit(1).for("update"))[0]
    const meta = checkedHistoryMeta(row, round, "gift")
    if (meta.status !== "active") return
    const locked = await tx.select().from(inventory)
      .where(and(inArray(inventory.id, round.inventoryIds), eq(inventory.userId, userId), eq(inventory.status, "wagered")))
      .orderBy(inventory.id).for("update")
    if (locked.length !== round.inventoryIds.length) throw new Error("ROUND_NOT_ACTIVE")
    await tx.update(inventory).set({ status: "lost" }).where(and(inArray(inventory.id, round.inventoryIds), eq(inventory.userId, userId), eq(inventory.status, "wagered")))
    await tx.update(gameHistory).set({ result: "0", meta: { ...meta, crashPoint: point, status: "bust" } }).where(eq(gameHistory.id, row.id))
  })
  revalidatePath("/profile")
}

function signGiftRound(p: GiftRound): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url")
  const sig = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  return `${body}.${sig}`
}

function verifyGiftRound(token: string): GiftRound | null {
  if (typeof token !== "string" || token.length > 4096) return null
  const idx = token.lastIndexOf(".")
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = crypto.createHmac("sha256", crashSecret()).update(body).digest("hex").slice(0, 32)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const round = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GiftRound
    return validRoundIdentity(round) && Number.isFinite(round.stakeValue) && round.stakeValue > 0
      && Array.isArray(round.inventoryIds) && round.inventoryIds.length > 0 && round.inventoryIds.length <= 20
      && new Set(round.inventoryIds).size === round.inventoryIds.length
      && round.inventoryIds.every((id) => Number.isSafeInteger(id) && id > 0) ? round : null
  } catch {
    return null
  }
}
