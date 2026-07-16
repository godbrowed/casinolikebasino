"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, KeyRound, LockKeyhole } from "lucide-react"
import Link from "next/link"
import type { CaseDTO, GiftDTO } from "@/app/actions/cases"
import { openCase, redeemFreeCasePromo } from "@/app/actions/cases"
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
  const [promoCode, setPromoCode] = useState("")
  const [unlocked, setUnlocked] = useState(c.isUnlocked)

  const balance = me?.balance ?? 0
  const freeReady = !c.isFree || !c.nextFreeAt || new Date(c.nextFreeAt).getTime() <= Date.now()
  const canAfford = (c.isFree || balance >= c.price) && freeReady && (!c.isFree || unlocked)

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
      const res = await openCase(c.id)
      setResult(res.won)
      setLastInventoryId(res.inventoryId)
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

  async function handlePromoSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await redeemFreeCasePromo(promoCode)
      setUnlocked(true)
      setPromoCode("")
      hapticNotify("success")
      router.refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not activate promo code"
      setError(message === "INVALID_PROMO_CODE" ? "This promo code is invalid." : message)
      hapticNotify("error")
    } finally {
      setBusy(false)
    }
  }

  function handleSettled() {
    setSpinning(false)
    setShowWin(true)
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
    refresh()
  }

  return (
    <>
      <AppHeader title={c.name} />
      <main className="flex flex-col gap-5 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-lg font-bold">{c.name}</h1>
        </div>

        <CaseRoulette pool={c.items} spinning={spinning} result={result} onSettled={handleSettled} />

        {error && (
          <p className="text-center text-xs font-medium text-destructive">{error}</p>
        )}

        {c.isFree && !unlocked ? (
          <form onSubmit={handlePromoSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <LockKeyhole aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="font-display text-sm font-bold">Unlock the free case</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Enter your promo code once. Access stays active forever, with one opening every 24 hours.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <label htmlFor="free-case-promo" className="sr-only">Promo code</label>
              <input
                id="free-case-promo"
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                placeholder="Promo code"
                autoCapitalize="characters"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-border bg-secondary px-3 py-3 font-mono text-sm uppercase outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy || promoCode.trim().length === 0}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 font-display text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <KeyRound aria-hidden="true" />
                {busy ? "Checking" : "Unlock"}
              </button>
            </div>
          </form>
        ) : (
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
                <span className="flex items-center gap-1 rounded-full bg-background/20 px-2.5 py-0.5">
                  {!c.isFree && <Coin className="size-3.5" />}
                  <span className="font-mono">{c.isFree ? "FREE" : fmt(c.price)}</span>
                </span>
              </>
            )}
          </button>
        )}

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold">Contents</h2>
            <span className="text-xs text-muted-foreground">{c.items.length} rewards</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {c.items.map((g) => {
              const r = rarityOf(g.rarity)
              return (
                <div
                  key={g.id}
                  className={cn("rounded-xl border border-border bg-card p-2 text-center ring-1", r.ring)}
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
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {(g.chance ?? 0) > 0 && (g.chance ?? 0) < 0.1 ? "<0.1%" : `${(g.chance ?? 0).toFixed(1)}%`}
                  </div>
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
