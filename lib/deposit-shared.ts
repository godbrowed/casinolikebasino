import { STARS_PER_TON } from "@/lib/pricing"

// Direct Telegram Stars payments credit the same number of in-game Stars.
// TON deposits use the same USD reference as every gift price.
export const TON_TO_GRAM = STARS_PER_TON
export const STARS_TO_GRAM = 1

export function starsToGram(stars: number): number {
  return Math.round(stars * STARS_TO_GRAM)
}

export function tonToStars(ton: number): number {
  return Math.max(1, Math.round(ton * TON_TO_GRAM))
}

export const STAR_PACKS = [50, 100, 250, 500, 1000, 2500]
export const TON_PACKS = STAR_PACKS.map((stars) => Number((stars / TON_TO_GRAM).toFixed(2)))
