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
  locked?: boolean
}

export function WinModal({ gift, onSell, onKeep, busy, locked = false }: Props) {
  if (!gift) return null
  const r = rarityOf(gift.rarity)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <button className="absolute inset-0 bg-black/60" onClick={onKeep} aria-label="Close" />
      <div role="dialog" aria-modal="true" aria-labelledby="won-gift-title" className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-sm overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center rounded-2xl bg-[#282b30] p-6 text-center">
          <span className={cn("text-xs font-medium", r.text)}>{r.label}</span>
          <div className="my-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="h-40 w-40 object-contain" />
          </div>
          <h3 id="won-gift-title" className="text-xl font-semibold tracking-tight">{gift.name}</h3>
          <div className="mt-1 flex items-center gap-1.5">
            <Coin className="h-4 w-4" />
            <span className="text-lg font-semibold tabular-nums">{fmt(gift.value)}</span>
          </div>

          {gift.rewardType === "currency" ? (
            <button
              onClick={onKeep}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Added to balance
            </button>
          ) : locked ? (
            <div className="mt-5 w-full rounded-xl bg-white/5 p-3">
              <b className="block text-sm font-semibold text-white/90">Invite 3 friends to unlock your gift</b>
              <p className="mt-2 text-xs leading-relaxed text-white/65">Each friend must be new to PugGift, have Telegram Premium and own at least one Telegram NFT gift.</p>
              <button onClick={onKeep} disabled={busy} className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Keep in profile</button>
            </div>
          ) : (
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <button
                onClick={onSell}
                disabled={busy}
                className="rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-50"
              >
                Sell · {fmt(gift.value)}
              </button>
              <button
                onClick={onKeep}
                disabled={busy}
                className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
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
