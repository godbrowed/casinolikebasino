"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { getCrashGifts, startGiftCrash, cashoutGiftCrash, settleGiftBust, type OwnedGift } from "@/app/actions/crash"
import { multiplierAtElapsed } from "@/lib/crash-shared"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Phase = "select" | "running" | "cashed" | "crashed"

export function GiftCrashGame() {
  const { refresh } = useUser()
  const { data: gifts, mutate, isLoading } = useSWR<OwnedGift[]>("crash-gifts", () => getCrashGifts())
  const [selected, setSelected] = useState<OwnedGift | null>(null)
  const [phase, setPhase] = useState<Phase>("select")
  const [multiplier, setMultiplier] = useState(1)
  const [won, setWon] = useState<OwnedGift | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tokenRef = useRef<string | null>(null)
  const startRef = useRef<number>(0)
  const crashRef = useRef<number>(999)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const endCrashed = useCallback(async () => {
    setPhase("crashed")
    hapticNotify("error")
    if (tokenRef.current) {
      try {
        await settleGiftBust(tokenRef.current)
      } catch {
        // ignore
      }
    }
    tokenRef.current = null
    setSelected(null)
    mutate()
    refresh()
  }, [mutate, refresh])

  const loop = useCallback(() => {
    const elapsed = Date.now() - startRef.current
    const m = multiplierAtElapsed(elapsed)
    if (m >= crashRef.current && elapsed >= 900) {
      setMultiplier(crashRef.current)
      endCrashed()
      return
    }
    setMultiplier(Math.min(m, crashRef.current))
    rafRef.current = requestAnimationFrame(loop)
  }, [endCrashed])

  async function handleStart() {
    if (!selected || phase === "running") return
    setError(null)
    setWon(null)
    haptic("medium")
    try {
      const res = await startGiftCrash(selected.id)
      tokenRef.current = res.token
      startRef.current = res.startTime
      crashRef.current = res.crashPoint
      setMultiplier(1)
      setPhase("running")
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    }
  }

  async function handleCashout() {
    if (phase !== "running" || !tokenRef.current) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    haptic("heavy")
    try {
      const res = await cashoutGiftCrash(tokenRef.current)
      if (res.success && res.gift) {
        setPhase("cashed")
        setMultiplier(res.multiplier)
        setWon(res.gift)
        hapticNotify("success")
      } else {
        setMultiplier(res.crashPoint)
        crashRef.current = res.crashPoint
        setPhase("crashed")
        hapticNotify("error")
      }
    } catch {
      setError("Cashout failed")
    } finally {
      tokenRef.current = null
      setSelected(null)
      mutate()
      refresh()
    }
  }

  function reset() {
    setPhase("select")
    setMultiplier(1)
    setWon(null)
    setError(null)
  }

  const running = phase === "running"
  const target = selected ? selected.value * multiplier : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Rocket stage */}
      <CrashRocket
        phase={running ? "running" : phase === "cashed" ? "cashed" : phase === "crashed" ? "crashed" : "idle"}
        multiplier={multiplier}
        payloadImage={running ? selected?.imageUrl : null}
      >
        {phase === "cashed" && won ? (
          <div className="animate-pop-in flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={won.imageUrl || "/images/nft-gift.png"} alt={won.name} className="h-24 w-24 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
            <div className={cn("mt-1 font-display text-lg font-black", rarityOf(won.rarity).text)}>{won.name}</div>
            <div className="flex items-center gap-1 text-sm font-bold text-emerald-400">
              {fmt(won.value)} <Coin className="h-3.5 w-3.5" /> · {multiplier.toFixed(2)}×
            </div>
          </div>
        ) : (
          <>
            {selected && phase === "select" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl || "/images/nft-gift.png"}
                alt={selected.name}
                className="mb-2 h-16 w-16 object-contain"
              />
            )}
            <div
              className={cn(
                "font-display text-6xl font-black tabular-nums transition-colors",
                phase === "crashed" ? "text-rose-400 neon-text-magenta" : "text-foreground neon-text-cyan",
              )}
            >
              {multiplier.toFixed(2)}×
            </div>
            {phase === "crashed" && <div className="mt-1 font-display text-sm font-bold text-rose-400">GIFT LOST</div>}
            {running && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                upgrade to ~{fmt(Math.round(target))} <Coin className="h-3 w-3" />
              </div>
            )}
            {phase === "select" && !selected && (
              <div className="mt-1 text-xs text-muted-foreground">Pick a gift to wager</div>
            )}
          </>
        )}
      </CrashRocket>

      {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}

      {/* Controls */}
      {running ? (
        <button
          onClick={handleCashout}
          className="w-full rounded-2xl bg-emerald-500 py-4 font-display text-base font-black text-emerald-950 shadow-[0_0_28px_-4px] shadow-emerald-500/60 transition-transform active:scale-[0.98]"
        >
          Cash out gift · {multiplier.toFixed(2)}×
        </button>
      ) : phase === "cashed" || phase === "crashed" ? (
        <button
          onClick={reset}
          className="w-full rounded-2xl bg-primary py-4 font-display text-base font-black text-primary-foreground shadow-[0_0_28px_-4px] shadow-primary/60 transition-transform active:scale-[0.98]"
        >
          Play again
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={!selected}
          className="w-full rounded-2xl bg-primary py-4 font-display text-base font-black text-primary-foreground shadow-[0_0_28px_-4px] shadow-primary/60 transition-transform active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {selected ? `Wager ${selected.name}` : "Select a gift"}
        </button>
      )}

      {/* Inventory picker */}
      {(phase === "select" || phase === "cashed" || phase === "crashed") && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-muted-foreground">Your gifts</h2>
            {gifts && gifts.length > 0 && <span className="text-xs text-muted-foreground">{gifts.length} owned</span>}
          </div>
          {isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : !gifts || gifts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No gifts yet. Open a case to get one, then wager it here.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gifts.map((g) => {
                const r = rarityOf(g.rarity)
                const active = selected?.id === g.id && phase === "select"
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (phase !== "select") return
                      haptic("light")
                      setSelected(g)
                    }}
                    className={cn(
                      "card-premium relative flex flex-col items-center rounded-xl border p-2 transition-all",
                      active ? "border-primary ring-2 ring-primary" : "border-border",
                    )}
                  >
                    <div className={cn("absolute inset-x-0 top-0 h-8 rounded-t-xl bg-gradient-to-b to-transparent", r.bg)} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.imageUrl || "/images/nft-gift.png"} alt={g.name} className="relative z-10 h-14 w-14 object-contain" />
                    <span className="relative z-10 mt-1 line-clamp-1 text-[10px] font-medium">{g.name}</span>
                    <span className="relative z-10 flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
                      {fmt(g.value)} <Coin className="h-2.5 w-2.5" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
