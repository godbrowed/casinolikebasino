// Client-safe upgrade odds. Must match the server settlement in app/actions/upgrade.ts.
// 90% return-to-player across every valid source/target pair.
export const HOUSE_FACTOR = 0.9

export function upgradeChance(sourceValue: number, targetValue: number): number {
  if (targetValue <= 0 || sourceValue <= 0) return 0
  if (sourceValue >= targetValue) return 0.9
  return Math.max(0.02, Math.min(0.9, (sourceValue / targetValue) * HOUSE_FACTOR))
}

export function upgradeMultiplier(sourceValue: number, targetValue: number): number {
  if (sourceValue <= 0) return 0
  return targetValue / sourceValue
}
