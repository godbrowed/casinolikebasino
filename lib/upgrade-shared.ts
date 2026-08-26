// Client-safe upgrade odds. The server imports this exact function too, so the
// wheel can never advertise a chance that differs from settlement.
export const HOUSE_FACTOR = 0.9
export const MAX_UPGRADE_CHANCE = 0.8

export function upgradeChance(sourceValue: number, targetValue: number): number {
  if (targetValue <= 0 || sourceValue <= 0) return 0
  if (sourceValue >= targetValue) return MAX_UPGRADE_CHANCE
  return Math.max(0.02, Math.min(MAX_UPGRADE_CHANCE, (sourceValue / targetValue) * HOUSE_FACTOR))
}

export function upgradeMultiplier(sourceValue: number, targetValue: number): number {
  if (sourceValue <= 0) return 0
  return targetValue / sourceValue
}
