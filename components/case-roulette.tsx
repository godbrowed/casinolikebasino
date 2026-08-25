"use client"

import { useEffect, useRef, useState } from "react"
import type { GiftDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { fmt, rarityOf } from "@/lib/format"
import { cn } from "@/lib/utils"

const ITEM_STEP = 144
const REEL_LENGTH = 40
const WIN_INDEX = 32

type Props = { pool: GiftDTO[]; spinning: boolean; results: GiftDTO[]; selectedCount: number; onSettled: () => void }

function makeReel(pool: GiftDTO[], result?: GiftDTO): GiftDTO[] {
  if (pool.length === 0) return []
  const reel = Array.from({ length: REEL_LENGTH }, () => pool[Math.floor(Math.random() * pool.length)])
  if (result) reel[WIN_INDEX] = result
  return reel
}

function makeInitialReel(pool: GiftDTO[], lane: number): GiftDTO[] {
  if (pool.length === 0) return []
  return Array.from({ length: REEL_LENGTH }, (_, index) => pool[(index + lane * 3) % pool.length])
}

export function CaseRoulette({ pool, spinning, results, selectedCount, onSettled }: Props) {
  const shown = results.length ? results : Array.from({ length: selectedCount }, () => undefined)
  const settledRef = useRef(onSettled)
  useEffect(() => { settledRef.current = onSettled }, [onSettled])
  useEffect(() => {
    if (!spinning) return
    const timer = window.setTimeout(() => settledRef.current(), 5100)
    return () => window.clearTimeout(timer)
  }, [spinning])

  return <section className="relative overflow-hidden py-3">
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#77a1ff]/20 blur-[90px]" />
    <div className="relative flex flex-col gap-3">{shown.map((gift, index) => <Reel key={index} pool={pool} result={gift} spinning={spinning} lane={index + 1} compact={shown.length > 2} />)}</div>
  </section>
}

function Reel({ pool, result, spinning, lane, compact }: { pool: GiftDTO[]; result?: GiftDTO; spinning: boolean; lane: number; compact: boolean }) {
  const [reel, setReel] = useState(() => makeInitialReel(pool, lane))
  const [offset, setOffset] = useState(0)
  const [moving, setMoving] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spinning || !result) return
    setReel(makeReel(pool, result))
    setMoving(false)
    setOffset(0)
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const width = viewportRef.current?.offsetWidth ?? 360
        setMoving(true)
        setOffset(-(WIN_INDEX * ITEM_STEP + ITEM_STEP / 2 - width / 2))
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [pool, result, spinning])

  return <div ref={viewportRef} className={cn("relative overflow-hidden bg-[linear-gradient(180deg,rgba(37,99,214,.36),rgba(18,61,139,.08))]", compact ? "h-[112px]" : "h-[168px] md:h-[184px]")}>
    <div className="pointer-events-none absolute inset-y-2 left-1/2 z-20 w-[2px] -translate-x-1/2 rounded-full bg-white/65 shadow-[0_0_24px_5px_rgba(174,205,255,.8)]" />
    <i className="pointer-events-none absolute left-1/2 top-0 z-30 h-0 w-0 -translate-x-1/2 border-x-[13px] border-t-[18px] border-x-transparent border-t-white drop-shadow-[0_5px_8px_rgba(0,0,0,.25)]" />
    <i className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-0 w-0 -translate-x-1/2 rotate-180 border-x-[13px] border-t-[18px] border-x-transparent border-t-white drop-shadow-[0_-5px_8px_rgba(0,0,0,.25)]" />
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#173f8d] via-[#173f8d]/85 to-transparent md:w-40" /><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#173f8d] via-[#173f8d]/85 to-transparent md:w-40" />
    <div className="absolute left-3 top-3 z-20 rounded-full bg-white/10 px-2 py-1 text-[8px] font-black text-white/55 backdrop-blur-sm">#{lane}</div>
    <div className="flex h-full items-center gap-3 will-change-transform" style={{ transform: `translate3d(${offset}px,0,0)`, transition: moving ? "transform 4.85s cubic-bezier(.08,.7,.04,1)" : "none" }}>
      {reel.map((gift, index) => {
        const rarity = rarityOf(gift.rarity)
        const winner = moving && index === WIN_INDEX
        return <div key={`${gift.slug}-${index}`} className={cn("flex w-[132px] shrink-0 flex-col items-center justify-end rounded-[26px] px-2 pb-2 pt-1 transition-all", compact ? "h-[98px]" : "h-[148px]", winner ? "scale-[1.06] bg-[#41208b] shadow-[0_0_0_2px_rgba(255,255,255,.22),0_18px_40px_rgba(12,20,64,.45)]" : "bg-white/[.025]")}>
          <img src={gift.imageUrl || "/images/nft-gift.png"} alt="" className={cn("object-contain drop-shadow-[0_13px_12px_rgba(3,11,35,.45)]", compact ? "h-[52px] w-[72px]" : "h-[88px] w-[98px]")} />
          {!compact && <span className={cn("mt-0.5 max-w-[118px] truncate text-[9px] font-black", rarity.text)}>{gift.name}</span>}
          <span className="mt-1 flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-black text-white shadow-sm backdrop-blur-sm"><Coin className="h-3 w-3" />{fmt(gift.value)}</span>
        </div>
      })}
    </div>
  </div>
}
