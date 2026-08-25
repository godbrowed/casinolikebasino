"use server"

import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { cases, caseItems, gifts, users, inventory, gameHistory } from "@/lib/db/schema"
import { getCurrentUserId, requireUserId } from "@/lib/session"
import { BALANCE_REWARD_MAX_CASE_PRICE, giftValueInStars, priceFromContents } from "@/lib/pricing"

export type GiftDTO = {
  id: number
  slug: string
  name: string
  rarity: string
  imageUrl: string
  value: number
  floorTon?: number
  weight?: number
  rewardType?: "gift" | "currency"
}

export type CaseDTO = {
  id: number
  slug: string
  name: string
  coverUrl: string
  price: number
  accent: string
  isFree: boolean
  cooldownHours: number | null
  nextFreeAt: string | null
  items: GiftDTO[]
}

// Currency payouts are deliberately limited to entry-level cases. Higher-tier
// cases settle in gifts only, keeping their economy predictable.
const CURRENCY_CASE_LIMIT = BALANCE_REWARD_MAX_CASE_PRICE

function starValue(value: string | number, floorTon: string | number | null | undefined): number {
  return giftValueInStars(value, floorTon)
}

function currencyRewards(price: number): GiftDTO[] {
  if (price > CURRENCY_CASE_LIMIT) return []
  return [
    { id: -101, slug: `stars-small-${price}`, name: `${Math.round(price * 0.1)} Stars`, rarity: "common", imageUrl: "/images/puggift-star.svg", value: price * 0.1, rewardType: "currency" },
    { id: -102, slug: `stars-medium-${price}`, name: `${Math.round(price * 0.25)} Stars`, rarity: "rare", imageUrl: "/images/puggift-star.svg", value: price * 0.25, rewardType: "currency" },
    { id: -103, slug: `stars-large-${price}`, name: `${Math.round(price * 0.5)} Stars`, rarity: "epic", imageUrl: "/images/puggift-star.svg", value: price * 0.5, rewardType: "currency" },
    { id: -104, slug: `stars-jackpot-${price}`, name: `${Math.round(price)} Stars`, rarity: "legendary", imageUrl: "/images/puggift-star.svg", value: price, rewardType: "currency" },
  ]
}

const FREE_CURRENCY_REWARDS: GiftDTO[] = [
  { id: -1, slug: "stars-2", name: "2 Stars", rarity: "common", imageUrl: "/images/puggift-star.svg", value: 2, rewardType: "currency" },
  { id: -2, slug: "stars-5", name: "5 Stars", rarity: "common", imageUrl: "/images/puggift-star.svg", value: 5, rewardType: "currency" },
  { id: -3, slug: "stars-10", name: "10 Stars", rarity: "rare", imageUrl: "/images/puggift-star.svg", value: 10, rewardType: "currency" },
  { id: -4, slug: "stars-25", name: "25 Stars", rarity: "epic", imageUrl: "/images/puggift-star.svg", value: 25, rewardType: "currency" },
  { id: -5, slug: "stars-50", name: "50 Stars", rarity: "legendary", imageUrl: "/images/puggift-star.svg", value: 50, rewardType: "currency" },
  { id: -6, slug: "stars-100", name: "100 Stars", rarity: "mythic", imageUrl: "/images/puggift-star.svg", value: 100, rewardType: "currency" },
]

export async function getCases(): Promise<CaseDTO[]> {
  const userId = await getCurrentUserId()
  const [rows, userRows] = await Promise.all([
    db.select().from(cases).orderBy(asc(cases.sortOrder)),
    userId
      ? db.select({ lastFreeCaseAt: users.lastFreeCaseAt }).from(users).where(eq(users.id, userId)).limit(1)
      : Promise.resolve([]),
  ])
  const lastFreeCaseAt = userRows[0]?.lastFreeCaseAt ?? null
  const items = await db
    .select({
      caseId: caseItems.caseId,
      weight: caseItems.weight,
      id: gifts.id,
      slug: gifts.slug,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      value: gifts.value,
      floorTon: gifts.floorTon,
    })
    .from(caseItems)
    .innerJoin(gifts, eq(caseItems.giftId, gifts.id))

  return rows.map((c) => {
    const list = items.filter((i) => i.caseId === c.id)
    const livePrice = c.isFree ? 0 : priceFromContents(list.map((i) => ({ weight: Number(i.weight), value: starValue(i.value, i.floorTon) })))
    const nextFreeAt = c.isFree && lastFreeCaseAt
      ? new Date(lastFreeCaseAt.getTime() + (c.cooldownHours ?? 24) * 60 * 60 * 1000).toISOString()
      : null
    return {
      id: c.id,
      slug: c.slug,
      name: c.isFree ? "Free Case" : c.name,
      coverUrl: c.isFree ? "/images/giftlys-free-case.png" : c.coverUrl,
      price: livePrice || Number(c.price),
      accent: c.accent,
      isFree: c.isFree,
      cooldownHours: c.cooldownHours,
      nextFreeAt,
      items: c.isFree
        ? [
            { id: 37, slug: "snakebox", name: "Snake Box NFT", rarity: "mythic", imageUrl: "https://storage.portal-market.com/portals-market/gifts/snakebox/models/png/aquarium.png", value: 280, rewardType: "gift" as const },
            ...FREE_CURRENCY_REWARDS,
          ]
        : [
          ...list
        .map((i) => ({
          id: i.id,
          slug: i.slug,
          name: i.name,
          rarity: i.rarity,
          imageUrl: i.imageUrl,
          value: starValue(i.value, i.floorTon),
          floorTon: Number(i.floorTon),
          weight: Number(i.weight),
          rewardType: "gift" as const,
        }))
        .sort((a, b) => b.value - a.value),
          ...currencyRewards(livePrice || Number(c.price)),
        ],
    }
  })
}

export async function getCaseBySlug(slug: string): Promise<CaseDTO | null> {
  const all = await getCases()
  return all.find((c) => c.slug === slug) ?? null
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

export async function openCase(caseId: number): Promise<{
  won: GiftDTO
  balance: number
  inventoryId: number | null
}> {
  const userId = await requireUserId()

  const caseRow = (await db.select().from(cases).where(eq(cases.id, caseId)).limit(1))[0]
  if (!caseRow) throw new Error("Case not found")
  const list = await db
    .select({
      weight: caseItems.weight,
      id: gifts.id,
      slug: gifts.slug,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      value: gifts.value,
      floorTon: gifts.floorTon,
    })
    .from(caseItems)
    .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
    .where(eq(caseItems.caseId, caseId))

  const price = caseRow.isFree ? 0 : priceFromContents(list.map((item) => ({ weight: Number(item.weight), value: starValue(item.value, item.floorTon) }))) || Number(caseRow.price)

  if (!caseRow.isFree && list.length === 0) throw new Error("Empty case")

  return db.transaction(async (tx) => {
    const userRows = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = userRows[0]
    if (!user) throw new Error("Unauthorized")

    if (caseRow.isFree) {
      const now = new Date()
      const cooldownMs = (caseRow.cooldownHours ?? 24) * 60 * 60 * 1000
      const eligibleBefore = new Date(now.getTime() - cooldownMs)
      const roll = crypto.randomInt(10_000)
      const currencyValue = roll < 4500 ? 2 : roll < 7500 ? 5 : roll < 9000 ? 10 : roll < 9700 ? 25 : roll < 9900 ? 50 : 100
      const wonGift = roll >= 9980

      if (wonGift) {
        const giftRows = await tx.select().from(gifts).where(eq(gifts.id, 37)).limit(1)
        const gift = giftRows[0]
        if (gift) {
          const giftWinValue = starValue(gift.value, gift.floorTon)
          const claimed = await tx
            .update(users)
            .set({ lastFreeCaseAt: now })
            .where(and(eq(users.id, userId), or(isNull(users.lastFreeCaseAt), lte(users.lastFreeCaseAt, eligibleBefore))))
            .returning({ balance: users.balance })
          if (claimed.length === 0) throw new Error("FREE_CASE_COOLDOWN")
          const inv = await tx.insert(inventory).values({ userId, giftId: gift.id, value: String(giftWinValue), source: "free-case" }).returning({ id: inventory.id })
          await tx.insert(gameHistory).values({
            userId,
            game: "case",
            bet: "0",
            result: String(giftWinValue),
            meta: { caseName: caseRow.name, giftName: gift.name, rarity: gift.rarity, imageUrl: gift.imageUrl, rewardType: "gift" },
          })
          return {
            won: { id: gift.id, slug: gift.slug, name: gift.name, rarity: gift.rarity, imageUrl: gift.imageUrl, value: giftWinValue, rewardType: "gift" },
            balance: Number(claimed[0].balance),
            inventoryId: inv[0].id,
          }
        }
      }

      const updated = await tx
        .update(users)
        .set({ balance: sql`${users.balance} + ${currencyValue}`, lastFreeCaseAt: now })
        .where(and(eq(users.id, userId), or(isNull(users.lastFreeCaseAt), lte(users.lastFreeCaseAt, eligibleBefore))))
        .returning({ balance: users.balance })
      if (updated.length === 0) throw new Error("FREE_CASE_COOLDOWN")
      const won: GiftDTO = {
        id: -currencyValue,
        slug: `stars-${currencyValue}`,
        name: `${currencyValue} Stars`,
        rarity: currencyValue >= 0.25 ? "rare" : "common",
        imageUrl: "/images/puggift-star.svg",
        value: currencyValue,
        rewardType: "currency",
      }
      await tx.insert(gameHistory).values({
        userId,
        game: "case",
        bet: "0",
        result: String(currencyValue),
        meta: { caseName: caseRow.name, giftName: won.name, rarity: won.rarity, imageUrl: won.imageUrl, rewardType: "currency" },
      })
      revalidatePath("/")
      return { won, balance: Number(updated[0].balance), inventoryId: null }
    }

    if (Number(user.balance) < price) throw new Error("INSUFFICIENT_FUNDS")

    const rewardRoll = crypto.randomInt(10_000)
    const isCurrencyReward = price <= CURRENCY_CASE_LIMIT && rewardRoll < 4000
    const currencyValue = rewardRoll < 2000
      ? price * 0.1
      : rewardRoll < 3200
        ? price * 0.25
        : rewardRoll < 3800
          ? price * 0.5
          : price

    const idx = weightedPick(list.map((i) => ({ weight: Number(i.weight) })))
    const won = list[idx]
    const wonValue = starValue(won.value, won.floorTon)

    const updated = await tx
      .update(users)
      .set({
        balance: isCurrencyReward
          ? sql`${users.balance} - ${price} + ${currencyValue}`
          : sql`${users.balance} - ${price}`,
        xp: sql`${users.xp} + ${price}`,
      })
      .where(and(eq(users.id, userId), sql`${users.balance} >= ${price}`))
      .returning({ balance: users.balance })

    if (updated.length === 0) throw new Error("INSUFFICIENT_FUNDS")

    if (isCurrencyReward) {
      const currencyWon: GiftDTO = {
        id: -1000 - currencyValue,
        slug: `stars-${currencyValue}`,
        name: `${Math.round(currencyValue)} Stars`,
        rarity: currencyValue >= price ? "legendary" : currencyValue >= price * 0.5 ? "epic" : currencyValue >= price * 0.25 ? "rare" : "common",
        imageUrl: "/images/puggift-star.svg",
        value: currencyValue,
        rewardType: "currency",
      }
      await tx.insert(gameHistory).values({
        userId,
        game: "case",
        bet: String(price),
        result: String(currencyValue),
        meta: { caseName: caseRow.name, giftName: currencyWon.name, rarity: currencyWon.rarity, imageUrl: currencyWon.imageUrl, rewardType: "currency" },
      })
      revalidatePath("/")
      return { won: currencyWon, balance: Number(updated[0].balance), inventoryId: null }
    }

    const inv = await tx
      .insert(inventory)
      .values({ userId, giftId: won.id, value: String(wonValue), source: "case" })
      .returning({ id: inventory.id })

    await tx.insert(gameHistory).values({
      userId,
      game: "case",
      bet: String(price),
      result: String(wonValue),
      meta: { caseName: caseRow.name, giftName: won.name, rarity: won.rarity, imageUrl: won.imageUrl },
    })

    revalidatePath("/profile")

    return {
      won: {
        id: won.id,
        slug: won.slug,
        name: won.name,
        rarity: won.rarity,
        imageUrl: won.imageUrl,
        value: wonValue,
        rewardType: "gift",
      },
      balance: Number(updated[0].balance),
      inventoryId: inv[0].id,
    }
  })
}

/** Open up to five paid cases in one user action. Each item uses the same
 * authoritative settlement as a normal single opening. */
export async function openCases(caseId: number, count: number): Promise<{
  results: { won: GiftDTO; inventoryId: number | null }[]
  balance: number
}> {
  const safeCount = Math.max(1, Math.min(5, Math.floor(count)))
  if (safeCount > 1) {
    const [caseRow, userId] = await Promise.all([
      db.select().from(cases).where(eq(cases.id, caseId)).limit(1).then((rows) => rows[0]),
      requireUserId(),
    ])
    if (!caseRow) throw new Error("Case not found")
    const list = await db
      .select({ weight: caseItems.weight, value: gifts.value, floorTon: gifts.floorTon })
      .from(caseItems)
      .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
      .where(eq(caseItems.caseId, caseId))
    const unitPrice = priceFromContents(list.map((item) => ({ weight: Number(item.weight), value: starValue(item.value, item.floorTon) }))) || Number(caseRow.price)
    const user = (await db.select({ balance: users.balance }).from(users).where(eq(users.id, userId)).limit(1))[0]
    if (!user || Number(user.balance) < unitPrice * safeCount) throw new Error("INSUFFICIENT_FUNDS")
  }
  const results: { won: GiftDTO; inventoryId: number | null }[] = []
  let balance = 0
  for (let i = 0; i < safeCount; i++) {
    const opened = await openCase(caseId)
    results.push({ won: opened.won, inventoryId: opened.inventoryId })
    balance = opened.balance
  }
  return { results, balance }
}

export async function getHomeStats(): Promise<{ online: number; wonToday: number }> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [rows, activeUsers] = await Promise.all([
    db
    .select({ total: sql<string>`coalesce(sum(${gameHistory.result}), 0)` })
    .from(gameHistory)
    .where(sql`${gameHistory.createdAt} >= ${startOfDay.toISOString()}`),
    db.select({ count: sql<string>`count(*)` }).from(users).where(sql`${users.lastSeen} >= now() - interval '5 minutes'}`),
  ])

  const wonToday = Math.round(Number(rows[0]?.total ?? 0))

  return { online: Number(activeUsers[0]?.count ?? 0), wonToday }
}

export async function getLiveDrops(): Promise<
  { id: number; name: string; rarity: string; imageUrl: string; value: number }[]
> {
  try {
    const rows = await db
      .select()
      .from(gameHistory)
      .where(inArray(gameHistory.game, ["case", "upgrade", "crash"]))
      .orderBy(desc(gameHistory.createdAt))
      .limit(20)
    return rows
      .map((r) => {
        const m = (r.meta ?? {}) as Record<string, unknown>
        const isUpgradeWin = r.game === "upgrade" && m.success === true
        const isCrashWin = r.game === "crash" && m.status === "cashed"
        if (r.game === "upgrade" && !isUpgradeWin) return null
        if (r.game === "crash" && !isCrashWin) return null
        const rewardType = String(m.rewardType ?? "gift")
        const imageUrl = typeof m.imageUrl === "string" ? m.imageUrl : ""
        if (rewardType === "currency" || !imageUrl || imageUrl.includes("puggift-star")) return null
        return {
          id: r.id,
          name: String(m.giftName ?? m.targetName ?? (isCrashWin ? `Crash ${Number(m.multiplier ?? 1).toFixed(2)}×` : "Gift")),
          rarity: String(m.rarity ?? "common"),
          imageUrl,
          value: Number(r.result),
        }
      })
      .filter((r): r is { id: number; name: string; rarity: string; imageUrl: string; value: number } => Boolean(r?.imageUrl))
  } catch {
    // LIVE is real data only; during a short database reconnect it disappears
    // instead of substituting fabricated drops or crashing the lobby.
    return []
  }
}
