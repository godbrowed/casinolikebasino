"use client"

import { useEffect, useMemo, useState } from "react"
import { Crown, RotateCcw } from "lucide-react"
import type { BattleResult } from "@/app/actions/battles"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const COLORS = ["#2f70ff", "#ff9d3d", "#9a3de0", "#24b88b", "#f0447d", "#00b8d9", "#f4c430", "#7c6cff"]

export function BattleArena({ result, onDone }: { result: BattleResult; onDone: () => void }) {
  const [angle, setAngle] = useState(0)
  const [done, setDone] = useState(false)
  const segments = useMemo(() => {
    const bank = result.players.reduce((sum, player) => sum + player.total, 0)
    let cursor = 0
    return result.players.map((player, index) => {
      const start = cursor
      const size = bank > 0 ? player.total / bank * 360 : 360 / result.players.length
      cursor += size
      return { start, end: cursor, middle: start + size / 2, color: COLORS[index % COLORS.length] }
    })
  }, [result.players])
  const wheel = useMemo(() => segments.map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`).join(","), [segments])

  useEffect(() => {
    const winnerIndex = result.players.findIndex((player) => player.slot === result.winnerSlot)
    const landing = 360 - (segments[Math.max(0, winnerIndex)]?.middle ?? 0)
    const start = window.setTimeout(() => setAngle(1440 + landing), 90)
    const finish = window.setTimeout(() => { setDone(true); hapticNotify(result.youWon ? "success" : "error") }, 3300)
    return () => { window.clearTimeout(start); window.clearTimeout(finish) }
  }, [result, segments])

  const winner = result.players.find((player) => player.slot === result.winnerSlot)
  return <div className="app-panel flex min-h-[calc(100dvh-170px)] flex-col items-center gap-5 overflow-hidden rounded-[32px] p-4 md:p-6">
    <div className="flex items-center gap-3 text-left"><img src="/images/puggift-mark-v4.svg" alt="" className="h-11 w-11 rounded-[15px] border border-[#6685ff]/45 object-cover" /><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-blue-300">PugGift PvP</div><h1 className="font-display text-xl font-black">{done ? `${winner?.name ?? "Winner"} takes the bank` : "The wheel is spinning"}</h1></div></div>

    <div className="relative mt-2 aspect-square w-full max-w-[480px]">
      <div className="absolute left-1/2 top-[-10px] z-20 -translate-x-1/2 border-x-[13px] border-t-[22px] border-x-transparent border-t-white drop-shadow-[0_5px_8px_rgba(0,0,0,.7)]" />
      <div className="absolute inset-0 rounded-full border-[10px] border-[#252a34] shadow-[0_18px_40px_rgba(0,0,0,.55),inset_0_0_25px_rgba(0,0,0,.35)] transition-transform duration-[3000ms] ease-[cubic-bezier(.12,.72,.06,1)]" style={{ background: `conic-gradient(${wheel})`, transform: `rotate(${angle}deg)` }}>
        {result.players.slice(0, 12).map((player, index) => { const rad = (segments[index]?.middle ?? 0) * Math.PI / 180; return <div key={player.slot} className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + Math.sin(rad) * 39}%`, top: `${50 - Math.cos(rad) * 39}%` }}><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#20242d] font-black shadow-lg">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : player.name.slice(0, 1).toUpperCase()}</div></div> })}
      </div>
      <div className="absolute inset-[34%] flex flex-col items-center justify-center rounded-full border-8 border-[#252a34] bg-[#11151d] text-center shadow-[0_0_30px_rgba(0,0,0,.65)]"><span className="text-[9px] font-black uppercase text-white/40">Bank</span><span className="mt-1 flex items-center gap-1 font-display text-2xl font-black"><Coin className="h-6 w-6" />{fmt(result.pot)}</span></div>
    </div>

    <div className="grid max-h-60 w-full grid-cols-2 gap-2 overflow-y-auto">{result.players.map((player) => <div key={player.slot} className={cn("flex items-center gap-2 rounded-2xl border p-2.5", done && player.slot === result.winnerSlot ? "border-amber-300/50 bg-amber-300/10" : "border-white/8 bg-white/5")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black">{done && player.slot === result.winnerSlot ? <Crown className="h-4 w-4 text-amber-300" /> : player.name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{player.isYou ? "You" : player.name}</div><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Coin className="h-3 w-3" />{fmt(player.total)}</div></div><span className="font-mono text-[10px] font-black text-white/45">{(player.total / result.grossBank * 100).toFixed(1)}%</span></div>)}</div>

    {done && <div className={cn("animate-pop-in w-full rounded-3xl px-4 py-3 text-center font-display text-lg font-black", result.youWon ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>{result.youWon ? `You won ${fmt(result.youWinAmount)} Stars` : "The bank went to another player"}</div>}
    <button onClick={onDone} disabled={!done} className="btn-glow mt-auto flex w-full items-center justify-center gap-2 rounded-3xl py-4 font-display font-black disabled:opacity-40"><RotateCcw className="h-5 w-5" />Another bet</button>
  </div>
}
