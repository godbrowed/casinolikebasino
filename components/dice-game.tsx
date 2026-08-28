"use client"

import { useState } from "react"
import { Dices, Loader2, ShieldCheck, Sparkles, Trophy } from "lucide-react"
import type { DiceResult } from "@/app/actions/dice"
import { rollPugDiceApi } from "@/lib/client-game-api"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { cn } from "@/lib/utils"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { playGameSound } from "@/lib/game-sound"

const MULTIPLIERS = [2, 3, 5, 10]

export function DiceGame() {
  const { me, setBalance } = useUser()
  const balance = me?.balance ?? 0
  const [bet, setBet] = useState(100)
  const [multiplier, setMultiplier] = useState(2)
  const [rolling, setRolling] = useState(false)
  const [displayRoll, setDisplayRoll] = useState<number | null>(null)
  const [result, setResult] = useState<DiceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chance = 90 / multiplier

  async function roll() {
    if (rolling || bet < 1 || bet > balance) return
    setRolling(true); setResult(null); setError(null); haptic("medium"); playGameSound("bet")
    const ticker = window.setInterval(() => setDisplayRoll(Math.floor(Math.random() * 10000 + 1) / 100), 55)
    try {
      const [settled] = await Promise.all([rollPugDiceApi(bet, multiplier), new Promise((resolve) => window.setTimeout(resolve, 950))])
      window.clearInterval(ticker); setDisplayRoll(settled.roll); setResult(settled); setBalance(settled.balance)
      hapticNotify(settled.won ? "success" : "error"); playGameSound(settled.won ? "cashout" : "crash")
    } catch (cause) {
      window.clearInterval(ticker); setDisplayRoll(null)
      const message = cause instanceof Error ? cause.message : "The dice could not be rolled"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars." : message)
    } finally { setRolling(false) }
  }

  return <main className="relative mx-auto min-h-[calc(100dvh-58px)] w-full max-w-[980px] overflow-hidden bg-[radial-gradient(circle_at_50%_-5%,#513083_0%,#25183f_38%,#0e0b18_78%)] px-3 pb-[calc(7rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-3 text-white md:px-5 md:pt-5">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:46px_46px]" />
    <header className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(125deg,#6b38ad,#3f2373_55%,#21153c)] p-5 ring-1 ring-white/10 md:p-7"><div className="relative z-10 max-w-[62%]"><span className="text-[9px] font-black uppercase tracking-[.18em] text-fuchsia-200/70">Instant game</span><h1 className="mt-1 font-display text-3xl font-black md:text-4xl">Pug Dice</h1><p className="mt-2 text-[11px] font-bold leading-relaxed text-white/50">Pick the risk. Roll under the target. Win instantly.</p></div><img src="/images/puggift-mascot-web-v1.webp" alt="Pug Dice" className="absolute -bottom-10 right-0 h-40 w-40 rounded-full object-cover drop-shadow-2xl md:right-8 md:h-48 md:w-48" /></header>

    <section className="relative mt-3 grid gap-3 md:grid-cols-[1fr_310px]">
      <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[30px] bg-[#171122]/92 p-5 ring-1 ring-white/[.08]">
        <div className={cn("relative flex h-40 w-40 items-center justify-center rounded-[42px] border border-white/10 bg-[linear-gradient(145deg,#f8f4ff,#cdb8ff)] text-[#2a1850] shadow-[0_24px_70px_rgba(139,92,246,.28),inset_0_-8px_0_rgba(69,35,123,.15)]", rolling && "animate-[spin_.38s_linear_infinite]")}><Dices className="absolute left-4 top-4 h-7 w-7 opacity-25" /><span className="font-display text-5xl font-black tabular-nums">{displayRoll?.toFixed(2) ?? "00.00"}</span></div>
        <div className="mt-5 flex items-center gap-2 rounded-full bg-white/[.06] px-4 py-2 text-xs font-bold text-white/55"><ShieldCheck className="h-4 w-4 text-emerald-300" />Win at <b className="text-white">{chance.toFixed(2)} or lower</b></div>
        {result && <div className={cn("mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black", result.won ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>{result.won ? <Trophy className="h-5 w-5" /> : <Dices className="h-5 w-5" />}{result.won ? `You won ${fmt(result.payout)} Stars` : "Pug missed this roll"}</div>}
      </div>

      <aside className="rounded-[30px] bg-[#26202f] p-4 ring-1 ring-white/[.08] md:p-5"><div className="text-[9px] font-black uppercase tracking-[.16em] text-fuchsia-200/55">Risk multiplier</div><div className="mt-2 grid grid-cols-4 gap-1.5 md:grid-cols-2">{MULTIPLIERS.map((value) => <button key={value} onClick={() => setMultiplier(value)} disabled={rolling} className={cn("rounded-2xl py-3 text-sm font-black transition", value === multiplier ? "bg-[#8b5cf6] text-white shadow-[0_5px_0_#5b32a8]" : "bg-white/[.07] text-white/48")}>{value}×</button>)}</div>
        <label className="mt-5 block text-[9px] font-black uppercase tracking-[.16em] text-white/35">Your bet</label><div className="mt-2 flex items-center rounded-2xl bg-black/25 px-3 ring-1 ring-white/[.07]"><Coin className="h-5 w-5" /><input value={bet} onChange={(event) => setBet(Math.max(0, Number(event.target.value)))} inputMode="decimal" className="min-w-0 flex-1 bg-transparent px-2 py-3.5 text-right font-mono text-lg font-black outline-none" /></div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">{[50, 100, 500].map((value) => <button key={value} onClick={() => setBet(value)} className="rounded-xl bg-white/[.06] py-2 text-[10px] font-black text-white/48">{value}</button>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-black/20 p-3"><div className="text-[9px] text-white/35">Chance</div><b className="mt-1 block text-sm">{chance.toFixed(2)}%</b></div><div className="rounded-2xl bg-black/20 p-3"><div className="text-[9px] text-white/35">Possible win</div><b className="mt-1 flex items-center justify-center gap-1 text-sm"><Coin className="h-3.5 w-3.5" />{fmt(bet * multiplier)}</b></div></div>
        {error && <p className="mt-3 rounded-xl bg-rose-500/15 p-2 text-center text-[10px] font-bold text-rose-200">{error}</p>}
        <button onClick={roll} disabled={rolling || bet < 1 || bet > balance} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#8b5cf6] py-4 font-display text-base font-black shadow-[0_5px_0_#5b32a8] transition active:translate-y-1 active:shadow-none disabled:opacity-45">{rolling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{rolling ? "Rolling…" : `Roll ${multiplier}×`}</button>
      </aside>
    </section>
  </main>
}
