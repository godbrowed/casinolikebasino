// PugGift uses Stars as its single in-game balance.
// Reference deposit screen: 200 Stars ~= 1.77 TON, therefore 1 TON = 113 Stars.
// Direct Telegram Stars payments credit the same number of in-game Stars.
export const TON_TO_GRAM = 113
export const STARS_TO_GRAM = 1

export function starsToGram(stars: number): number {
  return Math.round(stars * STARS_TO_GRAM)
}

export function tonToStars(ton: number): number {
  return Math.max(1, Math.round((ton * TON_TO_GRAM) / 50) * 50)
}

export const STAR_PACKS = [50, 100, 250, 500, 1000, 2500]
export const TON_PACKS = [1.77, 4.42, 8.85, 17.7, 44.25, 88.5]
