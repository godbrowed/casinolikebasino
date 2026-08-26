"use client"

import { useEffect, useState } from "react"
import { Bomb, Bone, Loader2, PawPrint, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"
import type { MinesState } from "@/app/actions/mines"
import { cashoutMinesApi, fetchActiveMinesApi, revealMineApi, startMinesApi } from "@/lib/client-game-api"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { playGameSound } from "@/lib/game-sound"

const MINE_OPTIONS = [3, 5, 10, 15]

export function MinesGame() {
  const { me, setBalance, refresh } = useUser()
  const balance = me?.balance ?? 0
  const [bet, setBet] = useState(100)
  const [mineCount, setMineCount] = useState(5)
  const [round, setRound] = useState<MinesState | null>(null)
  const [busyTile, setBusyTile] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = round?.status === "active"

  useEffect(() => {
    let cancelled = false
    fetchActiveMinesApi().then((state) => {
      if (!cancelled && state) {
        setRound(state)
        setMineCount(state.mineCount)
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  async function start() {
    if (busy || bet < 1 || bet > balance) return
    setBusy(true); setError(null); haptic("medium"); playGameSound("bet")
    try {
      const state = await startMinesApi(bet, mineCount)
      setRound(state); setBalance(state.balance ?? balance - bet)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not start Mines"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars." : message)
    } finally { setBusy(false) }
  }

  async function reveal(tile: number) {
    if (!active || busyTile != null || round.revealed.includes(tile)) return
    setBusyTile(tile); setError(null); haptic("light")
    try {
      const state = await revealMineApi(round.roundId, tile)
      setRound(state)
      if (state.status === "bust") { hapticNotify("error"); playGameSound("crash"); void refresh() }
      else { hapticNotify("success"); playGameSound("cashout"); if (state.balance != null) setBalance(state.balance) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tile could not be opened") }
    finally { setBusyTile(null) }
  }

  async function cashout() {
    if (!active || !round.revealed.length || busy) return
    setBusy(true); setError(null); haptic("heavy")
    try {
      const state = await cashoutMinesApi(round.roundId)
      setRound(state); setBalance(state.balance ?? balance); hapticNotify("success"); playGameSound("cashout"); void refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cashout failed") }
    finally { setBusy(false) }
  }

  function reset() { setRound(null); setError(null); setBusyTile(null) }

  return <div className="relative mx-auto flex min-h-[calc(100dvh-58px)] w-full max-w-[900px] flex-col overflow-hidden bg-[#102417] px-3 pb-[calc(7rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-4 text-white md:px-5">
    <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(123,224,147,.24)_1px,transparent_1px)] [background-size:34px_34px]" />
    <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-[90px]" />

    <header className="relative mb-4 flex items-center justify-between rounded-[26px] bg-[#183522]/90 p-4 ring-1 ring-emerald-200/10">
      <div><span className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300/60">PugGift yard</span><h1 className="font-display text-2xl font-black">Pug Mines</h1><p className="mt-1 text-[10px] font-bold text-white/38">Find bones. Don’t wake the grumpy pugs.</p></div>
      <div className="relative h-20 w-20 shrink-0"><div className="absolute inset-1 rounded-full bg-emerald-300/15 blur-xl" /><img src="/images/puggift-bot-avatar-web-v2.webp" alt="Pug miner" className={cn("relative h-full w-full rounded-full object-cover ring-2 ring-emerald-300/25", round?.status === "bust" && "animate-bounce ring-rose-400")} /></div>
    </header>

    <section className="relative grid gap-3 md:grid-cols-[1fr_290px]">
      <div className="order-2 rounded-[30px] bg-[#0a1a10]/75 p-3 ring-1 ring-white/[.07] md:order-1 md:p-4">
        <div className="mb-3 grid grid-cols-3 gap-2"><Stat label="Safe" value={String(round?.revealed.length ?? 0)} icon={PawPrint} /><Stat label="Multiplier" value={`${(round?.multiplier ?? 1).toFixed(2)}×`} icon={Sparkles} /><Stat label="Next" value={`${(round?.nextMultiplier ?? 1).toFixed(2)}×`} icon={Bone} /></div>
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5">{Array.from({ length: 25 }, (_, tile) => {
          const opened = round?.revealed.includes(tile) ?? false
          const mine = round?.mines?.includes(tile) ?? false
          const ended = round && round.status !== "active"
          return <button key={tile} onClick={() => reveal(tile)} disabled={!active || opened || busyTile != null} className={cn("relative aspect-square overflow-hidden rounded-[16px] border-b-4 transition duration-200 sm:rounded-[20px]", opened && !mine ? "border-emerald-700 bg-emerald-400 text-emerald-950 shadow-[0_0_20px_rgba(52,211,153,.2)]" : mine && ended ? "border-rose-900 bg-rose-500 text-white" : "border-[#193c25] bg-[#245132] text-white/20 hover:-translate-y-0.5 hover:bg-[#2d6540]", busyTile === tile && "animate-pulse")}>{busyTile === tile ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : mine && ended ? <Bomb className="mx-auto h-6 w-6 animate-bounce sm:h-8 sm:w-8" /> : opened ? <PawPrint className="mx-auto h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" /> : <span className="font-display text-lg font-black">?</span>}</button>
        })}</div>
      </div>

      <aside className="order-1 flex flex-col gap-3 rounded-[30px] bg-[#183522]/90 p-4 ring-1 ring-emerald-200/10 md:order-2">
        {!round && <><label><span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-white/38">Bet amount</span><div className="flex items-center gap-2 rounded-2xl bg-black/25 px-3 ring-1 ring-white/[.07]"><Coin className="h-5 w-5" /><input type="number" inputMode="decimal" value={bet || ""} onChange={(event) => setBet(Math.max(0, Math.min(Number(event.target.value), balance)))} className="min-w-0 flex-1 bg-transparent py-3 font-mono text-lg font-black outline-none" /><button onClick={() => setBet(Math.floor(balance))} className="text-[9px] font-black text-emerald-300">MAX</button></div></label>
          <div><span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-white/38">Grumpy pugs</span><div className="grid grid-cols-4 gap-1.5">{MINE_OPTIONS.map((count) => <button key={count} onClick={() => setMineCount(count)} className={cn("rounded-xl py-3 text-xs font-black", mineCount === count ? "bg-emerald-400 text-emerald-950" : "bg-white/[.07] text-white/50")}>{count}</button>)}</div></div></>}

        {error && <p className="rounded-xl bg-rose-500/12 px-3 py-2 text-center text-[10px] font-bold text-rose-200">{error}</p>}
        {!round ? <button onClick={start} disabled={busy || bet < 1 || bet > balance} className="mt-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-400 font-display text-lg font-black text-emerald-950 shadow-[0_7px_0_#13723e] active:translate-y-1 active:shadow-none disabled:opacity-35">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}Start digging</button> : active ? <button onClick={cashout} disabled={!round.revealed.length || busy} className="mt-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-300 font-display text-lg font-black text-amber-950 shadow-[0_7px_0_#9a5d10] active:translate-y-1 active:shadow-none disabled:opacity-35"><Coin className="h-5 w-5" />Cash out · {fmt(round.payout)}</button> : <div className="mt-auto space-y-2 text-center"><div className={cn("rounded-2xl px-3 py-3 font-display text-lg font-black", round.status === "bust" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300")}>{round.status === "bust" ? "The pug found you!" : `Won ${fmt(round.payout)} Stars`}</div><button onClick={reset} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-black"><RotateCcw className="h-4 w-4" />Play again</button></div>}
      </aside>
    </section>
  </div>
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof PawPrint }) { return <div className="rounded-2xl bg-[#183522] px-2 py-2.5 text-center ring-1 ring-white/[.06]"><Icon className="mx-auto h-3.5 w-3.5 text-emerald-300" /><b className="mt-1 block font-mono text-sm">{value}</b><span className="text-[8px] font-black uppercase tracking-wider text-white/28">{label}</span></div> }
