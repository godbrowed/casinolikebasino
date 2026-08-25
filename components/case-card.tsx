"use client"

import Link from "next/link"
import type { CaseDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { fmt, RARITY } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const ACCENT: Record<string, { ring: string; glow: string; from: string }> = {
  cyan: { ring: "ring-cyan-500/20", glow: "bg-cyan-500/30", from: "from-cyan-500/10" },
  magenta: { ring: "ring-fuchsia-500/20", glow: "bg-fuchsia-500/30", from: "from-fuchsia-500/10" },
  gold: { ring: "ring-amber-500/20", glow: "bg-amber-500/30", from: "from-amber-500/10" },
  blue: { ring: "ring-blue-500/20", glow: "bg-blue-500/30", from: "from-blue-500/10" },
  red: { ring: "ring-rose-500/25", glow: "bg-rose-500/30", from: "from-rose-500/10" },
}

export function CaseCard({ c }: { c: CaseDTO }) {
  const accent = c.isFree ? ACCENT.gold : ACCENT[c.accent] ?? ACCENT.cyan
  const top = c.items[0]
  const left = c.items[1]
  const right = c.items[2]
  const topRarity = top ? RARITY[top.rarity] ?? RARITY.common : RARITY.common

  return (
    <Link
      href={`/case/${c.slug}`}
      onClick={() => haptic("light")}
      className={cn(
        "case-card group relative flex flex-col overflow-hidden rounded-[1.35rem] p-3 ring-1 transition-all duration-300 active:scale-[0.97]",
        accent.ring,
      )}
    >
      <div className="relative z-10 mb-1 flex items-center justify-between">
        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", topRarity.chip)}>
          {c.isFree ? "FREE" : topRarity.label}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {c.isFree ? "no cost" : "top prize"}
          {!c.isFree && <Coin className="h-3 w-3" />}
          {!c.isFree && <span className="font-mono font-bold text-foreground">{fmt(top?.value ?? 0)}</span>}
        </span>
      </div>

      <div className="relative flex aspect-square w-full items-center justify-center">
        <div className={cn("absolute h-24 w-24 rounded-full blur-2xl", accent.glow)} />
        <div className={cn("absolute inset-0 rounded-xl bg-gradient-to-b to-transparent", accent.from)} />

        {left && (
          <img
            src={left.imageUrl || "/images/nft-gift.png"}
            alt=""
            aria-hidden
            className="absolute left-1 bottom-3 h-[46%] w-[46%] -rotate-12 object-contain opacity-70 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-x-1"
          />
        )}
        {right && (
          <img
            src={right.imageUrl || "/images/nft-gift.png"}
            alt=""
            aria-hidden
            className="absolute right-1 bottom-3 h-[46%] w-[46%] rotate-12 object-contain opacity-70 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:translate-x-1"
          />
        )}
        {top && (
          <img
            src={top.imageUrl || "/images/nft-gift.png"}
            alt={c.name}
            className="relative z-10 h-[72%] w-[72%] object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-110 group-active:scale-105"
          />
        )}
      </div>

      <div className="relative z-10 mt-1 flex flex-col items-center">
        <div className="w-full truncate text-center font-display text-[15px] font-black tracking-tight">{c.isFree ? "Free Case" : c.name}</div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {c.isFree ? "One free opening" : "Gift rewards"}
        </div>
        <div className={cn(
          "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 transition-colors",
          c.isFree
            ? "bg-amber-400/10 text-amber-200 ring-amber-400/30 group-hover:bg-amber-400 group-hover:text-amber-950"
            : "bg-secondary/80 ring-border group-hover:bg-primary group-hover:text-primary-foreground",
        )}>
          {!c.isFree && <Coin className="h-3.5 w-3.5" />}
          <span className="font-mono text-sm font-bold tabular-nums">{c.isFree ? "OPEN FREE" : fmt(c.price)}</span>
        </div>
      </div>
    </Link>
  )
}
