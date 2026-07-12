import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { gifts, cases, caseItems } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { fetchPortalsData, GIFT_VALUE_PER_TON, rarityFromFloor, priceFromContents } from "@/lib/pricing"

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

  return { total: rows.length, updated, unmatched: misses, repriced }
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
