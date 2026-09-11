"use client"

import { useEffect, useRef, useState } from "react"
import type { GiftDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { cn } from "@/lib/utils"

const ITEM_WIDTH = 164
const ITEM_STEP = ITEM_WIDTH + 12
const REEL_LENGTH = 40
const WIN_INDEX = 32

type Props = { pool: GiftDTO[]; spinning: boolean; results: GiftDTO[]; selectedCount: number; fast?: boolean; onSettled: () => void }

function makeReel(pool: GiftDTO[], result: GiftDTO | undefined, winIndex: number): GiftDTO[] {
  if (pool.length === 0) return []
  const reel = Array.from({ length: REEL_LENGTH }, () => pool[Math.floor(Math.random() * pool.length)])
  if (result) reel[winIndex] = result
  return reel
}

function makeInitialReel(pool: GiftDTO[], lane: number): GiftDTO[] {
  if (pool.length === 0) return []
  return Array.from({ length: REEL_LENGTH }, (_, index) => pool[(index + lane * 3) % pool.length])
}

export function CaseRoulette({ pool, spinning, results, selectedCount, fast = false, onSettled }: Props) {
  const shown = results.length ? results : Array.from({ length: selectedCount }, () => undefined)
  const settledRef = useRef(onSettled)
  useEffect(() => { settledRef.current = onSettled }, [onSettled])
  useEffect(() => {
    if (!spinning) return
    const timer = window.setTimeout(() => settledRef.current(), fast ? 820 : 5200)
    return () => window.clearTimeout(timer)
  }, [fast, spinning])

  return <section aria-label="Case opening reels" className="relative overflow-hidden py-3">
    <div className="relative flex flex-col gap-3">{shown.map((gift, index) => <Reel key={index} pool={pool} result={gift} spinning={spinning} lane={index + 1} compact={shown.length > 2} fast={fast} />)}</div>
  </section>
}

function Reel({ pool, result, spinning, lane, compact, fast }: { pool: GiftDTO[]; result?: GiftDTO; spinning: boolean; lane: number; compact: boolean; fast: boolean }) {
  const [reel, setReel] = useState(() => makeInitialReel(pool, lane))
  const [winIndex, setWinIndex] = useState(WIN_INDEX)
  const [offset, setOffset] = useState(0)
  const [moving, setMoving] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spinning || !result) return
    const landing = 29 + ((lane * 3 + Math.floor(Math.random() * 5)) % 7)
    setWinIndex(landing)
    setReel(makeReel(pool, result, landing))
    setMoving(false)
    setOffset(0)
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const width = viewportRef.current?.offsetWidth ?? 360
        setMoving(true)
        setOffset(-(landing * ITEM_STEP + ITEM_WIDTH / 2 - width / 2))
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [pool, result, spinning])

  return <div ref={viewportRef} className={cn("relative overflow-hidden", compact ? "h-[128px]" : "h-[220px] md:h-[244px]")}>
    <i className="pointer-events-none absolute left-1/2 top-0 z-30 h-0 w-0 -translate-x-1/2 border-x-[13px] border-t-[18px] border-x-transparent border-t-white" />
    <i className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-0 w-0 -translate-x-1/2 rotate-180 border-x-[13px] border-t-[18px] border-x-transparent border-t-white" />
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#19428b] to-transparent md:w-24" /><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#19428b] to-transparent md:w-24" />
    <span className="sr-only">Reel {lane}</span>
    <div className="flex h-full items-center gap-3 will-change-transform" style={{ transform: `translate3d(${offset}px,0,0)`, transition: moving ? `transform ${fast ? 0.62 : 4.35 + lane * 0.12}s cubic-bezier(.08,.7,.04,1)` : "none" }}>
      {reel.map((gift, index) => {
        const winner = moving && index === winIndex
        return <div key={`${gift.slug}-${index}`} className={cn("flex w-[164px] shrink-0 flex-col items-center justify-center rounded-2xl px-2 py-3 transition-colors", compact ? "h-[108px]" : "h-[200px]", winner ? "bg-white/[.08]" : "bg-transparent")}>
          <img src={gift.imageUrl || "/images/nft-gift.png"} alt="" className={cn("object-contain", compact ? "h-16 w-20" : "h-32 w-36")} />
          {!compact && <span className="mt-2 max-w-[148px] truncate text-sm font-medium text-white/90">{gift.name}</span>}
          <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-white"><Coin className="h-3.5 w-3.5" />{fmt(gift.value)}</span>
        </div>
      })}
    </div>
  </div>
}
