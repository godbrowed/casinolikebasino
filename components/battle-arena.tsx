"use client"

import { useEffect, useMemo, useState } from "react"
import { Crown, RotateCcw } from "lucide-react"
import type { BattleResult } from "@/app/actions/battles"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const COLORS = ["#2f70ff", "#ff9d3d", "#9a3de0", "#24b88b"]

export function BattleArena({ result, onDone }: { result: BattleResult; onDone: () => void }) {
  const [angle, setAngle] = useState(0)
  const [done, setDone] = useState(false)
  const segment = 360 / result.players.length
  const wheel = useMemo(() => result.players.map((_, index) => `${COLORS[index]} ${index * segment}deg ${(index + 1) * segment}deg`).join(","), [result.players, segment])

  useEffect(() => {
    const landing = 360 - (result.winnerSlot * segment + segment / 2)
    const start = window.setTimeout(() => setAngle(1440 + landing), 90)
    const finish = window.setTimeout(() => { setDone(true); hapticNotify(result.youWon ? "success" : "error") }, 3300)
    return () => { window.clearTimeout(start); window.clearTimeout(finish) }
  }, [result, segment])

  const winner = result.players.find((player) => player.slot === result.winnerSlot)
  return <div className="flex min-h-[600px] flex-col items-center gap-5 rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_50%_25%,#162a59,#0b1019_58%)] p-4">
    <div className="text-center"><div className="text-[9px] font-black uppercase tracking-[.18em] text-blue-300">Stars PvP</div><h1 className="font-display text-xl font-black">{done ? `${winner?.name ?? "Winner"} takes the bank` : "The wheel is spinning"}</h1></div>

    <div className="relative mt-2 aspect-square w-full max-w-[340px]">
      <div className="absolute left-1/2 top-[-10px] z-20 -translate-x-1/2 border-x-[13px] border-t-[22px] border-x-transparent border-t-white drop-shadow-[0_5px_8px_rgba(0,0,0,.7)]" />
      <div className="absolute inset-0 rounded-full border-[10px] border-[#252a34] shadow-[0_18px_40px_rgba(0,0,0,.55),inset_0_0_25px_rgba(0,0,0,.35)] transition-transform duration-[3000ms] ease-[cubic-bezier(.12,.72,.06,1)]" style={{ background: `conic-gradient(${wheel})`, transform: `rotate(${angle}deg)` }}>
        {result.players.map((player, index) => { const middle = index * segment + segment / 2; return <div key={player.slot} className="absolute left-1/2 top-1/2 h-12 w-12" style={{ transform: `translate(-50%,-50%) rotate(${middle}deg) translateY(-118px) rotate(${-middle}deg)` }}><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#20242d] font-black shadow-lg">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : player.name.slice(0, 1).toUpperCase()}</div></div> })}
      </div>
      <div className="absolute inset-[34%] flex flex-col items-center justify-center rounded-full border-8 border-[#252a34] bg-[#11151d] text-center shadow-[0_0_30px_rgba(0,0,0,.65)]"><span className="text-[9px] font-black uppercase text-white/40">Bank</span><span className="mt-1 flex items-center gap-1 font-display text-2xl font-black"><Coin className="h-6 w-6" />{fmt(result.pot)}</span></div>
    </div>

    <div className="grid w-full grid-cols-2 gap-2">{result.players.map((player) => <div key={player.slot} className={cn("flex items-center gap-2 rounded-2xl border p-2.5", done && player.slot === result.winnerSlot ? "border-amber-300/50 bg-amber-300/10" : "border-white/8 bg-white/5")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black">{done && player.slot === result.winnerSlot ? <Crown className="h-4 w-4 text-amber-300" /> : player.name.slice(0,1).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-xs font-black">{player.isYou ? "You" : player.name}</div><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Coin className="h-3 w-3" />{fmt(player.total)}</div></div></div>)}</div>

    {done && <div className={cn("animate-pop-in w-full rounded-3xl px-4 py-3 text-center font-display text-lg font-black", result.youWon ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>{result.youWon ? `You won ${fmt(result.youWinAmount)} Stars` : "The bank went to another player"}</div>}
    <button onClick={onDone} disabled={!done} className="btn-glow mt-auto flex w-full items-center justify-center gap-2 rounded-3xl py-4 font-display font-black disabled:opacity-40"><RotateCcw className="h-5 w-5" />Another bet</button>
  </div>
}
