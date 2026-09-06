"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, Package, Target } from "lucide-react"
import { upgradeGift } from "@/app/actions/upgrade"
import { upgradeChance } from "@/lib/upgrade-shared"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
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

      // The marker resets to the bottom before a fresh GPU-only rotation.
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
    <div className="game-surface game-surface--upgrade relative min-h-[calc(var(--tg-viewport-stable-height,100dvh)-64px)] overflow-hidden pb-[calc(6.5rem+var(--tg-content-safe-area-inset-bottom,0px))] text-white">
      <div className="mx-auto w-full max-w-[1040px] px-4 pb-2 pt-3 text-center md:px-6 md:pt-6">
        <h1 className="text-[28px] font-bold tracking-tight">Upgrade</h1>
        <p className="mt-1 text-[14px] text-[#96999f]">Choose your gifts and the one you want.</p>
      </div>

      <main className="mx-auto flex w-full max-w-[1040px] flex-col px-4 md:px-6">
        <section className="mx-auto grid w-full max-w-[560px] grid-cols-2 items-center gap-3 md:max-w-none md:grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,1fr)] md:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)_minmax(0,1fr)] lg:gap-6">
          <div className="order-2 min-w-0 md:order-1"><GiftHero title="Your gifts" item={source} /></div>
          <div className="order-1 col-span-2 mx-auto w-full min-w-0 max-w-[240px] md:order-2 md:col-span-1 md:max-w-none">
            <UpgradeWheel angle={angle} spinning={spinning} animating={wheelAnimating} chance={shownChance} multiplier={shownMultiplier} outcome={outcome} />
          </div>
          <div className="order-3 min-w-0"><GiftHero title="Upgrade to" item={target} /></div>
        </section>

        <div className="mx-auto mt-4 flex w-full max-w-[760px] flex-col gap-4 md:mt-5">
          {error && <p role="alert" className="rounded-[18px] bg-[#472e32] px-4 py-3 text-center text-[13px] text-[#ffb7bf]">{error}</p>}

          <button onClick={handleUpgrade} disabled={!source || !target || spinning || chance <= 0} className={cn("mx-auto flex min-h-[58px] w-full max-w-[560px] items-center justify-center rounded-[20px] px-4 py-4 text-[18px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400", source && target && !spinning ? "bg-[#2b6eff] text-white hover:bg-[#3979ff] active:bg-[#225de0]" : "bg-[#34373c] text-[#999da4]")}>
            {spinning ? "Upgrading…" : target ? "Upgrade" : "Choose an upgrade target"}
          </button>

          <section className="overflow-hidden rounded-[24px] bg-[#303237] p-3 md:p-4">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-[18px] bg-[#25272b] p-1">
              <button onClick={() => setPickerMode("source")} disabled={spinning} className={cn("min-h-[44px] rounded-[14px] px-2 py-2 text-[14px] font-semibold transition-colors", pickerMode === "source" ? "bg-[#4a4d53] text-white" : "text-[#a7aab0] hover:text-white")}>Your gifts · {spinning ? "•••" : displayInventory.length}</button>
              <button onClick={() => source && setPickerMode("target")} disabled={!source || spinning} className={cn("min-h-[44px] rounded-[14px] px-2 py-2 text-[14px] font-semibold transition-colors disabled:opacity-40", pickerMode === "target" ? "bg-[#4a4d53] text-white" : "text-[#a7aab0] hover:text-white")}>Upgrade to · {spinning ? "•••" : eligibleTargets.length}</button>
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

        </div>
      </main>
    </div>
  )
}

function UpgradeWheel({ angle, spinning, animating, chance, multiplier, outcome }: { angle: number; spinning: boolean; animating: boolean; chance: number; multiplier: number; outcome: boolean | null }) {
  const circumference = 2 * Math.PI * 44
  const winLength = chance > 0 ? Math.max(4, chance * circumference) : 0

  return <div className="relative mx-auto my-3 aspect-square w-full max-w-[400px]">
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#3c3f45" strokeWidth="9" />
      {winLength > 0 && <circle cx="50" cy="50" r="44" fill="none" stroke="#2b6eff" strokeWidth="9" strokeLinecap="butt" strokeDasharray={`${winLength} ${circumference}`} />}
    </svg>

    <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2" aria-hidden="true">
      <i className="block h-0 w-0 border-x-[8px] border-t-[11px] border-x-transparent border-t-white" />
    </div>

    <div className="absolute inset-0 z-20" aria-hidden="true" style={{ transform: `rotate(${angle}deg)`, transition: animating ? "transform 3s cubic-bezier(.08,.72,.08,1)" : "none", willChange: animating ? "transform" : "auto" }}>
      <div className={cn("absolute left-1/2 top-[6%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-[#202225]", outcome === false ? "bg-[#e67d88]" : outcome === true ? "bg-[#6cd0a1]" : "bg-white")} />
    </div>

    <div className="absolute inset-[19%] flex flex-col items-center justify-center text-center" aria-live="polite">
      <span className="text-[13px] font-medium text-[#96999f]">Upgrade chance</span>
      <span className={cn("mt-1 text-[56px] font-bold leading-tight tracking-tight tabular-nums md:text-[64px]", outcome === true ? "text-[#6cd0a1]" : outcome === false ? "text-[#e67d88]" : "text-white")}>{chance ? `${Math.round(chance * 100)}%` : "—"}</span>
      <span className="mt-2 rounded-full bg-[#34373c] px-3 py-1.5 text-[13px] font-semibold text-[#c5c8ce]">{spinning ? "Upgrading…" : outcome === true ? "Upgraded" : outcome === false ? "Not upgraded" : multiplier ? `${multiplier.toFixed(2)}× value` : "Choose a gift"}</span>
    </div>
  </div>
}

function GiftHero({ title, item }: { title: string; item: Item | null }) {
  return <div className="min-w-0 overflow-hidden rounded-[24px] bg-[#303237] px-3 py-4 text-center">
    <div className="text-[13px] font-medium text-[#a4a7ad]">{title}</div>
    {item ? <>
      <img src={item.imageUrl || "/images/nft-gift.png"} alt={item.name} className="mx-auto my-2 h-20 w-20 object-contain md:h-[100px] md:w-[100px]" />
      <div className="truncate text-[13px] font-semibold text-white" title={item.name}>{item.name}</div>
      <span className="mt-2 inline-flex max-w-full items-center justify-center gap-1.5 rounded-full bg-[#474a50] px-3 py-1.5 text-[13px] font-semibold tabular-nums text-white"><Coin className="h-4 w-4 shrink-0" /><span className="truncate">{fmt(item.value)}</span></span>
    </> : <div className="flex min-h-[149px] flex-col items-center justify-center text-[#92969d] md:min-h-[169px]"><Target className="mb-3 h-8 w-8" strokeWidth={1.5} /><span className="text-[13px]">Choose below</span></div>}
  </div>
}

function Picker({ title, subtitle, items, activeIds, empty, obscured = false, onPick }: { title: string; subtitle: string; items: Item[]; activeIds: number[]; empty: string; obscured?: boolean; onPick: (item: Item) => void }) {
  return <div className="min-w-0">
    <div className="mb-3 px-1"><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-0.5 text-[13px] text-[#a4a7ad]">{subtitle}</p></div>
    {items.length === 0 ? <p className="rounded-[18px] bg-[#393c42] py-6 text-center text-[13px] text-[#a4a7ad]">{empty}</p> : <div className={cn("no-scrollbar relative flex gap-2 overflow-x-auto px-0.5 pb-1 pt-0.5", obscured && "pointer-events-none select-none")}>{items.map((item) => {
      const active = activeIds.includes(item.id)
      return <button key={item.id} onClick={() => onPick(item)} disabled={obscured} aria-pressed={active} aria-label={`${item.name}, ${fmt(item.value)} Stars`} className={cn("relative flex w-[132px] shrink-0 flex-col items-center rounded-[20px] p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400", active ? "bg-[#3c4d72] ring-2 ring-[#2b6eff]" : "bg-[#393c42] hover:bg-[#43474e]", obscured && "blur-[7px] opacity-45")}>
        {active && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2b6eff] text-white"><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></span>}
        <img src={item.imageUrl || "/images/nft-gift.png"} alt="" className="h-[100px] w-[100px] object-contain" />
        <span className="mt-1 w-full truncate text-[13px] font-medium text-white" title={item.name}>{item.name}</span>
        <span className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-[#50545c] px-2 py-1.5 text-[13px] font-semibold tabular-nums text-white"><Coin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{fmt(item.value)}</span></span>
      </button>
    })}</div>}
  </div>
}

function EmptyUpgrade() {
  return <div className="game-surface game-surface--upgrade relative flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-76px)] items-center justify-center overflow-hidden px-4 pb-24 text-white">
    <div className="relative flex w-full max-w-[440px] flex-col items-center rounded-[28px] bg-[#303237] p-7 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#41454c]"><Package className="h-9 w-9 text-[#c7cbd2]" strokeWidth={1.5} /></span>
      <h1 className="mt-5 text-[26px] font-bold tracking-tight">No gifts to upgrade yet</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-[#a4a7ad]">Add a gift to your collection, then choose a more valuable one to upgrade to.</p>
      <Link href="/cases" className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2b6eff] py-4 text-[17px] font-semibold hover:bg-[#3979ff]">Open cases <ChevronRight className="h-5 w-5" /></Link>
    </div>
  </div>
}
