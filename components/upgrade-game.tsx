"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Package, Sparkles } from "lucide-react"
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
      <section className="relative overflow-hidden rounded-[34px] bg-[#232731] p-4 ring-1 ring-white/[.08] md:p-6">
        <div className="mb-3 flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#7698ff]">PugGift lab</div><h1 className="font-display text-2xl font-black">Upgrade orbit</h1></div><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#071126] ring-1 ring-[#4d7bff]/50"><img src="/images/puggift-mascot-web-v1.webp" alt="" className="h-full w-full object-cover" /></span></div>

        <div className="mx-auto w-full max-w-[360px]"><FlightMeter angle={angle} spinning={spinning} chance={chance} outcome={outcome} /></div>

        <div className="relative z-10 -mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <GiftCard title="Your gift" item={source} />
          <ArrowRight className="h-5 w-5 text-white/30" />
          <GiftCard title="Target" item={target} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[.06] px-3 py-2.5"><div className="text-[9px] font-black uppercase tracking-widest text-white/35">Success chance</div><div className="font-display text-xl font-black text-emerald-300">{(chance * 100).toFixed(0)}%</div></div>
          <div className="rounded-2xl bg-white/[.06] px-3 py-2.5 text-right"><div className="text-[9px] font-black uppercase tracking-widest text-white/35">Multiplier</div><div className="font-display text-xl font-black">{multiplier ? `${multiplier.toFixed(2)}×` : "—"}</div></div>
        </div>
      </section>

      <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("w-full rounded-3xl py-4 font-display text-base font-black transition-transform active:scale-[0.98] disabled:bg-secondary disabled:text-muted-foreground", source && target && !spinning ? "btn-glow" : "bg-secondary text-muted-foreground")}>
        {spinning ? "Flying…" : "Start upgrade"}
      </button>

      <Picker title="Your gifts" items={inventory} activeId={source?.id} empty="No gifts available" onPick={(item) => { if (spinning) return; haptic("light"); setSource(item); setTarget(null); setOutcome(null); setAngle(180) }} />
      <Picker title="Choose a target" items={eligibleTargets} activeId={target?.id} empty="Choose a stake first" onPick={(item) => { if (spinning) return; haptic("light"); setTarget(item); setOutcome(null); setAngle(180) }} />
    </div>
  )
}

function FlightMeter({ angle, spinning, chance, outcome }: { angle: number; spinning: boolean; chance: number; outcome: boolean | null }) {
  const circumference = 2 * Math.PI * 44
  return <div className="relative aspect-square rounded-full bg-[#071126] p-3 shadow-[inset_0_0_55px_rgba(47,112,255,.18),0_22px_55px_rgba(0,0,0,.35)] ring-1 ring-white/[.08]">
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" /><circle cx="50" cy="50" r="44" fill="none" stroke="url(#upgrade-win)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${Math.max(2, chance * circumference)} ${circumference}`} /><defs><linearGradient id="upgrade-win"><stop stopColor="#55e6b3" /><stop offset="1" stopColor="#2f70ff" /></linearGradient></defs></svg>
    <div className="absolute inset-[21%] rounded-full bg-[#161c2b] ring-1 ring-white/[.08]" />
    <span className="absolute left-1/2 top-0 z-20 h-5 w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_white]" />
    <div className="absolute inset-0 z-10" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 3s cubic-bezier(.08,.72,.08,1)" : "none", willChange: "transform" }}><div className={cn("absolute left-1/2 top-[2%] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-[#11182a] shadow-[0_0_22px] md:h-12 md:w-12", outcome === false ? "border-rose-400 text-rose-300" : outcome === true ? "border-emerald-300 text-emerald-200" : "border-[#77a2ff] text-white")}><Sparkles className="h-5 w-5" /></div></div>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[9px] font-black uppercase tracking-[.18em] text-white/35">Win zone</span><span className={cn("mt-1 font-display text-4xl font-black", outcome === true ? "text-emerald-300" : outcome === false ? "text-rose-300" : "text-white")}>{(chance * 100).toFixed(0)}%</span><span className="mt-1 text-[10px] font-bold text-white/35">{spinning ? "SPINNING" : outcome === true ? "UPGRADED" : outcome === false ? "MISSED" : "STARTS FROM BOTTOM"}</span></div>
  </div>
}

function GiftCard({ title, item }: { title: string; item: Item | null }) {
  const rarity = item ? rarityOf(item.rarity) : null
  return <div className={cn("min-w-0 rounded-[22px] bg-[#1a1f2a] p-2.5 text-center ring-1 ring-white/[.08]", rarity?.ring)}><div className="text-[8px] font-black uppercase tracking-[.14em] text-white/35">{title}</div>{item ? <><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="mx-auto my-1 h-14 w-14 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.55)] md:h-16 md:w-16" /><div className={cn("truncate text-[11px] font-bold", rarity?.text)}>{item.name}</div><div className="mt-1 flex justify-center gap-1 text-[10px] text-white/45"><Coin className="h-3 w-3" />{fmt(item.value)}</div></> : <div className="flex h-[91px] items-center justify-center text-[10px] text-white/30">Choose gift</div>}</div>
}

function Picker({ title, items, activeId, empty, onPick }: { title: string; items: Item[]; activeId?: number; empty: string; onPick: (item: Item) => void }) {
  return <section className="rounded-[26px] bg-[#262a32] p-3 ring-1 ring-white/[.07]"><h2 className="mb-2 text-sm font-black">{title}</h2>{items.length === 0 ? <p className="py-3 text-xs text-muted-foreground">{empty}</p> : <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{items.map((item) => { const rarity = rarityOf(item.rarity); return <button key={item.id} onClick={() => onPick(item)} className={cn("flex w-[88px] shrink-0 flex-col items-center rounded-2xl bg-[#1d2027] p-2 ring-1 transition active:scale-95", activeId === item.id ? "ring-2 ring-[#6791ff]" : rarity.ring)}><img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="h-12 w-12 object-contain" /><span className={cn("mt-1 w-full truncate text-[10px] font-semibold", rarity.text)}>{item.name}</span><span className="font-mono text-[10px] text-muted-foreground">{fmt(item.value)}</span></button> })}</div>}</section>
}

function EmptyUpgrade() { return <div className="flex flex-col items-center gap-3 rounded-[30px] bg-card p-8 text-center ring-1 ring-white/10"><Package className="h-10 w-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">You have no gifts to upgrade. Open a case first to get started.</p><Link href="/cases" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Open cases</Link></div> }
