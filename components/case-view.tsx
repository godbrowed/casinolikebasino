"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { ArrowLeft, Gift, SlidersHorizontal, Trophy, X } from "lucide-react"
import Link from "next/link"
import type { CaseDTO, GiftDTO } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { CaseRoulette } from "@/components/case-roulette"
import { WinModal } from "@/components/win-modal"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { rarityOf, fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { fetchLiveDrops, openCasesApi, sellGiftApi } from "@/lib/client-game-api"

export function CaseView({ c }: { c: CaseDTO }) {
  const { me, setBalance, refresh } = useUser()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GiftDTO | null>(null)
  const [lastInventoryId, setLastInventoryId] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openCount, setOpenCount] = useState(1)
  const [batchResults, setBatchResults] = useState<GiftDTO[]>([])
  const [showOptions, setShowOptions] = useState(false)
  const [showPrizes, setShowPrizes] = useState(false)
  const [clientNow, setClientNow] = useState<number | null>(null)

  useEffect(() => { setClientNow(Date.now()) }, [])

  const balance = me?.balance ?? 0
  const freeReady = !c.isFree || !c.nextFreeAt || (clientNow != null && new Date(c.nextFreeAt).getTime() <= clientNow)
  const canAfford = c.items.length > 0 && (c.isFree || balance >= c.price * openCount) && freeReady

  async function handleSpin() {
    if (spinning || busy) return
    if (!canAfford) {
      setError(c.isFree ? "Your free case is recharging. Come back a little later." : "Not enough balance. Deposit to play.")
      return
    }
    setError(null)
    setBusy(true)
    haptic("medium")
    try {
      const res = await openCasesApi(c.id, c.isFree ? 1 : openCount)
      setResult(res.results[0].won)
      setBatchResults(res.results.map((item) => item.won))
      setLastInventoryId(res.results[0].inventoryId)
      setBalance(res.balance)
      setSpinning(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(
        msg === "INSUFFICIENT_FUNDS"
          ? "Not enough balance. Deposit to play."
          : msg === "FREE_CASE_COOLDOWN"
            ? "Your free case is recharging. Come back a little later."
            : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  function handleSettled() {
    setSpinning(false)
    setShowWin(batchResults.length === 1)
    hapticNotify("success")
  }

  async function handleSell() {
    if (lastInventoryId == null) return
    setBusy(true)
    try {
      const res = await sellGiftApi(lastInventoryId)
      setBalance(res.balance)
    } catch {
      // ignore
    } finally {
      setBusy(false)
      closeWin()
    }
  }

  function closeWin() {
    setShowWin(false)
    setResult(null)
    setLastInventoryId(null)
    setBatchResults([])
    refresh()
  }

  return (
    <>
      <AppHeader title={c.isFree ? "Free Case" : c.name} />
      <main className="relative flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-76px)] w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#2a68d6_0%,#1d51ad_34%,#153978_72%,#102a59_100%)] pb-[max(1rem,var(--tg-content-safe-area-inset-bottom,0px))] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.42)_1px,transparent_1px)] [background-size:62px_62px]" />
        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center gap-3 px-3 py-3 md:px-5">
          <Link href="/cases" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b1d42]/55 text-white/80 ring-1 ring-white/10 backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.2em] text-blue-200/65">PugGift case</div><h1 className="truncate font-display text-xl font-black md:text-2xl">{c.isFree ? "Free Case" : c.name}</h1></div>
          <span className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/70 ring-1 ring-white/10 backdrop-blur-md">{spinning ? "Spinning" : c.isFree ? "Free" : `${openCount}× ready`}</span>
        </div>

        <CaseLiveStrip />

        <div className="relative z-10 flex min-h-[260px] flex-1 flex-col justify-center py-2 md:min-h-[380px]">
          <div className="mx-auto flex w-full max-w-[1280px] items-end justify-between px-4 pb-1 md:px-8">
            <div><div className="text-[9px] font-black uppercase tracking-[.2em] text-blue-100/55">Gift runway</div><div className="font-display text-lg font-black md:text-xl">{spinning ? "Catch your drop" : "Ready to spin"}</div></div>
            <div className="text-right text-[10px] font-bold text-blue-100/55">{c.items.length} possible gifts<br />gift values shown below</div>
          </div>
          <CaseRoulette pool={c.items} spinning={spinning} results={batchResults} selectedCount={openCount} onSettled={handleSettled} />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[680px] flex-col gap-2.5 px-3 pt-2 md:px-4">
          {error && <p className="rounded-2xl bg-rose-500/18 px-3 py-2.5 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-200/20">{error}</p>}

          {batchResults.length > 1 && !spinning && <section className="rounded-[24px] bg-[#102854]/80 p-3 ring-1 ring-white/10 backdrop-blur-xl"><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-black">Your drops</h2><span className="text-[10px] font-black text-white/45">{batchResults.length} gifts</span></div><div className="no-scrollbar flex gap-2 overflow-x-auto">{batchResults.map((gift, index) => { const rarity = rarityOf(gift.rarity); return <div key={`${gift.slug}-${index}`} className="w-24 shrink-0 rounded-[18px] bg-white/[.07] p-2 text-center ring-1 ring-white/10"><img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="mx-auto h-14 w-14 object-contain" /><div className={cn("mt-1 truncate text-[9px] font-black", rarity.text)}>{gift.name}</div><div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-white/55"><Coin className="h-3 w-3" />{fmt(gift.value)}</div></div> })}</div></section>}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => !c.isFree && setShowOptions((value) => !value)} disabled={c.isFree || spinning || busy} className="flex items-center justify-center gap-2 rounded-[18px] bg-white/16 py-3 text-xs font-black text-white/80 ring-1 ring-white/10 backdrop-blur-md disabled:opacity-45"><SlidersHorizontal className="h-4 w-4" />{c.isFree ? "One opening" : `Open ×${openCount}`}</button>
            <button onClick={() => setShowPrizes((value) => !value)} className="flex items-center justify-center gap-2 rounded-[18px] bg-white/16 py-3 text-xs font-black text-white/80 ring-1 ring-white/10 backdrop-blur-md"><Trophy className="h-4 w-4" />Prizes</button>
          </div>

          {showOptions && !c.isFree && <div className="grid grid-cols-4 gap-2 rounded-[22px] bg-[#102854]/85 p-2 ring-1 ring-white/10 backdrop-blur-xl">{[1, 2, 3, 5].map((count) => <button key={count} onClick={() => { setOpenCount(count); setShowOptions(false) }} disabled={spinning || busy} className={cn("rounded-[15px] py-2.5 text-xs font-black transition-all", openCount === count ? "bg-white text-[#174699]" : "bg-white/8 text-white/55")}>×{count}</button>)}</div>}

          {showPrizes && <section className="rounded-[24px] bg-[#102854]/90 p-3 ring-1 ring-white/10 backdrop-blur-xl"><div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-sm font-black"><Gift className="h-4 w-4 text-blue-200" />Case prizes</h2><button onClick={() => setShowPrizes(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60"><X className="h-3.5 w-3.5" /></button></div><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{c.items.map((gift) => { const rarity = rarityOf(gift.rarity); return <div key={gift.id} className="w-24 shrink-0 rounded-[18px] bg-white/[.07] p-2 text-center ring-1 ring-white/10"><img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="mx-auto h-14 w-14 object-contain" /><div className={cn("mt-1 truncate text-[9px] font-black", rarity.text)}>{gift.name}</div><div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-white/60"><Coin className="h-3 w-3" />{fmt(gift.value)}</div></div> })}</div></section>}

          <button onClick={handleSpin} disabled={spinning || busy} className={cn("flex w-full items-center justify-center gap-2 rounded-[20px] py-4 font-display text-base font-black transition-all active:scale-[0.98]", canAfford ? "bg-[#2f70ff] text-white shadow-[0_13px_34px_-8px_rgba(21,40,110,.7),inset_0_1px_0_rgba(255,255,255,.3)]" : "bg-white/12 text-white/35", (spinning || busy) && "opacity-70")}>
            {spinning ? "Spinning…" : <><span>{c.isFree ? (freeReady ? "Spin free" : "Free case recharging") : "Spin for"}</span><span className="flex items-center gap-1 rounded-full bg-black/18 px-2.5 py-0.5">{!c.isFree && <Coin className="h-3.5 w-3.5" />}<span className="font-mono">{c.isFree ? "FREE" : fmt(c.price * openCount)}</span></span></>}
          </button>
        </div>
      </main>

      {showWin && <WinModal gift={result} onSell={handleSell} onKeep={closeWin} busy={busy} />}
    </>
  )
}

function CaseLiveStrip() {
  const { data: drops } = useSWR("case-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  if (!drops?.length) return null
  const loop = [...drops, ...drops]
  return <div className="relative z-10 w-full overflow-hidden border-y border-white/10 bg-[#214d9d]/75 py-2.5 backdrop-blur-md"><div className="no-scrollbar flex items-center gap-4 overflow-x-auto px-3"><span className="flex shrink-0 items-center gap-2 pr-1 text-[11px] font-black uppercase tracking-[.14em]"><i className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />LIVE</span>{loop.map((drop, index) => <img key={`${drop.id}-${index}`} src={drop.imageUrl} alt={drop.name} className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_7px_8px_rgba(4,14,45,.45)]" />)}</div></div>
}
