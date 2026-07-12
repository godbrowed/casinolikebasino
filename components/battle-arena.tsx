"use client"

import { useEffect, useRef, useState } from "react"
import { Crown } from "lucide-react"
import type { BattleResult } from "@/app/actions/battles"
import { Coin } from "@/components/coin"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

export function BattleArena({
  result,
  poolImages,
  onDone,
}: {
  result: BattleResult
  poolImages: string[]
  onDone: () => void
}) {
  // revealed = how many rounds fully revealed; rolling = a round currently spinning
  const [revealed, setRevealed] = useState(0)
  const [rolling, setRolling] = useState(true)
  const [done, setDone] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t = timers.current
    let round = 0
    function step() {
      setRolling(true)
      haptic("light")
      const spin = setTimeout(() => {
        setRevealed(round + 1)
        setRolling(false)
        round++
        if (round < result.rounds) {
          const gap = setTimeout(step, 500)
          t.push(gap)
        } else {
          const fin = setTimeout(() => {
            setDone(true)
            hapticNotify(result.youWon ? "success" : "error")
          }, 700)
          t.push(fin)
        }
      }, 1100)
      t.push(spin)
    }
    step()
    return () => {
      t.forEach(clearTimeout)
    }
  }, [result])

  return (
    <div className="flex flex-col gap-4">
      {/* status bar */}
      <div className="card-premium flex items-center justify-between rounded-2xl p-3 ring-1 ring-border">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.coverUrl || "/images/nft-gift.png"} alt="" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <div className="font-display text-sm font-bold">{result.caseName}</div>
            <div className="text-[10px] text-muted-foreground">
              {done ? "Finished" : rolling ? "Rolling…" : `Round ${revealed}/${result.rounds}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pot</span>
          <Coin className="h-3.5 w-3.5" />
          <span className="font-mono text-sm font-black tabular-nums">{fmt(result.pot)}</span>
        </div>
      </div>

      {/* players */}
      <div
        className={cn(
          "grid gap-2.5",
          result.players.length <= 2 ? "grid-cols-2" : result.players.length === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {result.players.map((p) => {
          const isWinner = done && p.slot === result.winnerSlot
          const runningTotal = p.pulls.slice(0, revealed).reduce((s, g) => s + g.value, 0)
          return (
            <div
              key={p.slot}
              className={cn(
                "card-premium relative flex flex-col gap-2 rounded-2xl p-2.5 ring-1 transition-all",
                isWinner
                  ? "ring-2 ring-amber-400 shadow-[0_0_28px_-4px] shadow-amber-400/50"
                  : done
                    ? "opacity-55 ring-border"
                    : "ring-border",
              )}
            >
              {isWinner && (
                <span className="absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-background">
                  <Crown className="h-3 w-3" /> WINNER
                </span>
              )}
              {/* player head */}
              <div className="flex items-center gap-1.5">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl || "/images/nft-gift.png"} alt="" className="h-5 w-5 rounded-full" crossOrigin="anonymous" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    {p.name[0]?.toUpperCase()}
                  </span>
                )}
                <span className={cn("truncate text-[11px] font-bold", p.isYou && "text-cyan-300")}>{p.name}</span>
              </div>

              {/* reel */}
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: result.rounds }).map((_, r) => {
                  const revealedThis = r < revealed
                  const rollingThis = r === revealed && rolling
                  const gift = p.pulls[r]
                  return (
                    <ReelCell
                      key={r}
                      rolling={rollingThis}
                      gift={revealedThis ? gift : null}
                      poolImages={poolImages}
                    />
                  )
                })}
              </div>

              {/* total */}
              <div className="mt-0.5 flex items-center justify-center gap-1 rounded-lg bg-secondary/60 py-1">
                <Coin className="h-3 w-3" />
                <span className="font-mono text-xs font-black tabular-nums">{fmt(runningTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* result footer */}
      {done && (
        <div className="animate-pop-in flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-lg font-black",
              result.youWon ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
            )}
          >
            {result.youWon ? (
              <>
                <Coin className="h-6 w-6" /> +{fmt(result.youWinAmount)} GRAM
              </>
            ) : (
              <>Better luck next time</>
            )}
          </div>
          <button
            onClick={onDone}
            className="btn-glow w-full rounded-2xl py-3.5 font-display text-base font-black"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  )
}

function ReelCell({
  rolling,
  gift,
  poolImages,
}: {
  rolling: boolean
  gift: { name: string; rarity: string; imageUrl: string; value: number } | null
  poolImages: string[]
}) {
  const [shuffleSrc, setShuffleSrc] = useState(poolImages[0] ?? "/images/nft-gift.png")

  useEffect(() => {
    if (!rolling) return
    const id = setInterval(() => {
      setShuffleSrc(poolImages[Math.floor(Math.random() * poolImages.length)] ?? "/images/nft-gift.png")
    }, 80)
    return () => clearInterval(id)
  }, [rolling, poolImages])

  const r = gift ? rarityOf(gift.rarity) : null

  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-secondary/40",
        r ? r.ring : "border-border",
        r ? "ring-1" : "",
      )}
    >
      {gift ? (
        <div className="animate-pop-in flex h-full w-full flex-col items-center justify-center p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="h-3/4 w-3/4 object-contain" />
        </div>
      ) : rolling ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shuffleSrc || "/images/nft-gift.png"} alt="" className="h-3/4 w-3/4 object-contain opacity-70 blur-[1px]" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
      )}
    </div>
  )
}
