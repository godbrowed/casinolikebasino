"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, Package, Sparkles, Target, Zap } from "lucide-react"
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
  const [error, setError] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<"source" | "target">(inventory.length ? "target" : "source")

  const chance = useMemo(() => (!source || !target ? 0 : upgradeChance(source.value, target.value)), [source, target])
  const eligibleTargets = useMemo(() => targets.filter((item) => !source || item.value > source.value), [targets, source])
  const multiplier = source && target ? target.value / source.value : 0

  function resetFlight() {
    setOutcome(null)
    setError(null)
    setAngle(180)
  }

  async function handleUpgrade() {
    if (!source || !target || spinning || chance <= 0) return
    setSpinning(true)
    setOutcome(null)
    setError(null)
    setAngle(180)
    haptic("medium")
    playGameSound("bet")
    try {
      const result = await upgradeGift(source.id, target.id)
      const winDegrees = chance * 360
      const landing = result.success
        ? Math.max(2, Math.random() * Math.max(3, winDegrees - 4))
        : winDegrees + Math.random() * Math.max(5, 356 - winDegrees)

      // The pug always resets to the bottom before a fresh GPU-only rotation.
      window.setTimeout(() => setAngle(1440 + landing), 70)
      window.setTimeout(() => {
        setSpinning(false)
        setOutcome(result.success)
        hapticNotify(result.success ? "success" : "error")
        playGameSound(result.success ? "cashout" : "crash")
        if (result.success) {
          setSource({ ...result.target, id: source.id })
          setPickerMode("target")
        } else {
          setSource(null)
          setPickerMode("source")
        }
        setTarget(null)
        refresh()
        router.refresh()
      }, 3150)
    } catch (upgradeError) {
      setSpinning(false)
      setError(upgradeError instanceof Error ? upgradeError.message : "Upgrade could not be completed")
    }
  }

  if (inventory.length === 0 && !source) return <EmptyUpgrade />

  return (
    <div className="relative min-h-[calc(var(--tg-viewport-stable-height,100dvh)-76px)] overflow-hidden bg-[radial-gradient(circle_at_50%_25%,#2a68d6_0%,#1a4a9d_35%,#102f68_70%,#0b2048_100%)] pb-[calc(6.5rem+var(--tg-content-safe-area-inset-bottom,0px))] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.42)_1px,transparent_1px)] [background-size:62px_62px]" />
      <div className="pointer-events-none absolute left-1/2 top-28 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-[#6b8fff]/15 blur-[100px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-3 md:px-5">
        <Link href="/" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#091b3d]/55 text-white/80 ring-1 ring-white/10 backdrop-blur-md">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[.2em] text-blue-200/65">PugGift laboratory</div>
          <h1 className="font-display text-xl font-black md:text-2xl">Gift upgrade</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/65 ring-1 ring-white/10 backdrop-blur-md">
          <i className={cn("h-2 w-2 rounded-full", spinning ? "animate-pulse bg-amber-300 shadow-[0_0_10px_#fcd34d]" : "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]")} />
          {spinning ? "In flight" : "Ready"}
        </div>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col px-3 md:px-5">
        <section className="grid grid-cols-2 items-center gap-2 md:grid-cols-[minmax(150px,210px)_minmax(360px,500px)_minmax(150px,210px)] md:gap-5">
          <div className="order-2 md:order-1"><GiftHero title="Your gift" hint="Stake" item={source} /></div>
          <div className="order-1 col-span-2 mx-auto w-full max-w-[500px] md:order-2 md:col-span-1">
            <UpgradeWheel angle={angle} spinning={spinning} chance={chance} multiplier={multiplier} outcome={outcome} />
          </div>
          <div className="order-3"><GiftHero title="Target gift" hint="Prize" item={target} /></div>
        </section>

        <div className="mx-auto mt-3 flex w-full max-w-[760px] flex-col gap-2.5 md:mt-5">
          {error && <p className="rounded-[18px] bg-rose-500/18 px-3 py-2.5 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-200/20">{error}</p>}

          <section className="overflow-hidden rounded-[28px] bg-[#0d2858]/72 p-2.5 ring-1 ring-white/10 backdrop-blur-xl md:p-3">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-[18px] bg-[#081b3e]/70 p-1 ring-1 ring-white/8">
              <button onClick={() => setPickerMode("source")} disabled={spinning} className={cn("rounded-[14px] px-3 py-2 text-[10px] font-black transition", pickerMode === "source" ? "bg-white text-[#174699] shadow-sm" : "text-white/45")}>Your gift · {inventory.length}</button>
              <button onClick={() => source && setPickerMode("target")} disabled={!source || spinning} className={cn("rounded-[14px] px-3 py-2 text-[10px] font-black transition", pickerMode === "target" ? "bg-white text-[#174699] shadow-sm" : "text-white/45", !source && "opacity-35")}>Target · {eligibleTargets.length}</button>
            </div>
            {pickerMode === "source" ? <Picker title="Your collection" subtitle="Choose the gift you risk" items={inventory} activeId={source?.id} empty="No gifts available" onPick={(item) => {
              if (spinning) return
              haptic("light")
              setSource(item)
              setTarget(null)
              setPickerMode("target")
              resetFlight()
            }} /> : <Picker title="Upgrade target" subtitle={source ? "Only more valuable gifts" : "Choose your gift first"} items={eligibleTargets} activeId={target?.id} empty="No target available" onPick={(item) => {
              if (spinning) return
              haptic("light")
              setTarget(item)
              resetFlight()
            }} />}
          </section>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[22px] bg-white/10 px-4 py-2.5 text-center ring-1 ring-white/10 backdrop-blur-md">
            <div><div className="text-[8px] font-black uppercase tracking-[.16em] text-white/40">Chance</div><div className="font-display text-lg font-black text-emerald-200">{target ? `${Math.round(chance * 100)}%` : "—"}</div></div>
            <ChevronRight className="h-4 w-4 text-white/25" />
            <div><div className="text-[8px] font-black uppercase tracking-[.16em] text-white/40">Multiplier</div><div className="font-display text-lg font-black">{multiplier ? `${multiplier.toFixed(2)}×` : "—"}</div></div>
          </div>

          <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("flex w-full items-center justify-center gap-2 rounded-[20px] py-4 font-display text-base font-black transition-transform active:scale-[0.98]", source && target && !spinning ? "bg-[#2f70ff] text-white shadow-[0_13px_34px_-8px_rgba(9,24,72,.75),inset_0_1px_0_rgba(255,255,255,.3)]" : "bg-white/12 text-white/35", spinning && "opacity-75")}>
            <Zap className="h-5 w-5" fill="currentColor" />
            {spinning ? "Pug is flying…" : target ? `Upgrade to ${target.name}` : "Choose an upgrade target"}
          </button>
        </div>
      </main>
    </div>
  )
}

function UpgradeWheel({ angle, spinning, chance, multiplier, outcome }: { angle: number; spinning: boolean; chance: number; multiplier: number; outcome: boolean | null }) {
  const circumference = 2 * Math.PI * 44
  const winLength = chance > 0 ? Math.max(4, chance * circumference) : 0

  return <div className="relative mx-auto aspect-square w-[min(78vw,370px)] md:w-[min(32vw,410px)]">
    <div className="absolute inset-[4%] rounded-full bg-[#081a3b]/70 shadow-[0_30px_70px_rgba(2,10,35,.45),inset_0_0_70px_rgba(55,105,226,.24)] ring-1 ring-white/10" />
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_15px_28px_rgba(4,11,36,.4)]">
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(8,27,65,.8)" strokeWidth="10" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(126,158,229,.24)" strokeWidth="8" />
      {winLength > 0 && <circle cx="50" cy="50" r="44" fill="none" stroke="url(#upgrade-zone)" strokeWidth="8" strokeLinecap="butt" strokeDasharray={`${winLength} ${circumference}`} />}
      <defs><linearGradient id="upgrade-zone"><stop stopColor="#6cf0c1" /><stop offset=".52" stopColor="#27d8ad" /><stop offset="1" stopColor="#2f70ff" /></linearGradient></defs>
    </svg>

    <div className="pointer-events-none absolute left-1/2 top-[1%] z-30 -translate-x-1/2">
      <i className="block h-0 w-0 border-x-[14px] border-t-[20px] border-x-transparent border-t-white drop-shadow-[0_5px_8px_rgba(0,0,0,.35)]" />
    </div>

    <div className="absolute inset-0 z-20" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 3s cubic-bezier(.08,.72,.08,1)" : "none", willChange: "transform" }}>
      <div className={cn("absolute left-1/2 top-[0.5%] flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] bg-[#081a3b] shadow-[0_0_0_4px_rgba(14,36,83,.65),0_0_28px_rgba(102,145,255,.75)] md:h-14 md:w-14", outcome === false ? "border-rose-400" : outcome === true ? "border-emerald-300" : "border-[#8db0ff]")}>
        <img src="/images/puggift-bot-avatar-web-v2.webp" alt="Pug marker" className="h-full w-full object-cover" />
      </div>
    </div>

    <div className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_45%_35%,#173d82,#091a3b_72%)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_15px_35px_rgba(3,11,35,.4)] ring-1 ring-white/10">
      <Sparkles className={cn("mb-1 h-5 w-5", outcome === true ? "text-emerald-300" : outcome === false ? "text-rose-300" : "text-blue-200")} />
      <span className="text-[8px] font-black uppercase tracking-[.2em] text-white/40">Success zone</span>
      <span className={cn("mt-0.5 font-display text-4xl font-black md:text-5xl", outcome === true ? "text-emerald-300" : outcome === false ? "text-rose-300" : "text-white")}>{chance ? `${Math.round(chance * 100)}%` : "—"}</span>
      <span className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/40">{spinning ? "Flying" : outcome === true ? "Upgraded" : outcome === false ? "Missed" : multiplier ? `${multiplier.toFixed(2)}× target` : "Choose target"}</span>
    </div>

    <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 rounded-full bg-[#102d62]/90 px-3 py-1 text-[8px] font-black uppercase tracking-[.14em] text-blue-100/55 ring-1 ring-white/10">Starts here</div>
  </div>
}

function GiftHero({ title, hint, item }: { title: string; hint: string; item: Item | null }) {
  const rarity = item ? rarityOf(item.rarity) : null
  return <div className={cn("relative min-w-0 overflow-hidden rounded-[24px] bg-[#0d2858]/68 p-2.5 text-center ring-1 ring-white/10 backdrop-blur-xl md:p-4", item && rarity?.ring)}>
    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/8 to-transparent" />
    <div className="relative flex items-center justify-between text-left md:block md:text-center"><div><div className="text-[8px] font-black uppercase tracking-[.18em] text-blue-100/45">{hint}</div><div className="text-[11px] font-black text-white/80 md:text-sm">{title}</div></div>{item && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-black text-white/55"><Coin className="h-3 w-3" />{fmt(item.value)}</span>}</div>
    {item ? <>
      <img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="relative mx-auto my-1 h-14 w-14 object-contain drop-shadow-[0_12px_14px_rgba(3,10,34,.48)] md:my-3 md:h-24 md:w-24" />
      <div className={cn("relative truncate text-[10px] font-black md:text-xs", rarity?.text)}>{item.name}</div>
    </> : <div className="relative flex h-[72px] flex-col items-center justify-center text-white/28 md:h-[142px]"><Target className="mb-1 h-6 w-6" /><span className="text-[9px] font-bold">Choose below</span></div>}
  </div>
}

function Picker({ title, subtitle, items, activeId, empty, onPick }: { title: string; subtitle: string; items: Item[]; activeId?: number; empty: string; onPick: (item: Item) => void }) {
  return <div className="min-w-0">
    <div className="mb-2 flex items-end justify-between gap-3 px-1"><div><h2 className="text-xs font-black">{title}</h2><p className="text-[9px] font-bold text-blue-100/40">{subtitle}</p></div><span className="text-[9px] font-black text-white/30">{items.length} GIFTS</span></div>
    {items.length === 0 ? <p className="rounded-[18px] bg-white/6 py-4 text-center text-[10px] font-bold text-white/35">{empty}</p> : <div className="no-scrollbar flex gap-2 overflow-x-auto px-0.5 pb-1 pt-0.5">{items.map((item) => {
      const rarity = rarityOf(item.rarity)
      return <button key={item.id} onClick={() => onPick(item)} className={cn("relative flex w-[78px] shrink-0 flex-col items-center rounded-[19px] bg-white/[.055] p-2 ring-1 transition active:scale-95 md:w-[88px]", activeId === item.id ? "bg-[#2f70ff]/28 ring-2 ring-[#8eb0ff] shadow-[0_8px_22px_rgba(17,49,125,.45)]" : rarity.ring)}>
        {activeId === item.id && <i className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />}
        <img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="h-12 w-12 object-contain drop-shadow-[0_7px_8px_rgba(3,11,35,.45)]" />
        <span className={cn("mt-1 w-full truncate text-[9px] font-black", rarity.text)}>{item.name}</span>
        <span className="mt-1 flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 font-mono text-[9px] font-bold text-white/55"><Coin className="h-2.5 w-2.5" />{fmt(item.value)}</span>
      </button>
    })}</div>}
  </div>
}

function EmptyUpgrade() {
  return <div className="relative flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-76px)] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#285fca,#153b7d_55%,#0b2048)] px-4 pb-24 text-white">
    <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.42)_1px,transparent_1px)] [background-size:62px_62px]" />
    <div className="relative flex w-full max-w-[440px] flex-col items-center rounded-[32px] bg-[#0d2858]/72 p-8 text-center ring-1 ring-white/10 backdrop-blur-xl">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2f70ff]/20 ring-1 ring-[#80a6ff]/35"><Package className="h-9 w-9 text-blue-200" /></span>
      <h1 className="mt-5 font-display text-2xl font-black">Your upgrade lab is empty</h1>
      <p className="mt-2 max-w-xs text-sm text-blue-100/50">Open a case, keep a gift and return here to turn it into something bigger.</p>
      <Link href="/cases" className="mt-6 flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f70ff] py-4 font-display text-base font-black shadow-[0_13px_34px_-8px_rgba(9,24,72,.75)]">Open cases <ChevronRight className="h-5 w-5" /></Link>
    </div>
  </div>
}
