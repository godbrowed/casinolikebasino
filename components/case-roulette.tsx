"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { GiftDTO } from "@/app/actions/cases"
import { rarityOf } from "@/lib/format"
import { cn } from "@/lib/utils"

const ITEM_W = 104 // px, incl. gap
const REEL_LEN = 60
const WIN_INDEX = 50

type Props = {
  pool: GiftDTO[]
  spinning: boolean
  result: GiftDTO | null
  onSettled: () => void
}

// Build a reel that ends on the winning item at WIN_INDEX.
function buildReel(pool: GiftDTO[], result: GiftDTO | null): GiftDTO[] {
  const reel: GiftDTO[] = []
  for (let i = 0; i < REEL_LEN; i++) {
    reel.push(pool[Math.floor(Math.random() * pool.length)])
  }
  if (result) reel[WIN_INDEX] = result
  return reel
}

export function CaseRoulette({ pool, spinning, result, onSettled }: Props) {
  const [reel, setReel] = useState<GiftDTO[]>(() => buildReel(pool, null))
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (spinning && result) {
      const newReel = buildReel(pool, result)
      setReel(newReel)
      setAnimating(false)
      setOffset(0)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const width = containerRef.current?.offsetWidth ?? 360
          const center = width / 2
          const jitter = ITEM_W * 0.28 * (Math.random() - 0.5)
          const target = WIN_INDEX * ITEM_W + ITEM_W / 2 - center + jitter
          setAnimating(true)
          setOffset(-target)
        })
      })
    }
  }, [spinning, result, pool])

  const winSlug = result?.slug

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-border bg-black/40 py-4">
      {/* center marker */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_16px_2px] shadow-primary/70" />
      <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-primary" />
      <div className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-primary" />
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black/70 to-transparent" />

      <div
        className="flex gap-2 px-2 will-change-transform"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 5.2s cubic-bezier(0.12, 0.63, 0.1, 1)" : "none",
        }}
        onTransitionEnd={() => {
          if (animating) onSettled()
        }}
      >
        {reel.map((g, i) => {
          const r = rarityOf(g.rarity)
          const isWin = animating && i === WIN_INDEX
          return (
            <div
              key={i}
              className={cn(
                "flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-card ring-1",
                r.ring,
                isWin && `${r.glow} scale-105`,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.imageUrl || "/images/nft-gift.png"} alt="" className="h-14 w-14 object-contain" />
              <span className={cn("mt-1 font-mono text-[10px]", r.text)}>{g.value.toLocaleString()}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
