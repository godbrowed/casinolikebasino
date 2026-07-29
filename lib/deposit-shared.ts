// In-game currency is GRAM and is pegged to TON 1:1.
// Price policy: 50 Telegram Stars = 0.6 TON / GRAM.
export const TON_TO_GRAM = 1
export const STARS_TO_GRAM = 0.012

export function starsToGram(stars: number): number {
  return Math.round(stars * STARS_TO_GRAM * 10_000) / 10_000
}

export const STAR_PACKS = [50, 100, 250, 500, 1000, 2500]
export const TON_PACKS = [1, 5, 10, 25, 50, 100]
