"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { GiftDTO } from "@/app/actions/cases"
import { rarityOf } from "@/lib/format"
import { cn } from "@/lib/utils"

const ITEM_W = 88
const REEL_LEN = 40
const WIN_INDEX = 31

type Props = { pool: GiftDTO[]; spinning: boolean; results: GiftDTO[]; onSettled: () => void }

function makeReel(pool: GiftDTO[], result?: GiftDTO): GiftDTO[] {
  const reel = Array.from({ length: REEL_LEN }, () => pool[Math.floor(Math.random() * pool.length)])
  if (result) reel[WIN_INDEX] = result
  return reel
}

export function CaseRoulette({ pool, spinning, results, onSettled }: Props) {
  const shown = results.length ? results : [undefined]
  const finishRef = useRef<number | null>(null)
  useEffect(() => {
    if (!spinning) return
    finishRef.current = window.setTimeout(onSettled, 4600)
    return () => { if (finishRef.current) window.clearTimeout(finishRef.current) }
  }, [onSettled, spinning, results.length])

  return <section className="relative overflow-hidden rounded-[30px] border border-blue-300/15 bg-[linear-gradient(145deg,#1b2f61,#101723)] p-3 shadow-[0_10px_0_-6px_rgba(0,0,0,.65)]">
    <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-400/15 blur-3xl" /><div className="relative mb-3 flex items-center justify-between px-1"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#7f9cff]">Giftlys case machine</div><div className="font-display text-lg font-black">{spinning ? "Finding your drops…" : "Tap open to start"}</div></div><div className="rounded-2xl bg-white/8 px-3 py-1.5 text-[10px] font-black text-white/65">{shown.length} DROP{shown.length > 1 ? "S" : ""}</div></div>
    <div className={cn("grid gap-2", shown.length > 1 ? "grid-cols-2" : "grid-cols-1")}>{shown.map((gift, index) => <Reel key={`${gift?.slug ?? "preview"}-${index}-${spinning}`} pool={pool} result={gift} spinning={spinning} />)}</div>
  </section>
}

function Reel({ pool, result, spinning }: { pool: GiftDTO[]; result?: GiftDTO; spinning: boolean }) {
  const [reel, setReel] = useState(() => makeReel(pool))
  const [offset, setOffset] = useState(0)
  const [moving, setMoving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!spinning || !result) return
    setReel(makeReel(pool, result)); setMoving(false); setOffset(0)
    const one = requestAnimationFrame(() => requestAnimationFrame(() => {
      const width = ref.current?.offsetWidth ?? 180
      setMoving(true)
      setOffset(-(WIN_INDEX * ITEM_W + ITEM_W / 2 - width / 2))
    }))
    return () => cancelAnimationFrame(one)
  }, [pool, result, spinning])
  return <div ref={ref} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 py-3">
    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_2px_rgba(47,91,255,.9)]" />
    <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 border-x-7 border-t-7 border-x-transparent border-t-primary" />
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#101723] to-transparent" /><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#101723] to-transparent" />
    <div className="flex gap-2 px-1 will-change-transform" style={{ transform: `translateX(${offset}px)`, transition: moving ? "transform 4.5s cubic-bezier(.12,.68,.08,1)" : "none" }}>
      {reel.map((gift, index) => {
        const rarity = rarityOf(gift.rarity)
        const won = moving && index === WIN_INDEX
        return <div key={index} className={cn("flex h-[74px] w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#282d38]", rarity.ring, won && "scale-105 shadow-[0_0_22px_rgba(79,121,255,.7)]")}><img src={gift.imageUrl || "/images/nft-gift.png"} alt="" className="h-11 w-11 object-contain" /><span className={cn("mt-0.5 font-mono text-[9px] font-bold", rarity.text)}>{gift.value.toLocaleString()}</span></div>
      })}
    </div>
  </div>
}
