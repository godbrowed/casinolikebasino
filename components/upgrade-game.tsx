"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Package, ArrowRight, TrendingUp, Sparkles } from "lucide-react"
import Link from "next/link"
import { upgradeGift } from "@/app/actions/upgrade"
import { upgradeChance } from "@/lib/upgrade-shared"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { rarityOf, fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number }

const RING_R = 86
const RING_C = 2 * Math.PI * RING_R

function arcColor(chance: number): string {
  if (chance >= 0.6) return "#34d399" // emerald
  if (chance >= 0.3) return "#22d3ee" // cyan
  return "#f59e0b" // amber
}

export function UpgradeGame({ inventory, targets }: { inventory: Item[]; targets: Item[] }) {
  const router = useRouter()
  const { refresh } = useUser()
  const [source, setSource] = useState<Item | null>(inventory[0] ?? null)
  const [target, setTarget] = useState<Item | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [angle, setAngle] = useState(0)
  const [outcome, setOutcome] = useState<null | { success: boolean }>(null)

  const chance = useMemo(() => {
    if (!source || !target) return 0
    return upgradeChance(source.value, target.value)
  }, [source, target])

  const eligibleTargets = useMemo(
    () => targets.filter((t) => !source || t.value > source.value),
    [targets, source],
  )

  const multiplier = source && target ? target.value / source.value : 0
  const color = arcColor(chance)
  const winArcLen = chance * RING_C

  async function handleUpgrade() {
    if (!source || !target || spinning || chance <= 0) return
    setSpinning(true)
    setOutcome(null)
    haptic("medium")

    try {
      const res = await upgradeGift(source.id, target.id)
      // Land the pointer inside the win arc on success, outside on failure.
      const winDeg = res.chance * 360
      const landing = res.success
        ? Math.random() * Math.max(4, winDeg - 4) + 2
        : winDeg + Math.random() * (360 - winDeg - 4) + 2
      const finalAngle = 360 * 5 + landing
      setAngle(finalAngle)

      setTimeout(() => {
        setSpinning(false)
        setOutcome({ success: res.success })
        hapticNotify(res.success ? "success" : "error")
        if (res.success) {
          setSource({ ...res.target, id: source.id })
        } else {
          setSource(null)
        }
        setTarget(null)
        refresh()
        router.refresh()
      }, 3800)
    } catch {
      setSpinning(false)
    }
  }

  if (inventory.length === 0 && !source) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <Package className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You have no gifts to upgrade. Open a case first to get started.
        </p>
        <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
          Open cases
        </Link>
      </div>
    )
  }

  const centerItem = target ?? source

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="grad-border overflow-hidden rounded-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-card p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-300" />
            <h1 className="font-display text-xl font-black">Upgrade</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Risk a gift for a bigger one. The larger the jump, the lower your odds.
          </p>
        </div>
      </div>

      {/* Ring gauge */}
      <div className="relative mx-auto aspect-square w-full max-w-[300px]">
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-6 rounded-full blur-2xl transition-colors duration-500"
          style={{ backgroundColor: `${color}22` }}
        />

        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {/* track */}
          <circle cx="100" cy="100" r={RING_R} fill="none" stroke="oklch(0.24 0.03 264)" strokeWidth="12" />
          {/* win arc (starts at top, clockwise) */}
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${winArcLen} ${RING_C}`}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${color})` }}
          />
          {/* orbiting pointer */}
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: "100px 100px",
              transition: spinning ? "transform 3.8s cubic-bezier(0.12, 0.7, 0.1, 1)" : "none",
            }}
          >
            <circle cx="100" cy="14" r="7" fill="#fff" stroke={color} strokeWidth="3" />
          </g>
        </svg>

        {/* center content */}
        <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-background/80 ring-1 ring-border">
          {outcome ? (
            <div
              className={cn(
                "flex flex-col items-center gap-1 font-display font-black",
                outcome.success ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {outcome.success ? <Sparkles className="h-7 w-7" /> : null}
              <div className="text-2xl">{outcome.success ? "SUCCESS" : "BUST"}</div>
            </div>
          ) : centerItem ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={centerItem.imageUrl || "/images/nft-gift.png"}
                alt={centerItem.name}
                className={cn("h-16 w-16 object-contain transition-transform", spinning && "animate-pulse")}
              />
              <div className="mt-1 font-display text-3xl font-black" style={{ color }}>
                {(chance * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">win chance</div>
            </>
          ) : (
            <div className="px-6 text-center text-xs text-muted-foreground">Pick a gift and a target</div>
          )}
        </div>
      </div>

      {/* Source + Target */}
      <div className="flex items-center gap-2">
        <SlotCard label="Your gift" item={source} placeholder="Pick from inventory" />
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          {multiplier > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color }}>
              {multiplier.toFixed(1)}×
            </span>
          )}
        </div>
        <SlotCard label="Upgrade to" item={target} placeholder="Pick a target" />
      </div>

      <button
        onClick={handleUpgrade}
        disabled={!source || !target || spinning || chance <= 0}
        className={cn(
          "w-full rounded-2xl py-4 font-display text-base font-black transition-transform active:scale-[0.98]",
          !source || !target || spinning || chance <= 0
            ? "bg-secondary text-muted-foreground"
            : "btn-glow",
        )}
      >
        {spinning ? "Upgrading…" : "Upgrade"}
      </button>

      {/* Inventory picker */}
      <Picker
        title="Your inventory"
        items={inventory}
        activeId={source?.id}
        onPick={(it) => {
          haptic("light")
          setSource(it)
          setTarget(null)
          setOutcome(null)
        }}
        empty="No gifts yet"
      />

      {/* Target picker */}
      <Picker
        title="Choose target"
        items={eligibleTargets}
        activeId={target?.id}
        onPick={(it) => {
          haptic("light")
          setTarget(it)
          setOutcome(null)
        }}
        empty="Pick a gift first"
      />
    </div>
  )
}

function SlotCard({ label, item, placeholder }: { label: string; item: Item | null; placeholder: string }) {
  const r = item ? rarityOf(item.rarity) : null
  return (
    <div className={cn("flex-1 rounded-2xl border border-border bg-card p-3 text-center ring-1", r?.ring)}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {item ? (
        <>
          <div className="relative mx-auto my-2 h-16 w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="h-full w-full object-contain" />
          </div>
          <div className={cn("truncate text-xs font-semibold", r?.text)}>{item.name}</div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Coin className="h-3 w-3" />
            <span className="font-mono">{fmt(item.value)}</span>
          </div>
        </>
      ) : (
        <div className="flex h-[92px] items-center justify-center px-2 text-[11px] text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  )
}

function Picker({
  title,
  items,
  activeId,
  onPick,
  empty,
}: {
  title: string
  items: Item[]
  activeId?: number
  onPick: (i: Item) => void
  empty: string
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {items.map((it) => {
            const r = rarityOf(it.rarity)
            return (
              <button
                key={it.id}
                onClick={() => onPick(it)}
                className={cn(
                  "flex w-20 shrink-0 flex-col items-center rounded-xl border bg-card p-2 ring-1 transition-transform active:scale-95",
                  activeId === it.id ? "border-primary ring-primary/60" : `border-border ${r.ring}`,
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl || "/images/nft-gift.png"} alt={it.name} className="h-11 w-11 object-contain" />
                <span className={cn("mt-1 w-full truncate text-center text-[10px] font-semibold", r.text)}>
                  {it.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{fmt(it.value)}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
