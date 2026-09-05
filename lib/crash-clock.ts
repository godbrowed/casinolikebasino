import { multiplierAtElapsed } from "./crash-shared"

export type CrashClockSample = {
  serverTime: number
  roundId: number
  flightStart: number
  nextRoundAt: number
  phase: "betting" | "flying" | "crashed"
  multiplier: number
  recent?: { multiplier: number }[]
}

export const CRASH_CLOCK_STALE_MS = 2_500

/** A presentation clock, never a settlement authority. It uses monotonic
 * browser time, compensates round-trip latency, and gently slews corrections
 * instead of jumping when the device clock changes or a packet arrives late. */
export class CrashClock {
  sample: CrashClockSample | null = null
  private anchorMono = 0
  private anchorServer = 0
  private correction = 0
  private receivedAt = -Infinity

  accept(sample: CrashClockSample, sentAt: number, receivedAt: number): boolean {
    const rtt = receivedAt - sentAt
    if (![sample.serverTime, sample.roundId, sample.flightStart, sample.nextRoundAt, sample.multiplier, sentAt, receivedAt].every(Number.isFinite)
      || !["betting", "flying", "crashed"].includes(sample.phase)
      || sample.nextRoundAt <= sample.flightStart || sample.multiplier < 1
      || rtt < 0 || rtt > CRASH_CLOCK_STALE_MS
      || (this.sample && (sample.roundId < this.sample.roundId || sample.serverTime < this.sample.serverTime))) return false

    const estimate = sample.serverTime + rtt / 2
    if (!this.sample || sample.roundId !== this.sample.roundId) {
      this.anchorServer = estimate
      this.correction = 0
    } else {
      this.anchorServer = this.serverNow(receivedAt)
      this.correction = estimate - this.anchorServer
      // A late flying snapshot cannot resurrect a crash already seen on /watch.
      if (this.sample.phase === "crashed") sample = { ...sample, phase: "crashed", multiplier: this.sample.multiplier }
    }
    this.anchorMono = receivedAt
    this.receivedAt = receivedAt
    this.sample = sample
    return true
  }

  crash(roundId: number, multiplier: number): boolean {
    if (!this.sample || this.sample.roundId !== roundId || !Number.isFinite(multiplier) || multiplier < 1) return false
    this.sample = { ...this.sample, phase: "crashed", multiplier }
    return true
  }

  isCrashed(roundId: number): boolean {
    return this.sample?.roundId === roundId && this.sample.phase === "crashed"
  }

  serverNow(monotonicNow: number): number {
    const elapsed = Math.max(0, monotonicNow - this.anchorMono)
    const adjustment = Math.max(-elapsed * 0.15, Math.min(elapsed * 0.15, this.correction))
    return this.anchorServer + elapsed + adjustment
  }

  fresh(monotonicNow: number): boolean {
    return Boolean(this.sample && monotonicNow - this.receivedAt <= CRASH_CLOCK_STALE_MS
      && this.serverNow(monotonicNow) < this.sample.nextRoundAt)
  }

  phase(monotonicNow: number): "betting" | "flying" | "crashed" | "syncing" {
    if (!this.sample || !this.fresh(monotonicNow)) return "syncing"
    if (this.sample.phase === "crashed") return "crashed"
    return this.serverNow(monotonicNow) < this.sample.flightStart ? "betting" : "flying"
  }

  multiplier(monotonicNow: number): number {
    if (!this.sample) return 1
    if (this.sample.phase === "crashed") return this.sample.multiplier
    // A disconnected tab cannot invent a huge flight or the next round.
    const safeMono = Math.min(monotonicNow, this.receivedAt + CRASH_CLOCK_STALE_MS)
    const safeServer = Math.min(this.serverNow(safeMono), this.sample.nextRoundAt)
    return Math.min(100, multiplierAtElapsed(safeServer - this.sample.flightStart))
  }
}
