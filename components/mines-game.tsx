"use client"

import { useEffect, useState } from "react"
import { Bomb, Bone, ChevronUp, Clover, Loader2, RotateCcw, ShieldCheck, Sparkles, Trophy } from "lucide-react"
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

  const safeTotal = 25 - mineCount
  const safeOpened = round?.revealed.filter((tile) => !round.mines?.includes(tile)).length ?? 0
  const progress = safeTotal ? Math.min(100, (safeOpened / safeTotal) * 100) : 0

  return <main className="game-surface game-surface--mines relative mx-auto min-h-[calc(100dvh-64px)] w-full max-w-[980px] overflow-hidden px-3 pb-[calc(7rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-3 text-white md:px-5 md:pt-5">
    <div className="pointer-events-none absolute inset-0 opacity-[.16] [background-image:linear-gradient(rgba(167,243,208,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(167,243,208,.16)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
    <div className="pointer-events-none absolute -left-24 top-52 h-64 w-64 rounded-full bg-lime-400/10 blur-[80px]" />
    <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-[90px]" />

    <header className="relative mb-4 flex items-center gap-4 px-2 py-3">
      <Bomb className="h-10 w-10 shrink-0 text-emerald-300" strokeWidth={1.6} />
      <div><h1 className="font-display text-3xl font-bold tracking-tight">Mines</h1><p className="mt-1 text-sm text-white/50">Find the bones. Avoid the mines.</p></div>
    </header>

    <section className="relative grid gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="app-panel order-2 overflow-hidden rounded-[30px] p-2.5 md:order-1 md:p-4">
        <div className="mb-2.5 grid grid-cols-3 gap-1.5 md:mb-4 md:gap-2"><Metric label="Safe spots" value={`${safeOpened}/${safeTotal}`} icon={ShieldCheck} tone="emerald" /><Metric label="Current" value={`${fmt(round?.multiplier ?? 1)}×`} icon={Sparkles} tone="amber" /><Metric label="Next bone" value={`${fmt(round?.nextMultiplier ?? 1)}×`} icon={ChevronUp} tone="blue" /></div>
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_14px_rgba(74,222,128,.65)] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
        <div className="rounded-[25px] bg-black/20 p-2 ring-1 ring-white/[.045] md:p-3">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">{Array.from({ length: 25 }, (_, tile) => {
          const opened = round?.revealed.includes(tile) ?? false
          const mine = round?.mines?.includes(tile) ?? false
          const ended = round && round.status !== "active"
          return <button key={tile} aria-label={`Tile ${tile + 1}`} onClick={() => reveal(tile)} disabled={!active || opened || busyTile != null} className={cn("group relative aspect-square overflow-hidden rounded-[13px] border border-white/[.055] transition duration-200 sm:rounded-[18px]", opened && !mine ? "translate-y-[2px] bg-[linear-gradient(145deg,#a3e635,#34d399)] text-[#092014] shadow-[inset_0_2px_7px_rgba(255,255,255,.42),0_0_18px_rgba(52,211,153,.2)]" : mine && ended ? "bg-[radial-gradient(circle_at_50%_30%,#fb7185,#881337)] text-white shadow-[0_0_24px_rgba(244,63,94,.35)]" : "bg-[linear-gradient(145deg,#2c6540,#173a25)] text-emerald-100/18 shadow-[0_4px_0_#0b2415,inset_0_1px_0_rgba(255,255,255,.08)] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-1 active:shadow-none", busyTile === tile && "animate-pulse")}>{busyTile === tile ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-200" /> : mine && ended ? <Bomb className="mx-auto h-8 w-8 animate-[bounce_.7s_ease-in-out_2] fill-current sm:h-10 sm:w-10" /> : opened ? <><span className="absolute inset-1 rounded-[10px] border border-white/25" /><Bone className="mx-auto h-6 w-6 rotate-[-18deg] sm:h-8 sm:w-8" fill="currentColor" /></> : <Bone className="mx-auto h-5 w-5 rotate-[-24deg] transition group-hover:rotate-0 group-hover:scale-110 sm:h-6 sm:w-6" />}</button>
          })}</div>
        </div>
      </div>

      <aside className="app-panel order-1 flex flex-col gap-3 rounded-[28px] p-3.5 md:order-2 md:self-start md:p-4">
        {!round ? <><div className="flex items-center justify-between"><div><span className="text-[8px] font-black uppercase tracking-[.16em] text-emerald-300/55">New expedition</span><h2 className="font-display text-lg font-black">Choose your risk</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-300"><ShieldCheck className="h-4 w-4" /></span></div>
          <label><span className="mb-1.5 block text-[8px] font-black uppercase tracking-[.14em] text-white/35">Bet amount</span><div className="flex items-center gap-2 rounded-2xl bg-black/25 px-3 ring-1 ring-white/[.07]"><Coin className="h-5 w-5" /><input aria-label="Bet amount" type="number" inputMode="decimal" value={bet || ""} onChange={(event) => setBet(Math.max(0, Math.min(Number(event.target.value), balance)))} className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-lg font-black outline-none" /><button onClick={() => setBet(Math.floor(balance))} className="rounded-lg bg-white/[.07] px-2 py-1.5 text-[8px] font-black text-emerald-200">MAX</button></div></label>
          <div><div className="mb-1.5 flex items-center justify-between"><span className="text-[8px] font-black uppercase tracking-[.14em] text-white/35">Mines</span><span className="text-[9px] font-bold text-white/30">More = bigger wins</span></div><div className="grid grid-cols-4 gap-1.5">{MINE_OPTIONS.map((count) => <button key={count} onClick={() => setMineCount(count)} className={cn("flex min-h-12 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition", mineCount === count ? "bg-gradient-to-b from-lime-300 to-emerald-400 text-emerald-950 shadow-[0_4px_0_#10743d]" : "bg-white/[.06] text-white/42 ring-1 ring-white/[.04]")}><Bomb className={cn("h-5 w-5", mineCount === count ? "fill-emerald-950/15" : "opacity-55")} />{count}</button>)}</div></div></> : <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/[.055]"><div className="flex items-center justify-between"><div><span className="text-[8px] font-black uppercase tracking-[.16em] text-white/35">Live expedition</span><div className="mt-1 flex items-center gap-2 font-display text-lg font-black"><Coin className="h-5 w-5" />{fmt(round.payout)}</div></div><span className={cn("flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl", active ? "bg-emerald-300/10 text-emerald-300" : round.status === "bust" ? "bg-rose-400/10 text-rose-300 ring-1 ring-rose-300/20" : "bg-amber-300/10 text-amber-300")}>{active ? <Bone className="h-5 w-5" /> : round.status === "bust" ? <Bomb className="h-6 w-6 fill-current" /> : <Trophy className="h-5 w-5" />}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-bold text-white/38"><span className="rounded-xl bg-white/[.04] px-2 py-2">Mines <b className="float-right text-white">{round.mineCount}</b></span><span className="rounded-xl bg-white/[.04] px-2 py-2">Bones <b className="float-right text-white">{safeOpened}</b></span></div></div>}

        {error && <p className="rounded-xl bg-rose-500/12 px-3 py-2 text-center text-[10px] font-bold text-rose-200">{error}</p>}
        {!round ? <button onClick={start} disabled={busy || bet < 1 || bet > balance} className="mt-auto flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-300 to-emerald-400 font-display text-base font-black text-emerald-950 shadow-[0_6px_0_#10743d,0_14px_28px_rgba(16,185,129,.18)] transition active:translate-y-1 active:shadow-none disabled:translate-y-0 disabled:opacity-35">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bomb className="h-5 w-5 fill-current" />}Start mine hunt</button> : active ? <button onClick={cashout} disabled={!round.revealed.length || busy} className="mt-auto flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-300 font-display text-base font-black text-amber-950 shadow-[0_6px_0_#9a5d10,0_14px_28px_rgba(251,191,36,.15)] transition active:translate-y-1 active:shadow-none disabled:translate-y-0 disabled:opacity-35"><Coin className="h-5 w-5" />Cash out · {fmt(round.payout)}</button> : <div className="mt-auto space-y-2 text-center"><div className={cn("rounded-2xl px-3 py-3 font-display text-base font-black", round.status === "bust" ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-300/10" : "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/10")}>{round.status === "bust" ? "You hit a mine" : `Treasure secured · ${fmt(round.payout)}`}</div><button onClick={reset} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[.08] text-sm font-black ring-1 ring-white/[.06]"><RotateCcw className="h-4 w-4" />Hunt again</button></div>}
      </aside>
    </section>
  </main>
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof ShieldCheck; tone: "emerald" | "amber" | "blue" }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-[15px] bg-white/[.045] px-2 py-2 ring-1 ring-white/[.05] md:px-3 md:py-2.5"><span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]", tone === "emerald" ? "bg-emerald-300/10 text-emerald-300" : tone === "amber" ? "bg-amber-300/10 text-amber-300" : "bg-sky-300/10 text-sky-300")}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><b className="block truncate font-mono text-[11px] leading-none md:text-sm">{value}</b><span className="mt-1 block truncate text-[7px] font-black uppercase tracking-[.08em] text-white/28 md:text-[8px]">{label}</span></span></div>
}
