"use server"

import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { cases, caseItems, gifts, users, inventory, gameHistory } from "@/lib/db/schema"
import { getCurrentUserId, requireUserId } from "@/lib/session"

export type GiftDTO = {
  id: number
  slug: string
  name: string
  rarity: string
  imageUrl: string
  value: number
  floorTon?: number
  weight?: number
  chance?: number
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
  isUnlocked: boolean
  items: GiftDTO[]
}

const FREE_CASE_PROMO = "FREECASE"
const LIVE_DROPS_CUTOFF = new Date("2026-07-16T09:33:56.000Z")
const FREE_CURRENCY_REWARDS: GiftDTO[] = [
  { id: -1, slug: "gram-005", name: "0.05 GRAM", rarity: "common", imageUrl: "/images/giftlys-coin-v2.png", value: 0.05, weight: 7000, chance: 70, rewardType: "currency" },
  { id: -2, slug: "gram-010", name: "0.10 GRAM", rarity: "common", imageUrl: "/images/giftlys-coin-v2.png", value: 0.1, weight: 2200, chance: 22, rewardType: "currency" },
  { id: -3, slug: "gram-025", name: "0.25 GRAM", rarity: "rare", imageUrl: "/images/giftlys-coin-v2.png", value: 0.25, weight: 780, chance: 7.8, rewardType: "currency" },
]

async function hasFreeCaseUnlock(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: gameHistory.id })
    .from(gameHistory)
    .where(and(eq(gameHistory.userId, userId), eq(gameHistory.game, "promo"), sql`${gameHistory.meta}->>'code' = ${FREE_CASE_PROMO}`))
    .limit(1)
  return rows.length > 0
}

export async function getCases(): Promise<CaseDTO[]> {
  const userId = await getCurrentUserId()
  const [rows, userRows, unlocked] = await Promise.all([
    db.select().from(cases).orderBy(asc(cases.sortOrder)),
    userId
      ? db.select({ lastFreeCaseAt: users.lastFreeCaseAt }).from(users).where(eq(users.id, userId)).limit(1)
      : Promise.resolve([]),
    userId ? hasFreeCaseUnlock(userId) : Promise.resolve(false),
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

  const freeGiftPool = [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 5)

  return rows.map((c) => {
    const list = items.filter((i) => i.caseId === c.id)
    const totalW = list.reduce((s, i) => s + Number(i.weight), 0)
    const nextFreeAt = c.isFree && lastFreeCaseAt
      ? new Date(lastFreeCaseAt.getTime() + (c.cooldownHours ?? 24) * 60 * 60 * 1000).toISOString()
      : null
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      coverUrl: c.isFree ? "/images/giftlys-free-case.png" : c.coverUrl,
      price: Number(c.price),
      accent: c.accent,
      isFree: c.isFree,
      cooldownHours: c.cooldownHours,
      nextFreeAt,
      isUnlocked: !c.isFree || unlocked,
      items: c.isFree
        ? [
            ...freeGiftPool.map((i, index) => {
                const giftWeights = [10, 5, 3, 1, 1]
                const weight = giftWeights[index] ?? 1
                return {
                  id: i.id,
                  slug: i.slug,
                  name: i.name,
                  rarity: i.rarity,
                  imageUrl: i.imageUrl,
                  value: Number(i.value),
                  floorTon: Number(i.floorTon),
                  weight,
                  chance: weight / 100,
                  rewardType: "gift" as const,
                }
              }),
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
          value: Number(i.value),
          floorTon: Number(i.floorTon),
          weight: Number(i.weight),
          chance: totalW ? (Number(i.weight) / totalW) * 60 : 0,
          rewardType: "gift" as const,
        }))
        .sort((a, b) => b.value - a.value),
          { id: -101, slug: `gram-small-${c.id}`, name: `${Math.max(1, Math.round(Number(c.price) * 0.1))} GRAM`, rarity: "common", imageUrl: "/images/giftlys-coin-v2.png", value: Math.max(1, Math.round(Number(c.price) * 0.1)), chance: 20, rewardType: "currency" as const },
          { id: -102, slug: `gram-medium-${c.id}`, name: `${Math.max(1, Math.round(Number(c.price) * 0.25))} GRAM`, rarity: "rare", imageUrl: "/images/giftlys-coin-v2.png", value: Math.max(1, Math.round(Number(c.price) * 0.25)), chance: 12, rewardType: "currency" as const },
          { id: -103, slug: `gram-large-${c.id}`, name: `${Math.max(1, Math.round(Number(c.price) * 0.5))} GRAM`, rarity: "epic", imageUrl: "/images/giftlys-coin-v2.png", value: Math.max(1, Math.round(Number(c.price) * 0.5)), chance: 6, rewardType: "currency" as const },
          { id: -104, slug: `gram-jackpot-${c.id}`, name: `${Math.max(1, Math.round(Number(c.price)))} GRAM`, rarity: "legendary", imageUrl: "/images/giftlys-coin-v2.png", value: Math.max(1, Math.round(Number(c.price))), chance: 2, rewardType: "currency" as const },
        ],
    }
  })
}

export async function getCaseBySlug(slug: string): Promise<CaseDTO | null> {
  const all = await getCases()
  return all.find((c) => c.slug === slug) ?? null
}

export async function redeemFreeCasePromo(code: string): Promise<{ unlocked: true }> {
  const userId = await requireUserId()
  const normalized = code.trim().toUpperCase()
  if (normalized !== FREE_CASE_PROMO) throw new Error("INVALID_PROMO_CODE")

  if (!(await hasFreeCaseUnlock(userId))) {
    await db.insert(gameHistory).values({
      userId,
      game: "promo",
      bet: "0",
      result: "0",
      meta: { code: FREE_CASE_PROMO, reward: "free-case-access" },
    })
  }

  revalidatePath("/")
  return { unlocked: true }
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
  const price = Number(caseRow.price)
  if (caseRow.isFree && !(await hasFreeCaseUnlock(userId))) throw new Error("FREE_CASE_LOCKED")

  const list = await db
    .select({
      weight: caseItems.weight,
      id: gifts.id,
      slug: gifts.slug,
      name: gifts.name,
      rarity: gifts.rarity,
      imageUrl: gifts.imageUrl,
      value: gifts.value,
    })
    .from(caseItems)
    .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
    .where(eq(caseItems.caseId, caseId))

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
      const currencyValue = roll < 7000 ? 0.05 : roll < 9200 ? 0.1 : 0.25
      const giftRows = await tx
        .select({
          id: gifts.id,
          slug: gifts.slug,
          name: gifts.name,
          rarity: gifts.rarity,
          imageUrl: gifts.imageUrl,
          value: gifts.value,
        })
        .from(caseItems)
        .innerJoin(gifts, eq(caseItems.giftId, gifts.id))
      const freeGiftPool = [...new Map(giftRows.map((gift) => [gift.id, gift])).values()]
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, 5)
      const giftWeights = [10, 5, 3, 1, 1]
      const gift = roll >= 9980 && freeGiftPool.length > 0
        ? freeGiftPool[weightedPick(freeGiftPool.map((_, index) => ({ weight: giftWeights[index] ?? 1 })))]
        : null

      if (gift) {
          const claimed = await tx
            .update(users)
            .set({ lastFreeCaseAt: now })
            .where(and(eq(users.id, userId), or(isNull(users.lastFreeCaseAt), lte(users.lastFreeCaseAt, eligibleBefore))))
            .returning({ balance: users.balance })
          if (claimed.length === 0) throw new Error("FREE_CASE_COOLDOWN")
          const inv = await tx.insert(inventory).values({ userId, giftId: gift.id, value: gift.value, source: "free-case" }).returning({ id: inventory.id })
          await tx.insert(gameHistory).values({
            userId,
            game: "case",
            bet: "0",
            result: gift.value,
            meta: { caseName: caseRow.name, giftName: gift.name, rarity: gift.rarity, imageUrl: gift.imageUrl, rewardType: "gift" },
          })
          return {
            won: { id: gift.id, slug: gift.slug, name: gift.name, rarity: gift.rarity, imageUrl: gift.imageUrl, value: Number(gift.value), rewardType: "gift" },
            balance: Number(claimed[0].balance),
            inventoryId: inv[0].id,
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
        slug: `gram-${currencyValue}`,
        name: `${currencyValue} GRAM`,
        rarity: currencyValue >= 0.25 ? "rare" : "common",
        imageUrl: "/images/giftlys-coin-v2.png",
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
    const isCurrencyReward = rewardRoll < 4000
    const currencyValue = rewardRoll < 2000
      ? Math.max(1, Math.round(price * 0.1))
      : rewardRoll < 3200
        ? Math.max(1, Math.round(price * 0.25))
        : rewardRoll < 3800
          ? Math.max(1, Math.round(price * 0.5))
          : Math.max(1, Math.round(price))

    const idx = weightedPick(list.map((i) => ({ weight: Number(i.weight) })))
    const won = list[idx]
    const wonValue = Number(won.value)

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
        slug: `gram-${currencyValue}`,
        name: `${currencyValue} GRAM`,
        rarity: currencyValue >= price ? "legendary" : currencyValue >= price * 0.5 ? "epic" : currencyValue >= price * 0.25 ? "rare" : "common",
        imageUrl: "/images/giftlys-coin-v2.png",
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

export async function getHomeStats(): Promise<{ online: number; wonToday: number }> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${gameHistory.result}), 0)` })
    .from(gameHistory)
    .where(sql`${gameHistory.createdAt} >= ${startOfDay.toISOString()}`)

  const wonToday = Math.round(Number(rows[0]?.total ?? 0))

  // Keep the public activity indicators stable between requests while allowing
  // them to drift gradually during the day instead of jumping on every render.
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes()
  const online = Math.round(155 + 65 * Math.sin(minuteOfDay / 83) + 24 * Math.sin(minuteOfDay / 19))
  const displayWinnings = Math.min(4200, wonToday + 900 + Math.round(700 * (1 + Math.sin(minuteOfDay / 127))))

  return { online: Math.max(80, Math.min(250, online)), wonToday: displayWinnings }
}

export async function getLiveDrops(): Promise<
  { id: number; name: string; rarity: string; imageUrl: string; value: number }[]
> {
  const rows = await db
    .select()
    .from(gameHistory)
    .where(and(eq(gameHistory.game, "case"), gte(gameHistory.createdAt, LIVE_DROPS_CUTOFF)))
    .orderBy(desc(gameHistory.createdAt))
    .limit(20)
  return rows
    .map((r) => {
      const m = (r.meta ?? {}) as Record<string, string>
      return {
        id: r.id,
        name: m.giftName ?? "Gift",
        rarity: m.rarity ?? "common",
        imageUrl: m.imageUrl ?? "/images/nft-gift.png",
        value: Number(r.result),
      }
    })
    .filter((r) => r.imageUrl)
}
