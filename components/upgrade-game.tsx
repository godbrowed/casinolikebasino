"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Sparkles, Target } from "lucide-react"
import { upgradeGift } from "@/app/actions/upgrade"
import { upgradeChance } from "@/lib/upgrade-shared"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { playGameSound } from "@/lib/game-sound"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number }

export function UpgradeGame({ inventory, targets }: { inventory: Item[]; targets: Item[] }) {
  const router = useRouter()
  const { refresh } = useUser()
  const [source, setSource] = useState<Item | null>(inventory[0] ?? null)
  const [target, setTarget] = useState<Item | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [angle, setAngle] = useState(180)
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
    setAngle(180)
    haptic("medium")
    playGameSound("bet")
    try {
      const result = await upgradeGift(source.id, target.id)
      const winDegrees = chance * 360
      const landing = result.success
        ? Math.max(2, Math.random() * Math.max(3, winDegrees - 4))
        : winDegrees + Math.random() * Math.max(5, 356 - winDegrees)
      // Allow the reset-to-bottom frame to paint before every run. This avoids
      // the short/failed second spin caused by transitioning from a prior end.
      window.setTimeout(() => setAngle(1440 + landing), 70)
      window.setTimeout(() => {
        setSpinning(false)
        setOutcome(result.success)
        hapticNotify(result.success ? "success" : "error")
        playGameSound(result.success ? "cashout" : "crash")
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
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[30px] border border-[#5d86ff]/30 bg-[linear-gradient(135deg,#122d78,#201249)] p-5 shadow-[0_10px_0_-6px_rgba(0,0,0,.55)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#0c2c83]"><img src="/images/puggift-mascot-web-v1.webp" alt="" className="h-full w-full object-cover" /></span><div><h1 className="font-display text-xl font-black">Pug upgrade</h1><p className="mt-0.5 text-xs text-white/65">Put in a gift. Spin the orbit. Take the upgrade.</p></div></div>
      </div>

      <div className="relative grid grid-cols-[1fr_142px_1fr] items-center gap-2 rounded-[30px] border border-white/10 bg-[#272a32] p-3">
        <GiftCard title="Stake" item={source} />
        <FlightMeter angle={angle} spinning={spinning} chance={chance} outcome={outcome} />
        <GiftCard title="Target" item={target} />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/80 px-4 py-3">
        <div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chance</div><div className="font-display text-2xl font-black text-cyan-300">{(chance * 100).toFixed(0)}%</div></div>
        <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upgrade</div><div className="font-display text-lg font-black">{multiplier ? `${multiplier.toFixed(2)}×` : "—"}</div></div>
      </div>

      <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("w-full rounded-3xl py-4 font-display text-base font-black transition-transform active:scale-[0.98] disabled:bg-secondary disabled:text-muted-foreground", source && target && !spinning ? "btn-glow" : "bg-secondary text-muted-foreground")}>
        {spinning ? "Flying…" : "Start upgrade"}
      </button>

      <Picker title="Your gifts" items={inventory} activeId={source?.id} empty="No gifts available" onPick={(item) => { if (spinning) return; haptic("light"); setSource(item); setTarget(null); setOutcome(null); setAngle(180) }} />
      <Picker title="Choose a target" items={eligibleTargets} activeId={target?.id} empty="Choose a stake first" onPick={(item) => { if (spinning) return; haptic("light"); setTarget(item); setOutcome(null); setAngle(180) }} />
    </div>
  )
}

function FlightMeter({ angle, spinning, chance, outcome }: { angle: number; spinning: boolean; chance: number; outcome: boolean | null }) {
  const circumference = 2 * Math.PI * 42
  return <div className="relative aspect-square overflow-hidden rounded-full border border-cyan-300/35 bg-[#071126] shadow-[inset_0_0_34px_rgba(69,114,255,.25),0_0_28px_rgba(69,114,255,.13)]">
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="8" /><circle cx="50" cy="50" r="42" fill="none" stroke="#34d399" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${Math.max(3, chance * circumference)} ${circumference}`} /></svg>
    <div className="absolute inset-[24%] rounded-full border border-white/10 bg-[#151924]" />
    <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 3s cubic-bezier(.11,.72,.06,1)" : "none" }}><div className={cn("absolute left-1/2 top-[4px] flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-background shadow-[0_0_18px]", outcome === false ? "border-rose-400 text-rose-300" : outcome === true ? "border-emerald-300 text-emerald-200" : "border-cyan-300 text-cyan-100")}><Sparkles className="h-4 w-4" /></div></div>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><Target className="h-4 w-4 text-emerald-300" /><span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Win zone</span><span className="mt-0.5 text-[9px] font-bold text-cyan-200">{(chance * 100).toFixed(0)}%</span></div>
  </div>
}

function GiftCard({ title, item }: { title: string; item: Item | null }) {
  const rarity = item ? rarityOf(item.rarity) : null
  return <div className={cn("min-w-0 rounded-2xl border border-white/10 bg-[#1e222b] p-2 text-center ring-1", rarity?.ring)}><div className="text-[9px] font-black uppercase tracking-[.12em] text-muted-foreground">{title}</div>{item ? <><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="mx-auto my-2 h-16 w-16 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.55)]" /><div className={cn("truncate text-xs font-bold", rarity?.text)}>{item.name}</div><div className="mt-1 flex justify-center gap-1 text-[10px] text-muted-foreground"><Coin className="h-3 w-3" />{fmt(item.value)}</div></> : <div className="flex h-[104px] items-center justify-center text-[11px] text-muted-foreground">Choose gift</div>}</div>
}

function Picker({ title, items, activeId, empty, onPick }: { title: string; items: Item[]; activeId?: number; empty: string; onPick: (item: Item) => void }) {
  return <section><h2 className="mb-2 text-sm font-bold">{title}</h2>{items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{items.map((item) => { const rarity = rarityOf(item.rarity); return <button key={item.id} onClick={() => onPick(item)} className={cn("flex w-20 shrink-0 flex-col items-center rounded-xl border bg-card p-2 ring-1 active:scale-95", activeId === item.id ? "border-cyan-300 ring-cyan-300/60" : `border-border ${rarity.ring}`)}><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="h-11 w-11 object-contain" /><span className={cn("mt-1 w-full truncate text-[10px] font-semibold", rarity.text)}>{item.name}</span><span className="font-mono text-[10px] text-muted-foreground">{fmt(item.value)}</span></button> })}</div>}</section>
}

function EmptyUpgrade() { return <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center"><Package className="h-10 w-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">You have no gifts to upgrade. Open a case first to get started.</p><Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Open cases</Link></div> }
