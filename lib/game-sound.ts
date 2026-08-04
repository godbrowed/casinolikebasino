"use client"

/** Tiny synthesized UI sounds — no media download, no playback loop. */
export function playGameSound(kind: "bet" | "cashout" | "crash") {
  if (typeof window === "undefined") return
  try {
    const Audio = window.AudioContext || window.webkitAudioContext
    const ctx = new Audio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    const config = kind === "cashout"
      ? { start: 440, end: 880, duration: 0.16, type: "sine" as OscillatorType }
      : kind === "crash"
        ? { start: 180, end: 55, duration: 0.25, type: "sawtooth" as OscillatorType }
        : { start: 300, end: 420, duration: 0.08, type: "triangle" as OscillatorType }
    osc.type = config.type
    osc.frequency.setValueAtTime(config.start, now)
    osc.frequency.exponentialRampToValueAtTime(config.end, now + config.duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + config.duration)
    window.setTimeout(() => void ctx.close(), 400)
  } catch {
    // Sound is an enhancement; browsers may block audio before a user gesture.
  }
}

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}
