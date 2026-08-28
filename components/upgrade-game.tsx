"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FlaskConical, Package, Sparkles, Target, Zap } from "lucide-react"
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
  const [sources, setSources] = useState<Item[]>(inventory[0] ? [inventory[0]] : [])
  const [target, setTarget] = useState<Item | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [wheelAnimating, setWheelAnimating] = useState(false)
  const [angle, setAngle] = useState(180)
  const [outcome, setOutcome] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<"source" | "target">(inventory.length ? "target" : "source")
  const [displayInventory, setDisplayInventory] = useState(inventory)
  const [lockedChance, setLockedChance] = useState(0)
  const [lockedMultiplier, setLockedMultiplier] = useState(0)

  const source = useMemo<Item | null>(() => sources.length ? { ...sources[0], name: sources.length > 1 ? `${sources.length} gifts` : sources[0].name, value: sources.reduce((sum, item) => sum + item.value, 0) } : null, [sources])
  const chance = useMemo(() => (!source || !target ? 0 : upgradeChance(source.value, target.value)), [source, target])
  const eligibleTargets = useMemo(() => targets.filter((item) => !source || item.value > source.value), [targets, source])
  const multiplier = source && target ? target.value / source.value : 0
  const shownChance = spinning || outcome !== null ? lockedChance : chance
  const shownMultiplier = spinning || outcome !== null ? lockedMultiplier : multiplier

  useEffect(() => {
    if (!spinning) setDisplayInventory(inventory)
  }, [inventory, spinning])

  function resetFlight() {
    setOutcome(null)
    setError(null)
    setWheelAnimating(false)
    setAngle(180)
  }

  async function handleUpgrade() {
    if (!source || !target || spinning || chance <= 0) return
    setWheelAnimating(false)
    setSpinning(true)
    setOutcome(null)
    setError(null)
    setAngle(180)
    setLockedChance(chance)
    setLockedMultiplier(multiplier)
    haptic("medium")
    playGameSound("bet")
    try {
      const result = await upgradeGift(sources.map((item) => item.id), target.id)
      const winDegrees = chance * 360
      const landing = result.success
        ? Math.max(2, Math.random() * Math.max(3, winDegrees - 4))
        : winDegrees + Math.random() * Math.max(5, 356 - winDegrees)

      // The pug always resets to the bottom before a fresh GPU-only rotation.
      window.setTimeout(() => {
        setWheelAnimating(true)
        setAngle(1440 + landing)
      }, 70)
      window.setTimeout(() => {
        setWheelAnimating(false)
        setSpinning(false)
        setOutcome(result.success)
        hapticNotify(result.success ? "success" : "error")
        playGameSound(result.success ? "cashout" : "crash")
        if (result.success) {
          setSources([{ ...result.target, id: sources[0].id }])
          setPickerMode("target")
        } else {
          setSources([])
          setPickerMode("source")
        }
        setTarget(null)
        refresh()
        router.refresh()
      }, 3150)
    } catch (upgradeError) {
      setWheelAnimating(false)
      setSpinning(false)
      setError(upgradeError instanceof Error ? upgradeError.message : "Upgrade could not be completed")
    }
  }

  if (inventory.length === 0 && !source) return <EmptyUpgrade />

  return (
    <div className="relative min-h-[calc(var(--tg-viewport-stable-height,100dvh)-58px)] overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,#273f91_0%,#111f4c_38%,#071127_78%)] pb-[calc(6.5rem+var(--tg-content-safe-area-inset-bottom,0px))] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[.15] [background-image:linear-gradient(rgba(151,178,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(151,178,255,.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-violet-400/15 blur-[110px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] items-center gap-3 px-3 py-3 md:px-5 md:py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-violet-300/10 text-violet-200 ring-1 ring-violet-200/15 backdrop-blur-md"><FlaskConical className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-black uppercase tracking-[.2em] text-violet-200/55">PugGift laboratory</div>
          <h1 className="font-display text-xl font-black tracking-tight md:text-2xl">Quantum Upgrade</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-black/15 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/55 ring-1 ring-white/[.08] backdrop-blur-md">
          <i className={cn("h-2 w-2 rounded-full", spinning ? "animate-pulse bg-amber-300 shadow-[0_0_10px_#fcd34d]" : "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]")} />
          {spinning ? "In flight" : "Ready"}
        </div>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col px-3 md:px-5">
        <section className="grid grid-cols-2 items-center gap-2 md:grid-cols-[210px_430px_210px] md:justify-center md:gap-7 lg:grid-cols-[220px_450px_220px] lg:gap-9">
          <div className="order-2 md:order-1"><GiftHero title="Your gift" hint="Stake" item={source} /></div>
          <div className="order-1 col-span-2 mx-auto w-full max-w-[500px] md:order-2 md:col-span-1 md:max-w-none">
            <UpgradeWheel angle={angle} spinning={spinning} animating={wheelAnimating} chance={shownChance} multiplier={shownMultiplier} outcome={outcome} />
          </div>
          <div className="order-3"><GiftHero title="Target gift" hint="Prize" item={target} /></div>
        </section>

        <div className="mx-auto mt-3 flex w-full max-w-[820px] flex-col gap-2.5 md:mt-4">
          {error && <p className="rounded-[18px] bg-rose-500/18 px-3 py-2.5 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-200/20">{error}</p>}

          <section className="overflow-hidden rounded-[28px] border border-white/[.08] bg-[#0a1839]/82 p-2.5 shadow-[0_20px_60px_rgba(1,5,22,.3),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl md:p-3">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-[18px] bg-black/20 p-1 ring-1 ring-white/[.06]">
              <button onClick={() => setPickerMode("source")} disabled={spinning} className={cn("rounded-[14px] px-3 py-2 text-[10px] font-black transition", pickerMode === "source" ? "bg-white text-[#174699] shadow-sm" : "text-white/45")}>Your gift · {spinning ? "•••" : displayInventory.length}</button>
              <button onClick={() => source && setPickerMode("target")} disabled={!source || spinning} className={cn("rounded-[14px] px-3 py-2 text-[10px] font-black transition", pickerMode === "target" ? "bg-white text-[#174699] shadow-sm" : "text-white/45", !source && "opacity-35")}>Target · {spinning ? "•••" : eligibleTargets.length}</button>
            </div>
            {pickerMode === "source" ? <Picker title="Your collection" subtitle={spinning ? "Inventory locked until the result" : "Choose one or several gifts"} items={displayInventory} activeIds={sources.map((item) => item.id)} empty="No gifts available" obscured={spinning} onPick={(item) => {
              if (spinning) return
              haptic("light")
              setSources((current) => current.some((entry) => entry.id === item.id) ? current.filter((entry) => entry.id !== item.id) : [...current, item])
              setTarget(null)
              resetFlight()
            }} /> : <Picker title="Upgrade target" subtitle={spinning ? "Result is being calculated" : source ? "Only more valuable gifts" : "Choose your gift first"} items={eligibleTargets} activeIds={target ? [target.id] : []} empty="No target available" obscured={spinning} onPick={(item) => {
              if (spinning) return
              haptic("light")
              setTarget(item)
              resetFlight()
            }} />}
          </section>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[22px] border border-white/[.07] bg-[#142858]/80 px-4 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-md">
            <div><div className="text-[8px] font-black uppercase tracking-[.16em] text-white/40">Chance</div><div className="font-display text-lg font-black text-emerald-200">{shownChance ? `${Math.round(shownChance * 100)}%` : "—"}</div></div>
            <ChevronRight className="h-4 w-4 text-white/25" />
            <div><div className="text-[8px] font-black uppercase tracking-[.16em] text-white/40">Multiplier</div><div className="font-display text-lg font-black">{shownMultiplier ? `${shownMultiplier.toFixed(2)}×` : "—"}</div></div>
          </div>

          <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("flex w-full items-center justify-center gap-2 rounded-[20px] py-4 font-display text-base font-black transition-transform active:scale-[0.98]", source && target && !spinning ? "bg-gradient-to-r from-[#4779ff] via-[#6d63ff] to-[#9b55f6] text-white shadow-[0_8px_0_#293b9c,0_18px_40px_rgba(83,76,255,.28),inset_0_1px_0_rgba(255,255,255,.35)]" : "bg-white/[.08] text-white/30", spinning && "opacity-75")}>
            <Zap className="h-5 w-5" fill="currentColor" />
            {spinning ? "Pug is flying…" : target ? `Upgrade to ${target.name}` : "Choose an upgrade target"}
          </button>
        </div>
      </main>
    </div>
  )
}

function UpgradeWheel({ angle, spinning, animating, chance, multiplier, outcome }: { angle: number; spinning: boolean; animating: boolean; chance: number; multiplier: number; outcome: boolean | null }) {
  const circumference = 2 * Math.PI * 44
  const winLength = chance > 0 ? Math.max(4, chance * circumference) : 0

  return <div className="relative mx-auto aspect-square w-[min(82vw,380px)] md:w-[410px] lg:w-[430px]">
    <div className={cn("absolute inset-[1%] rounded-full border border-dashed border-violet-200/15 transition-transform duration-[3000ms]", spinning && "rotate-180")} />
    <div className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle_at_46%_38%,#193878,#071633_72%)] shadow-[0_32px_80px_rgba(1,5,22,.52),inset_0_0_80px_rgba(96,87,255,.18),0_0_55px_rgba(90,91,255,.12)] ring-1 ring-white/10" />
    <div className="absolute inset-[9%] rounded-full border border-white/[.045] shadow-[inset_0_0_32px_rgba(94,234,201,.08)]" />
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_15px_28px_rgba(4,11,36,.4)]">
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(5,14,38,.86)" strokeWidth="10" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(151,168,255,.22)" strokeWidth="8" />
      {winLength > 0 && <circle cx="50" cy="50" r="44" fill="none" stroke="url(#upgrade-zone)" strokeWidth="8" strokeLinecap="butt" strokeDasharray={`${winLength} ${circumference}`} />}
      <defs><linearGradient id="upgrade-zone"><stop stopColor="#a7f3d0" /><stop offset=".5" stopColor="#34d399" /><stop offset="1" stopColor="#5b8cff" /></linearGradient></defs>
    </svg>

    <div className="pointer-events-none absolute left-1/2 top-[1%] z-30 -translate-x-1/2">
      <i className="block h-0 w-0 border-x-[14px] border-t-[20px] border-x-transparent border-t-white drop-shadow-[0_5px_8px_rgba(0,0,0,.35)]" />
    </div>

    <div className="absolute inset-0 z-20" style={{ transform: `rotate(${angle}deg)`, transition: animating ? "transform 3s cubic-bezier(.08,.72,.08,1)" : "none", willChange: "transform" }}>
      <div className={cn("absolute left-1/2 top-[0.5%] flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] bg-[#081a3b] shadow-[0_0_0_4px_rgba(14,36,83,.65),0_0_28px_rgba(102,145,255,.75)] md:h-14 md:w-14", outcome === false ? "border-rose-400 shadow-[0_0_0_4px_rgba(70,14,30,.65),0_0_32px_rgba(251,113,133,.7)]" : outcome === true ? "border-emerald-300 shadow-[0_0_0_4px_rgba(6,78,59,.6),0_0_32px_rgba(110,231,183,.78)]" : "border-[#9daeff]")}>
        <img src="/images/puggift-bot-avatar-web-v2.webp" alt="Pug marker" className="h-full w-full object-cover" />
      </div>
    </div>

    <div className={cn("absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_45%_35%,#1b3d82,#07152f_72%)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_15px_35px_rgba(3,11,35,.4)] ring-1 ring-white/10", outcome === true && "shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_0_42px_rgba(52,211,153,.25)]", outcome === false && "shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_0_42px_rgba(244,63,94,.2)]")}>
      <Sparkles className={cn("mb-1 h-5 w-5", outcome === true ? "text-emerald-300" : outcome === false ? "text-rose-300" : "text-blue-200")} />
      <span className="text-[8px] font-black uppercase tracking-[.2em] text-white/40">Upgrade chance</span>
      <span className={cn("mt-0.5 font-display text-4xl font-black md:text-5xl", outcome === true ? "text-emerald-300" : outcome === false ? "text-rose-300" : "text-white")}>{chance ? `${Math.round(chance * 100)}%` : "—"}</span>
      <span className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/40">{spinning ? "Flying" : outcome === true ? "Upgraded" : outcome === false ? "Missed" : multiplier ? `${multiplier.toFixed(2)}× target` : "Choose target"}</span>
    </div>

    <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 rounded-full bg-[#102654]/90 px-3 py-1 text-[8px] font-black uppercase tracking-[.14em] text-blue-100/55 ring-1 ring-white/10">Pug starts here</div>
  </div>
}

function GiftHero({ title, hint, item }: { title: string; hint: string; item: Item | null }) {
  const rarity = item ? rarityOf(item.rarity) : null
  return <div className={cn("relative min-w-0 overflow-hidden rounded-[24px] border border-white/[.08] bg-[linear-gradient(145deg,rgba(21,45,96,.94),rgba(7,21,50,.9))] p-2.5 text-center shadow-[0_18px_45px_rgba(2,7,25,.25),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl md:min-h-[250px] md:p-4", item && rarity?.ring)}>
    <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_50%_0%,rgba(133,155,255,.2),transparent_72%)]" />
    <div className="relative flex items-center justify-between text-left md:block md:text-center"><div><div className="text-[8px] font-black uppercase tracking-[.18em] text-blue-100/45">{hint}</div><div className="text-[11px] font-black text-white/80 md:text-sm">{title}</div></div>{item && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-black text-white/55"><Coin className="h-3 w-3" />{fmt(item.value)}</span>}</div>
    {item ? <>
      <img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="relative mx-auto my-1 h-14 w-14 object-contain drop-shadow-[0_14px_18px_rgba(3,10,34,.55)] md:my-3 md:h-24 md:w-24" />
      <div className={cn("relative truncate text-[10px] font-black md:text-xs", rarity?.text)}>{item.name}</div>
    </> : <div className="relative flex h-[72px] flex-col items-center justify-center text-white/28 md:h-[142px]"><Target className="mb-1 h-6 w-6" /><span className="text-[9px] font-bold">Choose below</span></div>}
  </div>
}

function Picker({ title, subtitle, items, activeIds, empty, obscured = false, onPick }: { title: string; subtitle: string; items: Item[]; activeIds: number[]; empty: string; obscured?: boolean; onPick: (item: Item) => void }) {
  return <div className="min-w-0">
    <div className="mb-2 flex items-end justify-between gap-3 px-1"><div><h2 className="text-xs font-black">{title}</h2><p className="text-[9px] font-bold text-blue-100/40">{subtitle}</p></div><span className="text-[9px] font-black text-white/30">{items.length} GIFTS</span></div>
    {items.length === 0 ? <p className="rounded-[18px] bg-white/6 py-4 text-center text-[10px] font-bold text-white/35">{empty}</p> : <div className={cn("no-scrollbar relative flex gap-2 overflow-x-auto px-0.5 pb-1 pt-0.5", obscured && "pointer-events-none select-none")}>{items.map((item) => {
      const rarity = rarityOf(item.rarity)
      const active = activeIds.includes(item.id)
      return <button key={item.id} onClick={() => onPick(item)} className={cn("relative flex w-[78px] shrink-0 flex-col items-center rounded-[19px] bg-white/[.055] p-2 ring-1 transition active:scale-95 md:w-[88px]", active ? "bg-[#596dff]/25 ring-2 ring-[#a6b3ff] shadow-[0_8px_22px_rgba(65,52,190,.4)]" : rarity.ring, obscured && "blur-[7px] opacity-45")}>
        {active && <i className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />}
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
