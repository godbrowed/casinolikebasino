// In-game GRAM value of a gift = floor price (TON) * GIFT_VALUE_PER_TON.
// 1:1 — 1 TON of floor equals 1 GRAM.
export const GIFT_VALUE_PER_TON = 1

export const PORTALS_API = "https://portal-market.com/api/collections?limit=500"

// Target return-to-player. A case price is set so the average payout equals
// CASE_RTP of the price (i.e. the house keeps ~1 - CASE_RTP as its edge).
export const CASE_RTP = 0.82

// Expected value of a case from its contents: Σ (weight_i / totalWeight) * value_i.
export function caseExpectedValue(items: { weight: number; value: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0)
  if (totalW <= 0) return 0
  return items.reduce((s, i) => s + (i.weight / totalW) * i.value, 0)
}

// Fair price bound to contents. Rounded to a clean step for nicer prices.
export function priceFromContents(items: { weight: number; value: number }[]): number {
  const ev = caseExpectedValue(items)
  // Paid cases are intentionally 30% cheaper than the pure NFT-only price.
  // Their remaining payout is balanced with GRAM balance rewards at open time.
  const raw = (ev / CASE_RTP) * 0.7
  if (raw <= 0) return 0
  // Round to 2 significant-ish steps so prices read cleanly (e.g. 12.4, 187, 2350).
  if (raw < 10) return Math.round(raw * 10) / 10
  if (raw < 100) return Math.round(raw)
  if (raw < 1000) return Math.round(raw / 5) * 5
  return Math.round(raw / 50) * 50
}

// Derives a rarity tier from a live TON floor price so colors/tiers always
// track real market value after a price sync.
export function rarityFromFloor(floorTon: number): string {
  if (floorTon >= 300) return "mythic"
  if (floorTon >= 50) return "legendary"
  if (floorTon >= 15) return "epic"
  if (floorTon >= 4) return "rare"
  return "common"
}

export type PortalsCollection = {
  short_name: string
  name: string
  floor_price: string
  photo_url: string
  supply: number
  listed_count: number
}

export type PortalsInfo = { floor: number; photo: string }

// Fetches the full Portals Market collection list and returns a
// short_name -> { floor (TON), photo (transparent PNG) } map.
export async function fetchPortalsData(): Promise<Map<string, PortalsInfo>> {
  const res = await fetch(PORTALS_API, {
    headers: { Accept: "application/json" },
    // Always hit the network; this runs on a schedule.
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Portals API responded ${res.status}`)
  }
  const data = (await res.json()) as { collections?: PortalsCollection[] }
  const map = new Map<string, PortalsInfo>()
  for (const c of data.collections ?? []) {
    const floor = Number(c.floor_price)
    if (c.short_name && Number.isFinite(floor) && floor > 0) {
      map.set(c.short_name.toLowerCase(), { floor, photo: c.photo_url })
    }
  }
  return map
}
