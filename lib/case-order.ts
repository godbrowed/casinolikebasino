type PricedCase = {
  id: number
  price: number
  isFree: boolean
}

/** Compare completed case DTOs so ordering uses the same price as the UI. */
export function compareCasesByPrice(a: PricedCase, b: PricedCase): number {
  return Number(b.isFree) - Number(a.isFree) || a.price - b.price || a.id - b.id
}
