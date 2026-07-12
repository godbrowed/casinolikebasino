"use client"

import type { GiftDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { rarityOf, fmt } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  gift: GiftDTO | null
  onSell: () => void
  onKeep: () => void
  busy?: boolean
}

export function WinModal({ gift, onSell, onKeep, busy }: Props) {
  if (!gift) return null
  const r = rarityOf(gift.rarity)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onKeep} aria-label="Close" />
      <div className="relative w-full max-w-xs animate-in fade-in zoom-in-95 duration-300">
        <div
          className={cn(
            "flex flex-col items-center rounded-3xl border border-border bg-card p-6 text-center ring-1",
            r.ring,
            r.glow,
          )}
        >
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", r.chip)}>{r.label}</span>
          <div className="relative my-4">
            <div className={cn("absolute inset-0 rounded-full blur-2xl", r.bg, "bg-gradient-to-b to-transparent")} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="relative h-32 w-32 object-contain" />
          </div>
          <h3 className="font-display text-xl font-black">{gift.name}</h3>
          <div className="mt-1 flex items-center gap-1.5">
            <Coin className="h-4 w-4" />
            <span className="font-mono text-lg font-bold">{fmt(gift.value)}</span>
          </div>

          {gift.rewardType === "currency" ? (
            <button
              onClick={onKeep}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Added to balance
            </button>
          ) : (
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <button
                onClick={onSell}
                disabled={busy}
                className="rounded-xl bg-secondary py-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-50"
              >
                Sell · {fmt(gift.value)}
              </button>
              <button
                onClick={onKeep}
                disabled={busy}
                className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                Keep
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
