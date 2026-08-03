"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUp, Package, Sparkles, Target } from "lucide-react"
import { upgradeGift } from "@/app/actions/upgrade"
import { upgradeChance } from "@/lib/upgrade-shared"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number }

export function UpgradeGame({ inventory, targets }: { inventory: Item[]; targets: Item[] }) {
  const router = useRouter()
  const { refresh } = useUser()
  const [source, setSource] = useState<Item | null>(inventory[0] ?? null)
  const [target, setTarget] = useState<Item | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outcome, setOutcome] = useState<boolean | null>(null)

  const chance = useMemo(() => (!source || !target ? 0 : upgradeChance(source.value, target.value)), [source, target])
  const eligibleTargets = useMemo(() => targets.filter((item) => !source || item.value > source.value), [targets, source])
  const multiplier = source && target ? target.value / source.value : 0
  // The win zone is always at the top. A successful result lands in it, while
  // a loss stops below it; this makes the odds readable during the animation.
  const winFloor = 100 - chance * 100

  async function handleUpgrade() {
    if (!source || !target || spinning || chance <= 0) return
    setSpinning(true)
    setOutcome(null)
    setProgress(0)
    haptic("medium")
    try {
      const result = await upgradeGift(source.id, target.id)
      const landing = result.success
        ? winFloor + Math.max(2, Math.random() * Math.max(3, chance * 100 - 4))
        : Math.max(3, Math.random() * Math.max(4, winFloor - 3))
      // Allow the reset-to-bottom frame to paint before every run. This avoids
      // the short/failed second spin caused by transitioning from a prior end.
      window.setTimeout(() => setProgress(Math.min(98, landing)), 70)
      window.setTimeout(() => {
        setSpinning(false)
        setOutcome(result.success)
        hapticNotify(result.success ? "success" : "error")
        if (result.success) setSource({ ...result.target, id: source.id })
        else setSource(null)
        setTarget(null)
        refresh()
        router.refresh()
      }, 3150)
    } catch {
      setSpinning(false)
    }
  }

  if (inventory.length === 0 && !source) {
    return <EmptyUpgrade />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-card p-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="flex items-center gap-2"><ArrowUp className="h-5 w-5 text-cyan-300" /><h1 className="font-display text-xl font-black">Upgrade flight</h1></div>
        <p className="mt-1 text-xs text-muted-foreground">Launch your gift from the bottom and land in the reward zone.</p>
      </div>

      <div className="grid grid-cols-[1fr_128px_1fr] items-center gap-2">
        <GiftCard title="Stake" item={source} />
        <FlightMeter progress={progress} spinning={spinning} chance={chance} outcome={outcome} />
        <GiftCard title="Target" item={target} />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/80 px-4 py-3">
        <div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chance</div><div className="font-display text-2xl font-black text-cyan-300">{(chance * 100).toFixed(0)}%</div></div>
        <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upgrade</div><div className="font-display text-lg font-black">{multiplier ? `${multiplier.toFixed(2)}×` : "—"}</div></div>
      </div>

      <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("w-full rounded-2xl py-4 font-display text-base font-black transition-transform active:scale-[0.98] disabled:bg-secondary disabled:text-muted-foreground", source && target && !spinning ? "btn-glow" : "bg-secondary text-muted-foreground")}>
        {spinning ? "Flying…" : "Start upgrade"}
      </button>

      <Picker title="Your gifts" items={inventory} activeId={source?.id} empty="No gifts available" onPick={(item) => { if (spinning) return; haptic("light"); setSource(item); setTarget(null); setOutcome(null); setProgress(0) }} />
      <Picker title="Choose a target" items={eligibleTargets} activeId={target?.id} empty="Choose a stake first" onPick={(item) => { if (spinning) return; haptic("light"); setTarget(item); setOutcome(null); setProgress(0) }} />
    </div>
  )
}

function FlightMeter({ progress, spinning, chance, outcome }: { progress: number; spinning: boolean; chance: number; outcome: boolean | null }) {
  const zone = Math.max(3, chance * 100)
  return <div className="relative h-64 overflow-hidden rounded-3xl border border-cyan-300/30 bg-[#07121e] p-2 shadow-[inset_0_0_32px_rgba(34,211,238,.12)]">
    <div className="absolute inset-x-2 top-2 rounded-t-2xl border border-emerald-400/40 bg-emerald-400/15" style={{ height: `${zone}%` }} />
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 text-center text-[9px] font-black uppercase tracking-wider text-emerald-300"><Target className="mx-auto h-3 w-3" /> win</div>
    <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:100%_20%]" />
    <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2" style={{ transform: `translate(-50%, -${progress * 2.15}px)`, transition: spinning ? "transform 3s cubic-bezier(.12,.72,.08,1)" : "none" }}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background shadow-[0_0_18px]", outcome === false ? "border-rose-400 text-rose-300 shadow-rose-400/60" : outcome === true ? "border-emerald-300 text-emerald-200 shadow-emerald-400/70" : "border-cyan-300 text-cyan-100 shadow-cyan-400/70")}><Sparkles className="h-4 w-4" /></div>
    </div>
    <div className="absolute bottom-2 left-2 right-2 text-center text-[9px] font-black uppercase tracking-widest text-cyan-200/70">Launch</div>
  </div>
}

function GiftCard({ title, item }: { title: string; item: Item | null }) {
  const rarity = item ? rarityOf(item.rarity) : null
  return <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-2 text-center ring-1", rarity?.ring)}><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</div>{item ? <><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="mx-auto my-2 h-16 w-16 object-contain" /><div className={cn("truncate text-xs font-bold", rarity?.text)}>{item.name}</div><div className="mt-1 flex justify-center gap-1 text-[10px] text-muted-foreground"><Coin className="h-3 w-3" />{fmt(item.value)}</div></> : <div className="flex h-[104px] items-center justify-center text-[11px] text-muted-foreground">Choose gift</div>}</div>
}

function Picker({ title, items, activeId, empty, onPick }: { title: string; items: Item[]; activeId?: number; empty: string; onPick: (item: Item) => void }) {
  return <section><h2 className="mb-2 text-sm font-bold">{title}</h2>{items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{items.map((item) => { const rarity = rarityOf(item.rarity); return <button key={item.id} onClick={() => onPick(item)} className={cn("flex w-20 shrink-0 flex-col items-center rounded-xl border bg-card p-2 ring-1 active:scale-95", activeId === item.id ? "border-cyan-300 ring-cyan-300/60" : `border-border ${rarity.ring}`)}><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="h-11 w-11 object-contain" /><span className={cn("mt-1 w-full truncate text-[10px] font-semibold", rarity.text)}>{item.name}</span><span className="font-mono text-[10px] text-muted-foreground">{fmt(item.value)}</span></button> })}</div>}</section>
}

function EmptyUpgrade() { return <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center"><Package className="h-10 w-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">You have no gifts to upgrade. Open a case first to get started.</p><Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Open cases</Link></div> }
