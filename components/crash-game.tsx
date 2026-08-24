"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { cashoutCrash, getCrashBoard, settleCrashBust, startCrash, type CrashBoard } from "@/app/actions/crash"
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
  const { data: board, mutate } = useSWR<CrashBoard>("shared-crash-board", getCrashBoard, { refreshInterval: 650, revalidateOnFocus: true })
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
  const countdown = phase === "betting" ? Math.max(0, Math.ceil(((board?.flightStart ?? clock) - clock) / 1000)) : 0
  const canBet = phase === "betting" && !token
  const canCashout = phase === "flying" && Boolean(token)

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 100)
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

  useEffect(() => {
    if (!board) return
    if (phase !== "flying") {
      setDisplayMultiplier(board.multiplier)
      return
    }
    const tick = () => setDisplayMultiplier(multiplierAtElapsed(Date.now() - board.flightStart))
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [board, phase])

  async function placeBet() {
    if (!canBet || bet <= 0 || bet > balance) return setError("Not enough balance. Deposit to play.")
    setError(null)
    setOutcome(null)
    haptic("medium")
    playGameSound("bet")
    try {
      const result = await startCrash(bet)
      setToken(result.token)
      setBalance(result.balance)
      mutate()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place bet"
      setError(message === "BETTING_CLOSED" ? "Betting closed — wait for the next countdown." : message)
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
      setToken(null)
      refresh()
      mutate()
    } catch {
      setError("Cashout failed. Try again in the next round.")
    }
  }

  return <div className="crash-board flex min-h-[calc(100dvh-130px)] w-full flex-col bg-[#071126] pb-6">
    <CrashRocket phase={phase === "flying" ? "running" : phase === "crashed" ? "crashed" : "idle"} multiplier={multiplier}>
      {phase === "betting" ? <>
        <div className="font-display text-[82px] font-black leading-none tabular-nums text-white md:text-[104px]">{countdown || 1}</div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-[.28em] text-white/45">next flight</div>
      </> : phase === "crashed" ? <>
        <div className="rounded-full bg-[#071126]/75 px-4 py-2 font-display text-xl font-black text-rose-300 backdrop-blur-sm">CRASHED · {multiplier.toFixed(2)}×</div>
      </> : <>
        <div className="font-display text-5xl font-black tabular-nums text-white md:text-7xl">{multiplier.toFixed(2)}×</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />live</div>
      </>}
      {outcome && <div className="mt-3 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950">CASHED {outcome.at.toFixed(2)}× · +{fmt(outcome.payout)}</div>}
    </CrashRocket>

    <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto border-y border-white/[.06] bg-[#0a152a] px-3 py-3">
      <span className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-black", phase === "betting" ? "bg-white text-[#071126]" : phase === "crashed" ? "bg-rose-500 text-white" : "bg-emerald-400 text-emerald-950")}>{phase === "betting" ? "WAITING" : `${multiplier.toFixed(2)}×`}</span>
      {board?.recent.map((round, index) => <span key={index} className={cn("shrink-0 rounded-full px-4 py-2 font-mono text-xs font-black", round.multiplier >= 10 ? "bg-[#bd3f24] text-white" : round.multiplier >= 2 ? "bg-[#2461d3] text-white" : "bg-[#202a3f] text-white/85")}>{round.multiplier.toFixed(2)}×</span>)}
    </div>

    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-4 md:px-0">
      <section className="overflow-hidden rounded-[28px] bg-[#202a3f] shadow-[0_18px_50px_rgba(0,0,0,.24)] ring-1 ring-white/[.07]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[.12em] text-white/35"><span>Bet</span><span>Amount</span><span className="w-20 text-right">Result</span></div>
        <div className="max-h-52 min-h-[112px] overflow-y-auto pb-2">
          {board?.players.length ? board.players.map((player, index) => <div key={`${player.name}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2"><i className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3999e9] font-black not-italic text-white">{player.name.replace("@", "").charAt(0).toUpperCase()}</i><b className="truncate text-sm">{player.name}</b></span>
            <span className="flex items-center gap-1 font-mono font-black text-amber-300"><Coin className="h-4 w-4" />{fmt(player.bet)}</span>
            <span className={cn("w-20 text-right font-mono font-black", player.status === "cashed" ? "text-emerald-300" : player.status === "bust" ? "text-rose-300" : "text-white/45")}>{player.status === "cashed" ? `+${fmt(player.result)}` : player.status === "bust" ? "LOST" : `${fmt(player.bet * multiplier)}`}</span>
          </div>) : <div className="flex min-h-[112px] items-center justify-center px-4 text-center text-xs text-white/40">No bets yet. Be first in this shared round.</div>}
        </div>
      </section>

      {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}

      {canCashout ? <button onClick={cashout} className="w-full rounded-2xl bg-emerald-400 py-4 font-display text-lg font-black text-emerald-950 shadow-[0_12px_30px_rgba(52,211,153,.25)] active:scale-[.98]">Cash out · {fmt(bet * multiplier)}</button> : <>
        <div className="grid grid-cols-3 gap-2">{[100, 500, 2500].map((amount) => <button key={amount} onClick={() => setBet(Math.min(amount, Math.floor(balance)))} disabled={Boolean(token)} className={cn("rounded-xl bg-white/10 py-2.5 font-mono text-xs font-black text-white/70", bet === amount && "bg-white/20 text-white")}>★ {amount.toLocaleString()}</button>)}</div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/[.07]"><Coin className="h-5 w-5" /><input type="number" inputMode="numeric" value={bet || ""} disabled={Boolean(token)} onChange={(event) => setBet(Math.max(0, Math.min(Math.floor(balance), Number(event.target.value))))} className="min-w-0 flex-1 bg-transparent py-1 font-mono text-lg font-black outline-none" /><button onClick={() => setBet(Math.floor(balance))} className="text-[10px] font-black uppercase text-[#6e96ff]">max</button></div>
        <button onClick={placeBet} disabled={!canBet} className="w-full rounded-2xl bg-[#2f70ff] py-4 font-display text-lg font-black text-white shadow-[0_12px_30px_rgba(47,112,255,.25)] transition active:scale-[.98] disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">{token ? "BET ACCEPTED" : phase === "betting" ? "PLACE BET" : "NEXT ROUND"}</button>
      </>}
    </div>
  </div>
}
