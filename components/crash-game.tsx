"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { cashoutCrash, getCrashBoard, settleCrashBust, startCrash, type CrashBoard } from "@/app/actions/crash"
import { BetInput } from "@/components/bet-input"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { multiplierAtElapsed } from "@/lib/crash-shared"
import { playGameSound } from "@/lib/game-sound"

export function CrashGame() {
  const { me, setBalance, refresh } = useUser()
  const { data: board, mutate } = useSWR<CrashBoard>("shared-crash-board", getCrashBoard, { refreshInterval: 1200, revalidateOnFocus: true })
  const [bet, setBet] = useState(100)
  const [token, setToken] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ payout: number; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [displayMultiplier, setDisplayMultiplier] = useState(1)
  const [clock, setClock] = useState(Date.now())
  const settling = useRef(false)
  const crashSoundedRound = useRef<number | null>(null)
  const balance = me?.balance ?? 0
  const phase = board?.phase === "crashed" ? "crashed" : board && clock >= board.flightStart ? "flying" : "betting"
  const multiplier = displayMultiplier
  const canBet = phase === "betting" && !token
  const canCashout = phase === "flying" && Boolean(token)

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (phase !== "crashed" || !token || settling.current) return
    settling.current = true
    void settleCrashBust(token).finally(() => {
      setToken(null)
      settling.current = false
      refresh()
      mutate()
      hapticNotify("error")
    })
  }, [mutate, phase, refresh, token])

  useEffect(() => {
    if (phase === "crashed" && board && crashSoundedRound.current !== board.roundId) {
      crashSoundedRound.current = board.roundId
      playGameSound("crash")
    }
  }, [board, phase])

  // The server decides whether the round has crashed.  Between those small
  // syncs the rocket advances locally, so it stays smooth on slower phones.
  useEffect(() => {
    if (!board) return
    if (phase !== "flying") {
      setDisplayMultiplier(board.multiplier)
      return
    }
    const tick = () => setDisplayMultiplier(multiplierAtElapsed(Date.now() - board.flightStart))
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [board, phase])

  async function placeBet() {
    if (!canBet || bet <= 0 || bet > balance) return setError("Not enough balance. Deposit to play.")
    setError(null); setOutcome(null); haptic("medium"); playGameSound("bet")
    try {
      const result = await startCrash(bet)
      setToken(result.token)
      setBalance(result.balance)
      mutate()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place bet"
      setError(message === "BETTING_CLOSED" ? "Betting closed — wait for the next round." : message)
      mutate()
    }
  }

  async function cashout() {
    if (!token || !canCashout) return
    haptic("heavy")
    try {
      const result = await cashoutCrash(token)
      if (result.success) {
        setOutcome({ payout: result.payout, at: result.multiplier })
        setBalance(result.balance ?? balance)
        hapticNotify("success")
        playGameSound("cashout")
      } else hapticNotify("error")
      setToken(null); refresh(); mutate()
    } catch { setError("Cashout failed. Try again in the next round.") }
  }

  const status = phase === "betting" ? `BETTING · ${board?.secondsLeft ?? 0}s` : phase === "crashed" ? "CRASHED" : "LIVE ROUND"
  return <div className="flex flex-col gap-3">
    <div className="no-scrollbar order-4 flex gap-1.5 overflow-x-auto pb-0.5">
      {board?.recent.length ? board.recent.map((round, index) => <span key={index} className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-black", round.multiplier >= 2 ? "bg-emerald-400/16 text-emerald-200" : "bg-rose-400/16 text-rose-200")}>{round.multiplier.toFixed(2)}×</span>) : <span className="text-xs text-muted-foreground">Previous rounds will appear here</span>}
    </div>
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#282b32] px-3 py-2 text-[11px] font-bold">
      <span className={cn("flex items-center gap-2", phase === "flying" && "text-emerald-300", phase === "crashed" && "text-rose-300")}><span className={cn("h-2 w-2 rounded-full", phase === "flying" ? "bg-emerald-400 animate-pulse" : phase === "crashed" ? "bg-rose-400" : "bg-amber-300")} />{status}</span>
      <span className="text-muted-foreground">{phase === "betting" ? `${board?.secondsLeft ?? 0}s to launch` : "Everyone flies together"}</span>
    </div>

    <CrashRocket phase={phase === "flying" ? "running" : phase === "crashed" ? "crashed" : "idle"} multiplier={multiplier}>
      <div className={cn("font-display text-6xl font-black tabular-nums", phase === "crashed" ? "text-rose-400" : "neon-text-cyan text-foreground")}>{multiplier.toFixed(2)}×</div>
      {outcome && <div className="mt-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-300">YOU CASHED {outcome.at.toFixed(2)}× · +{fmt(outcome.payout)} <Coin className="inline h-3 w-3" /></div>}
    </CrashRocket>

    {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}
    {canCashout ? <button onClick={cashout} className="w-full rounded-2xl bg-emerald-400 py-4 font-display text-base font-black text-emerald-950 shadow-[0_0_25px_-5px] shadow-emerald-400">Cash out · {fmt(bet * multiplier)}</button> : <><BetInput value={bet} onChange={setBet} max={balance} /><button onClick={placeBet} disabled={!canBet} className="w-full rounded-2xl py-4 font-display text-base font-black disabled:bg-secondary disabled:text-muted-foreground btn-glow">{token ? "Bet placed" : phase === "betting" ? "Place bet" : "Next round is opening…"}</button></>}

    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#282b32]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2"><h2 className="text-sm font-black">Live players</h2><span className="text-[10px] font-bold text-muted-foreground">{board?.players.length ?? 0} bets</span></div>
      <div className="max-h-44 overflow-y-auto">{board?.players.length ? board.players.map((player, index) => <div key={`${player.name}-${index}`} className="flex items-center justify-between px-3 py-2 text-xs"><span className="min-w-0 truncate font-bold">{player.name}</span><span className="flex items-center gap-1 font-mono"><Coin className="h-3 w-3" />{fmt(player.bet)}</span><span className={cn("w-16 text-right font-bold", player.status === "cashed" ? "text-emerald-300" : player.status === "bust" ? "text-rose-300" : "text-amber-300")}>{player.status === "cashed" ? `+${fmt(player.result)}` : player.status === "bust" ? "lost" : "in flight"}</span></div>) : <div className="px-3 py-5 text-center text-xs text-muted-foreground">Be the first player in this round.</div>}</div>
    </section>
  </div>
}
