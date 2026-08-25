// Gifts and cases are priced in the same Stars balance used by every game.
// Product reference: 1,000 Stars = $15.60. TON is kept as a single reference
// value here so every surface (cases, inventory, crash, upgrade and deposits)
// performs exactly the same conversion.
export const STAR_USD = 15.6 / 1000
const configuredTonUsd = Number(process.env.NEXT_PUBLIC_TON_USD_RATE)
export const TON_USD_REFERENCE = Number.isFinite(configuredTonUsd) && configuredTonUsd > 0 ? configuredTonUsd : 1.43
export const STARS_PER_TON = TON_USD_REFERENCE / STAR_USD
export const GIFT_VALUE_PER_TON = STARS_PER_TON

export function tonToStarValue(ton: string | number): number {
  const value = Number(ton)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * STARS_PER_TON * 100) / 100
}

/** Prefer the live TON floor and use the stored value only for legacy gifts
 * that do not yet have a floor. This prevents stale database values leaking
 * into upgrade odds, crash rewards, sales or case prices. */
export function giftValueInStars(
  storedValue: string | number,
  floorTon: string | number | null | undefined,
): number {
  const liveValue = tonToStarValue(floorTon ?? 0)
  if (liveValue > 0) return liveValue
  const fallback = Number(storedValue)
  return Number.isFinite(fallback) ? Math.round(fallback * 100) / 100 : 0
}

export const PORTALS_API = "https://portal-market.com/api/collections?limit=500"

// Target return-to-player. A case price is set so the average payout equals
// CASE_RTP of the price (i.e. the house keeps ~1 - CASE_RTP as its edge).
export const CASE_RTP = 0.9

// Premium cases must always award an on-chain gift. Balance payouts are kept
// only in entry cases, where they make the first sessions less volatile.
export const BALANCE_REWARD_MAX_CASE_PRICE = 7

// Expected value of a case from its contents: Σ (weight_i / totalWeight) * value_i.
export function caseExpectedValue(items: { weight: number; value: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0)
  if (totalW <= 0) return 0
  return items.reduce((s, i) => s + (i.weight / totalW) * i.value, 0)
}

// Fair price bound to contents. Rounded to a clean step for nicer prices.
export function priceFromContents(items: { weight: number; value: number }[]): number {
  const ev = caseExpectedValue(items)
  const giftOnlyPrice = ev / CASE_RTP
  // Entry cases use a 60% gift / 40% balance mix. Balance tiers contribute
  // exactly 10% of the case price to EV, so 0.6*giftEV + 0.1*price = 0.9*price.
  const raw = giftOnlyPrice <= BALANCE_REWARD_MAX_CASE_PRICE ? ev * 0.75 : giftOnlyPrice
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
