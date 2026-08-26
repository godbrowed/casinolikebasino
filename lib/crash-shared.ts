// Shared, client-safe crash helpers. The multiplier formula MUST match on the
// client (animation) and the server (settlement) so payouts are authoritative.

// All clients use the same wall-clock round.  The first part of a round is
// deliberately short: a player can join at any point and immediately sees the
// exact same flight as everybody else.
// Every shared round opens with one global five-second countdown. Nothing
// launches when a player presses the button: accepted bets wait for the same
// wall-clock start and every client sees the rocket leave together.
export const CRASH_ROUND_MS = 20_000
export const CRASH_BETTING_MS = 5_000
// A calmer curve keeps the flight readable on a phone: 2× takes ~3 seconds,
// rather than jumping there almost immediately.
// Reaches the rare 100x ceiling in ~14.4s, still inside the 15s shared flight.
export const CRASH_GROWTH_K = 0.32 // growth rate per second (exponential)

export function sharedRoundStart(now = Date.now()): number {
  return Math.floor(now / CRASH_ROUND_MS) * CRASH_ROUND_MS
}

export function sharedRoundId(now = Date.now()): number {
  return Math.floor(now / CRASH_ROUND_MS)
}

export function sharedFlightStart(now = Date.now()): number {
  return sharedRoundStart(now) + CRASH_BETTING_MS
}

export function crashRoundPhase(now = Date.now()): "betting" | "flying" {
  return now - sharedRoundStart(now) < CRASH_BETTING_MS ? "betting" : "flying"
}

export function timeToNextCrashRound(now = Date.now()): number {
  return CRASH_ROUND_MS - (now % CRASH_ROUND_MS)
}

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
