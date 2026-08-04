// In-game currency is GRAM and is pegged to TON 1:1.
// Price policy: 1,000 Telegram Stars represent $15.60. At a reference TON
// price of about $1.46 this credits 10.68 TON / GRAM (no hidden bonus).
export const TON_TO_GRAM = 1
export const STARS_TO_GRAM = 0.01068

export function starsToGram(stars: number): number {
  return Math.round(stars * STARS_TO_GRAM * 10_000) / 10_000
}

export const STAR_PACKS = [50, 100, 250, 500, 1000, 2500]
export const TON_PACKS = [1, 5, 10, 25, 50, 100]
