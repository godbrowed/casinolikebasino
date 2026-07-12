// Shared, client-safe crash helpers. The multiplier formula MUST match on the
// client (animation) and the server (settlement) so payouts are authoritative.

export const CRASH_GROWTH_K = 0.14 // growth rate per second (exponential)

export function multiplierAtElapsed(ms: number): number {
  const t = Math.max(0, ms) / 1000
  return Math.exp(CRASH_GROWTH_K * t)
}

export function elapsedForMultiplier(m: number): number {
  if (m <= 1) return 0
  return (Math.log(m) / CRASH_GROWTH_K) * 1000
}

export type CrashRound = {
  bet: number
  crashPoint: number
  startTime: number
}
