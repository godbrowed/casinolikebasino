"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Check, ChevronRight, ExternalLink, Loader2, Send, ShoppingBag, SlidersHorizontal, Trophy, X, Zap } from "lucide-react"
import type { CaseDTO, GiftDTO } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { CaseRoulette } from "@/components/case-roulette"
import { WinModal } from "@/components/win-modal"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify, sharePreparedMessage } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { fetchFreeCaseRequirements, fetchLiveDrops, openCasesApi, sellGiftApi, sellGiftBatchApi, updateFreeCaseRequirement } from "@/lib/client-game-api"

type OpenedDrop = { won: GiftDTO; inventoryId: number | null }

export function CaseView({ c }: { c: CaseDTO }) {
  const { me, setBalance, refresh } = useUser()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GiftDTO | null>(null)
  const [lastInventoryId, setLastInventoryId] = useState<number | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openCount, setOpenCount] = useState(1)
  const [batchResults, setBatchResults] = useState<OpenedDrop[]>([])
  const [fastSpin, setFastSpin] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showPrizes, setShowPrizes] = useState(false)
  const [clientNow, setClientNow] = useState<number | null>(null)
  const [showRequirements, setShowRequirements] = useState(c.isFree)
  const [requirementBusy, setRequirementBusy] = useState<string | null>(null)
  const { data: requirements, mutate: refreshRequirements } = useSWR(c.isFree ? "free-case-requirements" : null, fetchFreeCaseRequirements, { revalidateOnFocus: true })

  useEffect(() => { setClientNow(Date.now()) }, [])

  const balance = me?.balance ?? 0
  const freeReady = !c.isFree || !c.nextFreeAt || (clientNow != null && new Date(c.nextFreeAt).getTime() <= clientNow)
  const requirementsReady = !c.isFree || requirements?.ready === true
  const canAfford = c.items.length > 0 && (c.isFree || balance >= c.price * openCount) && freeReady && requirementsReady

  async function handleSpin() {
    if (spinning || busy) return
    if (c.isFree && !requirementsReady) {
      setShowRequirements(true)
      return
    }
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
      setBatchResults(res.results)
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
            : msg === "FREE_CASE_REQUIREMENTS"
              ? "Complete the free case requirements first."
            : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  async function shareWithFriend() {
    if (requirementBusy || requirements?.shares === requirements?.requiredShares) return
    setRequirementBusy("share")
    setError(null)
    try {
      const prepared = await updateFreeCaseRequirement("prepare-share")
      if (!prepared.messageId) throw new Error("Telegram could not prepare the share message.")
      const sent = await sharePreparedMessage(prepared.messageId)
      if (!sent) throw new Error("Message was not sent. Choose a chat and send it to continue.")
      await updateFreeCaseRequirement("share-complete")
      await refreshRequirements()
      hapticNotify("success")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the share")
    } finally {
      setRequirementBusy(null)
    }
  }

  async function visitTradeApp() {
    if (!requirements) return
    setRequirementBusy("trade")
    try {
      await updateFreeCaseRequirement("trade-visit")
      await refreshRequirements()
      window.open(requirements.tradeUrl, "_blank", "noopener,noreferrer")
    } finally {
      setRequirementBusy(null)
    }
  }

  async function verifyRequirements() {
    setRequirementBusy("verify")
    const fresh = await refreshRequirements()
    setRequirementBusy(null)
    if (fresh?.ready) {
      setShowRequirements(false)
      hapticNotify("success")
    } else if (fresh && !fresh.channelCheckAvailable) {
      setError("Subscription check is unavailable. Add the bot as an admin of @PugGift and try again.")
    } else {
      setError("Complete all required steps, then tap Done again.")
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

  async function handleSellBatch() {
    const inventoryIds = batchResults.flatMap((drop) => drop.inventoryId == null ? [] : [drop.inventoryId])
    if (!inventoryIds.length || busy) return
    setBusy(true); setError(null)
    try {
      const res = await sellGiftBatchApi(inventoryIds)
      setBalance(res.balance)
      setBatchResults((current) => current.filter((drop) => drop.inventoryId == null))
      hapticNotify("success")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sell these drops")
    } finally { setBusy(false) }
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
      <main className="game-surface game-surface--case flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-64px)] w-full flex-col overflow-hidden pb-[max(1rem,var(--tg-content-safe-area-inset-bottom,0px))] text-white">
        <h1 className="px-4 py-5 text-center text-xl font-semibold tracking-tight md:text-2xl">{c.isFree ? "Free Case" : c.name}</h1>

        <CaseLiveStrip />

        <div className="flex min-h-[300px] flex-1 flex-col justify-center py-6 md:min-h-[400px]">
          <CaseRoulette pool={c.items} spinning={spinning} results={batchResults.map((drop) => drop.won)} selectedCount={openCount} fast={fastSpin} onSettled={handleSettled} />
        </div>

        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3 px-4 pt-2">
          {error && <p role="alert" className="rounded-xl bg-rose-950/30 px-3 py-3 text-center text-sm text-rose-100">{error}</p>}

          {batchResults.length > 1 && !spinning && (
            <section className="rounded-2xl bg-black/15 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Your gifts</h2>
                {batchResults.some((drop) => drop.inventoryId != null) && (
                  <button onClick={handleSellBatch} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold disabled:opacity-50">
                    <ShoppingBag className="h-4 w-4" />Sell all · {fmt(batchResults.reduce((sum, drop) => sum + (drop.inventoryId == null ? 0 : drop.won.value), 0))}
                  </button>
                )}
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {batchResults.map(({ won: gift, inventoryId }, index) => (
                  <div key={`${gift.slug}-${index}`} className="w-32 shrink-0 rounded-xl bg-white/[.06] p-3 text-center">
                    <img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="mx-auto h-20 w-20 object-contain" />
                    <div className="mt-2 truncate text-sm font-medium">{gift.name}</div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-sm tabular-nums text-white/80"><Coin className="h-3.5 w-3.5" />{fmt(gift.value)}</div>
                    {inventoryId == null && <div className="mt-1 text-xs text-white/65">Added to balance</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowOptions((value) => !value)} disabled={spinning || busy} aria-expanded={showOptions} aria-controls="case-settings" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium text-white/90 disabled:opacity-45">
              <SlidersHorizontal className="h-4 w-4" />Settings{openCount > 1 && <span className="text-white/65">· ×{openCount}</span>}
            </button>
            <button onClick={() => setShowPrizes((value) => !value)} aria-expanded={showPrizes} aria-controls="case-prizes" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium text-white/90">
              <Trophy className="h-4 w-4" />Prizes
            </button>
          </div>

          {showOptions && (
            <section id="case-settings" aria-label="Spin settings" className="rounded-2xl bg-black/15 p-3">
              {!c.isFree && (
                <div className="mb-3">
                  <h2 className="mb-2 text-sm font-medium text-white/80">Number of openings</h2>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 5].map((count) => <button key={count} onClick={() => { setOpenCount(count); setShowOptions(false) }} disabled={spinning || busy} aria-pressed={openCount === count} className={cn("min-h-11 rounded-xl text-sm font-semibold transition-colors", openCount === count ? "bg-white text-[#19428b]" : "bg-white/10 text-white/80")}>×{count}</button>)}
                  </div>
                </div>
              )}
              <button onClick={() => setFastSpin((value) => !value)} disabled={spinning || busy} aria-pressed={fastSpin} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-sm font-medium disabled:opacity-45">
                <span className="flex items-center gap-2"><Zap className="h-4 w-4" />Fast spin</span>
                <span className={cn("rounded-lg px-3 py-1.5 text-sm", fastSpin ? "bg-white text-[#19428b]" : "bg-white/10 text-white/70")}>{fastSpin ? "On" : "Off"}</span>
              </button>
            </section>
          )}

          {showPrizes && (
            <section id="case-prizes" className="rounded-2xl bg-black/15 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Prizes</h2>
                <button onClick={() => setShowPrizes(false)} aria-label="Close prizes" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70"><X className="h-5 w-5" /></button>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {c.items.map((gift) => (
                  <div key={gift.id} className="w-32 shrink-0 rounded-xl bg-white/[.06] p-3 text-center">
                    <img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="mx-auto h-20 w-20 object-contain" />
                    <div className="mt-2 truncate text-sm font-medium">{gift.name}</div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-sm tabular-nums text-white/80"><Coin className="h-3.5 w-3.5" />{fmt(gift.value)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button onClick={handleSpin} disabled={spinning || busy} className={cn("flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-3 py-4 text-base font-semibold transition-colors active:scale-[0.99]", canAfford ? "bg-[#2b6eff] text-white" : "bg-white/12 text-white/60", (spinning || busy) && "opacity-70")}>
            {spinning ? "Spinning…" : <><span>{c.isFree ? (!freeReady ? "Free case recharging" : requirementsReady ? "Spin free" : "Complete requirements") : "Spin"}</span>{!c.isFree && <span className="flex items-center gap-1.5"><span aria-hidden="true">·</span><Coin className="h-4 w-4" /><span className="tabular-nums">{fmt(c.price * openCount)}</span></span>}</>}
          </button>
        </div>
      </main>

      {showWin && <WinModal gift={result} onSell={handleSell} onKeep={closeWin} busy={busy} locked={c.isFree && result?.rewardType === "gift"} />}
      {c.isFree && showRequirements && requirements && <FreeCaseRequirementsModal
        requirements={requirements}
        busy={requirementBusy}
        onClose={() => setShowRequirements(false)}
        onShare={shareWithFriend}
        onTrade={visitTradeApp}
        onChannel={() => window.open(requirements.channelUrl, "_blank", "noopener,noreferrer")}
        onDone={verifyRequirements}
      />}
    </>
  )
}

function FreeCaseRequirementsModal({ requirements, busy, onClose, onShare, onTrade, onChannel, onDone }: {
  requirements: NonNullable<Awaited<ReturnType<typeof fetchFreeCaseRequirements>>>
  busy: string | null
  onClose: () => void
  onShare: () => void
  onTrade: () => void
  onChannel: () => void
  onDone: () => void
}) {
  const shared = requirements.shares >= requirements.requiredShares
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="free-case-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[#282b30] p-5 text-white">
      <div className="flex items-start justify-between gap-4"><div className="flex-1"><h2 id="free-case-title" className="text-xl font-semibold">Unlock your free case</h2><p className="mt-1 text-sm text-white/65">Complete these three steps to spin.</p></div><button onClick={onClose} aria-label="Close requirements" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/65"><X className="h-5 w-5" /></button></div>
      <div className="mt-4 divide-y divide-white/[.06]">
        <RequirementRow icon={<Send className="h-5 w-5" />} tone="blue" title="Send to a friend" description={shared ? "Share confirmed" : "Send once in any private chat"} done={shared} busy={busy === "share"} onClick={onShare} />
        <RequirementRow icon={<span className="text-lg">📣</span>} tone="orange" title="Subscribe to @PugGift" description={requirements.subscribed ? "Subscription confirmed" : "Join the channel and come back"} done={requirements.subscribed} onClick={onChannel} />
        <RequirementRow icon={<ExternalLink className="h-5 w-5" />} tone="orange" title="Go to Trade" description={requirements.tradeVisited ? "Trade opened" : "Open the app and come back here"} done={requirements.tradeVisited} busy={busy === "trade"} onClick={onTrade} />
      </div>
      <button onClick={onDone} disabled={busy !== null} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2b6eff] py-3 text-base font-semibold disabled:opacity-60">{busy === "verify" ? <Loader2 className="h-5 w-5 animate-spin" /> : requirements.ready ? "Ready to spin" : "Done"}</button>
      {!requirements.channelCheckAvailable && <p className="mt-3 text-center text-xs leading-relaxed text-amber-200/90">The bot must be an admin of @PugGift to verify subscriptions.</p>}
    </section>
  </div>
}

function RequirementRow({ icon, tone, title, description, done, busy, onClick }: { icon: React.ReactNode; tone: "blue" | "orange"; title: string; description: string; done: boolean; busy?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={done || busy} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[.04] disabled:opacity-80">
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone === "blue" ? "bg-[#2b6eff]/20 text-[#8bb4ff]" : "bg-[#ef6a3a]/15 text-[#f19c7e]")}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}</span>
    <span className="min-w-0 flex-1"><b className="block text-sm font-semibold">{title}</b><small className="mt-0.5 block text-xs leading-relaxed text-white/65">{description}</small></span>
    {done ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-4 w-4 stroke-[3]" /></span> : <ChevronRight className="h-5 w-5 text-white/30" />}
  </button>
}

function CaseLiveStrip() {
  const { data: drops } = useSWR("case-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  if (!drops?.length) return null
  return <div className="w-full overflow-hidden bg-black/10 py-2.5"><div className="no-scrollbar flex items-center gap-4 overflow-x-auto px-4"><span className="shrink-0 text-xs font-medium text-white/70">Live</span>{drops.map((drop) => <img key={drop.id} src={drop.imageUrl} alt={drop.name} className="h-10 w-10 shrink-0 object-contain" />)}</div></div>
}
