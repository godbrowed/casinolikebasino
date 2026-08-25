import "server-only"

import crypto from "crypto"

export function crashSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (configured) return configured
  return "puggift-crash-fallback-secret-change-in-production"
}

export function crashPointForRound(roundId: number, edge = 0.9): number {
  const hash = crypto.createHmac("sha256", crashSecret()).update(`crash:${roundId}`).digest()
  const roll = hash.readUInt32BE(0) / 0x1_0000_0000
  const point = edge / (1 - roll)
  return Math.min(20, Math.max(1, Math.floor(point * 100) / 100))
}
