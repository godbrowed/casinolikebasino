"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"
import type { CaseDTO, GiftDTO } from "@/app/actions/cases"
import { openCases } from "@/app/actions/cases"
import { sellGift } from "@/app/actions/user"
import { AppHeader } from "@/components/app-header"
import { CaseRoulette } from "@/components/case-roulette"
import { WinModal } from "@/components/win-modal"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { rarityOf, fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

export function CaseView({ c }: { c: CaseDTO }) {
  const router = useRouter()
  const { me, setBalance, refresh } = useUser()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GiftDTO | null>(null)
  const [lastInventoryId, setLastInventoryId] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openCount, setOpenCount] = useState(1)
  const [batchResults, setBatchResults] = useState<GiftDTO[]>([])

  const balance = me?.balance ?? 0
  const freeReady = !c.isFree || !c.nextFreeAt || new Date(c.nextFreeAt).getTime() <= Date.now()
  const canAfford = (c.isFree || balance >= c.price * openCount) && freeReady

  async function handleSpin() {
    if (spinning || busy) return
    if (!canAfford) {
      setError(c.isFree ? "Your free case is recharging. Come back when the 24-hour timer ends." : "Not enough balance. Deposit to play.")
      return
    }
    setError(null)
    setBusy(true)
    haptic("medium")
    try {
      const res = await openCases(c.id, c.isFree ? 1 : openCount)
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
            ? "Your free case is recharging. Come back in 24 hours."
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
      const res = await sellGift(lastInventoryId)
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
      <AppHeader title={c.name} />
      <main className="flex flex-col gap-5 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-3xl border border-white/12 bg-card/70 p-2 shadow-[0_7px_0_-5px_rgba(30,12,58,.75)]">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-secondary/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div><div className="text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Case laboratory</div><h1 className="font-display text-lg font-black">{c.name}</h1></div>
          <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> {c.isFree ? "Daily" : "Gift rewards"}
          </span>
        </div>

        <CaseRoulette pool={c.items} spinning={spinning} result={result} onSettled={handleSettled} />

        {error && (
          <p className="text-center text-xs font-medium text-destructive">{error}</p>
        )}

        {!c.isFree && <div className="rounded-3xl border border-white/12 bg-card/70 p-2"><div className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">How many cases?</div><div className="grid grid-cols-4 gap-2">{[1, 2, 3, 5].map((count) => <button key={count} onClick={() => setOpenCount(count)} disabled={spinning || busy} className={cn("rounded-2xl py-2 text-xs font-black transition-all", openCount === count ? "bg-primary text-primary-foreground shadow-[0_3px_0_rgb(151,92,28)]" : "bg-secondary text-muted-foreground")}>×{count}</button>)}</div></div>}

        <button
          onClick={handleSpin}
          disabled={spinning || busy}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-black transition-all active:scale-[0.98]",
            canAfford
              ? "bg-primary text-primary-foreground shadow-[0_0_28px_-4px] shadow-primary/60"
              : "bg-secondary text-muted-foreground",
            (spinning || busy) && "opacity-70",
          )}
        >
          {spinning ? (
            "Opening…"
          ) : (
            <>
              <span>{c.isFree ? (freeReady ? "Open free case" : "Available in 24h") : "Open case"}</span>
              <span className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5">
                {!c.isFree && <Coin className="h-3.5 w-3.5" />}
                <span className="font-mono">{c.isFree ? "FREE" : fmt(c.price * openCount)}</span>
              </span>
            </>
          )}
        </button>

        {batchResults.length > 1 && !spinning && <section className="surface-panel rounded-3xl p-3"><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-black">Your drops</h2><span className="text-xs text-muted-foreground">{batchResults.length} opened</span></div><div className="grid grid-cols-5 gap-2">{batchResults.map((gift, index) => { const rarity = rarityOf(gift.rarity); return <div key={`${gift.slug}-${index}`} className={cn("rounded-2xl border bg-background/45 p-1.5 text-center", rarity.ring)}><img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="mx-auto h-11 w-11 object-contain" /><div className={cn("mt-1 truncate text-[9px] font-bold", rarity.text)}>{gift.name}</div></div> })}</div></section>}

        <section className="surface-panel rounded-3xl p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-3.5 w-3.5 text-primary" /> Possible rewards</h2>
            <span className="text-xs text-muted-foreground">{c.items.length} rewards</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {c.items.map((g) => {
              const r = rarityOf(g.rarity)
              return (
                <div
                  key={g.id}
                  className={cn("rounded-2xl border border-border bg-background/45 p-2 text-center ring-1", r.ring)}
                >
                  <div className="relative mx-auto h-14 w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.imageUrl || "/images/nft-gift.png"} alt={g.name} className="h-full w-full object-contain" />
                  </div>
                  <div className={cn("mt-1 truncate text-[11px] font-semibold", r.text)}>{g.name}</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Coin className="h-3 w-3" />
                    <span className="font-mono">{fmt(g.value)}</span>
                  </div>
                  {g.floorTon ? (
                    <div className="text-[9px] font-mono text-muted-foreground/70">{g.floorTon} TON</div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-muted-foreground">{(g.chance ?? 0).toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {showWin && <WinModal gift={result} onSell={handleSell} onKeep={closeWin} busy={busy} />}
    </>
  )
}
