import "server-only"

import crypto from "crypto"
import { CRASH_BETTING_MS, CRASH_ROUND_MS, CRASH_RTP_PERCENT, multiplierAtElapsed, sharedRoundId } from "@/lib/crash-shared"

export function crashSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (configured) return configured
  if (process.env.NODE_ENV === "production") throw new Error("CRASH_SECRET_REQUIRED")
  return "puggift-crash-fallback-secret-change-in-production"
}

export function crashPointForRound(roundId: number, rtp = CRASH_RTP_PERCENT / 100): number {
  const hash = crypto.createHmac("sha256", crashSecret()).update(`crash:${roundId}`).digest()
  const roll = hash.readUInt32BE(0) / 0x1_0000_0000
  const safeRtp = Math.min(0.99, Math.max(0.01, rtp))
  const point = safeRtp / (1 - roll)
  // Keep extreme hash tails finite so every global round still settles before
  // the next one, while allowing rare flights far beyond the old 20x ceiling.
  return Math.min(100, Math.max(1, Math.floor(point * 100) / 100))
}

/** Database-free clock. Never publish an unfinished round's crash point. */
export function getPublicCrashClock(now = Date.now()) {
  const roundId = sharedRoundId(now)
  const flightStart = roundId * CRASH_ROUND_MS + CRASH_BETTING_MS
  const point = crashPointForRound(roundId)
  const current = multiplierAtElapsed(now - flightStart)
  const phase: "betting" | "flying" | "crashed" = now < flightStart ? "betting" : current >= point ? "crashed" : "flying"
  const nextRoundAt = (roundId + 1) * CRASH_ROUND_MS
  return {
    serverTime: now,
    roundId,
    flightStart,
    nextRoundAt,
    phase,
    multiplier: phase === "crashed" ? point : current,
    secondsLeft: Math.max(0, Math.ceil(((phase === "betting" ? flightStart : nextRoundAt) - now) / 1000)),
    recent: Array.from({ length: 18 }, (_, index) => {
      const multiplier = crashPointForRound(roundId - (phase === "crashed" ? 0 : 1) - index)
      return { multiplier, won: multiplier >= 2 }
    }),
  }
}
