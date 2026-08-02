import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { gifts, cases, caseItems } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { fetchPortalsData, GIFT_VALUE_PER_TON, rarityFromFloor, priceFromContents } from "@/lib/pricing"

const NEW_CASES = [
  { slug: "first-drop", name: "First Drop", coverUrl: "/cases/starter.png", accent: "cyan", sortOrder: 10, from: 0, size: 7 },
  { slug: "lucky-signal", name: "Lucky Signal", coverUrl: "/cases/lucky.png", accent: "blue", sortOrder: 20, from: 0.12, size: 8 },
  { slug: "neon-pulse", name: "Neon Pulse", coverUrl: "/cases/neon.png", accent: "magenta", sortOrder: 30, from: 0.25, size: 8 },
  { slug: "gold-rush", name: "Gold Rush", coverUrl: "/cases/gold.png", accent: "gold", sortOrder: 40, from: 0.42, size: 8 },
  { slug: "diamond-club", name: "Diamond Club", coverUrl: "/cases/diamond.png", accent: "blue", sortOrder: 50, from: 0.58, size: 8 },
  { slug: "royal-vault", name: "Royal Vault", coverUrl: "/cases/royal.png", accent: "magenta", sortOrder: 60, from: 0.72, size: 8 },
  { slug: "legend-only", name: "Legend Only", coverUrl: "/cases/legend.png", accent: "red", sortOrder: 70, from: 0.84, size: 8 },
  { slug: "whale-room", name: "Whale Room", coverUrl: "/cases/mega.png", accent: "gold", sortOrder: 80, from: 0.92, size: 8 },
] as const

async function ensureCaseCatalog() {
  const giftRows = (await db.select().from(gifts))
    .filter((gift) => Number(gift.value) > 0)
    .sort((a, b) => Number(a.value) - Number(b.value))

  if (giftRows.length < 8) return 0
  let created = 0

  for (const definition of NEW_CASES) {
    await db.insert(cases).values({
      slug: definition.slug,
      name: definition.name,
      coverUrl: definition.coverUrl,
      accent: definition.accent,
      sortOrder: definition.sortOrder,
      price: "0",
    }).onConflictDoNothing({ target: cases.slug })

    const caseRow = (await db.select().from(cases).where(eq(cases.slug, definition.slug)).limit(1))[0]
    if (!caseRow) continue
    const existing = await db.select({ id: caseItems.id }).from(caseItems).where(eq(caseItems.caseId, caseRow.id)).limit(1)
    if (existing.length) continue

    const start = Math.min(Math.floor((giftRows.length - definition.size) * definition.from), giftRows.length - definition.size)
    const selected = giftRows.slice(Math.max(0, start), Math.max(0, start) + definition.size)
    await db.insert(caseItems).values(selected.map((gift, index) => ({
      caseId: caseRow.id,
      giftId: gift.id,
      // Common rewards remain visible while the premium item stays aspirational.
      weight: String(Math.max(2, 42 - index * 5)),
    })))
    created++
  }
  return created
}

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Updates every gift's floor_ton (from Portals Market) and derived coin value.
// Triggered by Vercel Cron (see vercel.json) or manually with the CRON_SECRET.
async function sync() {
  const data = await fetchPortalsData()
  const rows = await db.select().from(gifts)

  let updated = 0
  const misses: string[] = []

  for (const g of rows) {
    const info = data.get(g.slug.toLowerCase())
    if (info === undefined) {
      misses.push(g.slug)
      continue
    }
    const value = info.floor * GIFT_VALUE_PER_TON
    await db
      .update(gifts)
      .set({
        floorTon: info.floor.toFixed(4),
        value: value.toFixed(2),
        rarity: rarityFromFloor(info.floor),
        // Portals photo_url is a transparent PNG of the gift model (no background).
        imageUrl: info.photo,
      })
      .where(eq(gifts.id, g.id))
    updated++
  }

  const createdCases = await ensureCaseCatalog()

  // Reprice every case from its (now updated) contents so prices stay bound
  // to real gift values with a consistent house edge.
  const caseRows = await db.select().from(cases)
  const links = await db
    .select({ caseId: caseItems.caseId, weight: caseItems.weight, value: gifts.value })
    .from(caseItems)
    .innerJoin(gifts, eq(caseItems.giftId, gifts.id))

  let repriced = 0
  for (const c of caseRows) {
    const items = links
      .filter((l) => l.caseId === c.id)
      .map((l) => ({ weight: Number(l.weight), value: Number(l.value) }))
    const price = priceFromContents(items)
    if (price > 0) {
      await db.update(cases).set({ price: price.toFixed(2) }).where(eq(cases.id, c.id))
      repriced++
    }
  }

  return { total: rows.length, updated, unmatched: misses, createdCases, repriced }
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sync()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed"
    console.log("[giftlys] sync-prices error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

// Allow POST too so it can be triggered from an admin button / manual call.
export const POST = GET
