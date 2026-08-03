"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { startCrash, cashoutCrash, settleCrashBust, getGiftImages } from "@/app/actions/crash"
import { CRASH_ROUND_MS, multiplierAtElapsed, timeToNextCrashRound } from "@/lib/crash-shared"
import { BetInput } from "@/components/bet-input"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Phase = "idle" | "running" | "cashed" | "crashed"

export function CrashGame() {
  const { me, setBalance, refresh } = useUser()
  const { data: giftImages } = useSWR<string[]>("crash-gift-images", () => getGiftImages())
  const [bet, setBet] = useState(100)
  const [phase, setPhase] = useState<Phase>("idle")
  const [multiplier, setMultiplier] = useState(1)
  const [outcome, setOutcome] = useState<{ won: boolean; payout: number; at: number } | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [roundClock, setRoundClock] = useState(timeToNextCrashRound())

  const tokenRef = useRef<string | null>(null)
  const startRef = useRef<number>(0)
  const crashRef = useRef<number>(999)
  const rafRef = useRef<number | null>(null)
  const phaseRef = useRef<Phase>("idle")

  const balance = me?.balance ?? 0

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const id = window.setInterval(() => setRoundClock(timeToNextCrashRound()), 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const endCrashed = useCallback(async () => {
    const alreadyCashed = phaseRef.current === "cashed"
    phaseRef.current = "crashed"
    setPhase("crashed")
    if (!alreadyCashed) setOutcome({ won: false, payout: 0, at: crashRef.current })
    setHistory((h) => [crashRef.current, ...h].slice(0, 12))
    if (!alreadyCashed) hapticNotify("error")
    if (tokenRef.current) {
      try {
        await settleCrashBust(tokenRef.current)
      } catch {
        // ignore
      }
    }
    tokenRef.current = null
    refresh()
  }, [refresh])

  const loop = useCallback(() => {
    const elapsed = Date.now() - startRef.current
    const m = multiplierAtElapsed(elapsed)
    // Keep the rocket airborne for a beat so the launch is always visible,
    // even on instant busts. Payout stays server-authoritative.
    if (m >= crashRef.current && elapsed >= 900) {
      setMultiplier(crashRef.current)
      endCrashed()
      return
    }
    setMultiplier(Math.min(m, crashRef.current))
    rafRef.current = requestAnimationFrame(loop)
  }, [endCrashed])

  async function handleStart() {
    if (phase === "running" || bet <= 0 || bet > balance) {
      if (bet > balance) setError("Not enough balance. Deposit to play.")
      return
    }
    setError(null)
    setOutcome(null)
    haptic("medium")
    try {
      const res = await startCrash(bet)
      setBalance(res.balance)
      tokenRef.current = res.token
      startRef.current = res.startTime
      // Server owns settlement (cashout is re-verified server-side); crashPoint drives the local curve.
      crashRef.current = res.crashPoint ?? 999
      setMultiplier(1)
      phaseRef.current = "running"
      setPhase("running")
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error"
      setError(msg === "INSUFFICIENT_FUNDS" ? "Not enough balance. Deposit to play." : msg)
    }
  }

  async function handleCashout() {
    if (phase !== "running" || !tokenRef.current) return
    haptic("heavy")
    try {
      const res = await cashoutCrash(tokenRef.current)
      if (res.success) {
        phaseRef.current = "cashed"
        setPhase("cashed")
        setMultiplier(res.multiplier)
        setOutcome({ won: true, payout: res.payout, at: res.multiplier })
        setBalance(res.balance ?? balance)
        setHistory((h) => [res.crashPoint, ...h].slice(0, 12))
        hapticNotify("success")
      } else {
        setMultiplier(res.crashPoint)
        crashRef.current = res.crashPoint
        endCrashed()
      }
    } catch {
      setError("Cashout failed")
    } finally {
      tokenRef.current = null
    }
  }

  const running = phase === "running"
  const potential = Math.round(bet * multiplier)

  return (
    <>
      {/* Recent multipliers */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {history.length === 0 && <span className="text-xs text-muted-foreground">No rounds yet</span>}
        {history.map((h, i) => (
          <span
            key={i}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 font-mono text-xs font-bold",
              h >= 2 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
            )}
          >
            {h.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* Rocket stage */}
      <CrashRocket phase={phase} multiplier={multiplier} collectImages={giftImages ?? []}>
        <div
          className={cn(
            "font-display text-6xl font-black tabular-nums transition-colors",
            phase === "crashed" ? "text-rose-400 neon-text-magenta" : "text-foreground neon-text-cyan",
          )}
        >
          {multiplier.toFixed(2)}×
        </div>
        {phase === "crashed" && <div className="mt-1 font-display text-sm font-bold text-rose-400">CRASHED</div>}
        {phase === "cashed" && outcome && (
          <div className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-emerald-400">
            +{fmt(outcome.payout)} <Coin className="h-3.5 w-3.5" />
          </div>
        )}
        {running && (
          <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            cash out for {fmt(potential)} <Coin className="h-3 w-3" />
          </div>
        )}
      </CrashRocket>

      <div className="-mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Shared round · next launch in {Math.ceil(roundClock / 1000)}s
      </div>

      {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}

      {running ? (
        <button
          onClick={handleCashout}
          className="w-full rounded-2xl bg-emerald-500 py-4 font-display text-base font-black text-emerald-950 shadow-[0_0_28px_-4px] shadow-emerald-500/60 transition-transform active:scale-[0.98]"
        >
          Cash out · {fmt(potential)}
        </button>
      ) : phase === "cashed" ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 py-3 text-center text-sm font-bold text-emerald-300">
          Collected — keep watching the shared flight
        </div>
      ) : (
        <>
          <BetInput value={bet} onChange={setBet} max={balance} />
          <button
            onClick={handleStart}
            className="w-full rounded-2xl bg-primary py-4 font-display text-base font-black text-primary-foreground shadow-[0_0_28px_-4px] shadow-primary/60 transition-transform active:scale-[0.98]"
          >
            Place bet
          </button>
        </>
      )}
    </>
  )
}

