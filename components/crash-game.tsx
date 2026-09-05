"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Gift, Sparkles } from "lucide-react"
import useSWR from "swr"
import type { CrashBoard, OwnedGift } from "@/app/actions/crash"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { CrashClock, type CrashClockSample } from "@/lib/crash-clock"
import { sharedRoundId } from "@/lib/crash-shared"
import { playGameSound } from "@/lib/game-sound"
import {
  cashoutCrashApi,
  cashoutGiftCrashApi,
  fetchCrashBoard,
  fetchCrashGifts,
  settleCrashApi,
  settleGiftCrashApi,
  startCrashApi,
  startGiftCrashApi,
} from "@/lib/client-game-api"

type StakeKind = "stars" | "gift"
type ActiveWager =
  | { kind: "stars"; token: string; amount: number; roundId: number }
  | { kind: "gift"; token: string; gifts: OwnedGift[]; stakeValue: number; roundId: number }
type Outcome =
  | { kind: "stars"; payout: number; at: number }
  | { kind: "gift"; gift: OwnedGift; at: number }

export function CrashGame() {
  const { me, setBalance, refresh } = useUser()
  const { data: board, mutate } = useSWR<CrashBoard>("shared-crash-board", fetchCrashBoard, {
    // The round crash is delivered by /watch. This is only a safety snapshot,
    // not the animation clock, so it should not hammer the DB every second.
    refreshInterval: 4000,
    revalidateOnFocus: true,
  })
  const { data: giftData, mutate: mutateGifts } = useSWR("crash-gifts", fetchCrashGifts, {
    revalidateOnFocus: true,
  })
  const [stakeKind, setStakeKind] = useState<StakeKind>("stars")
  const [bet, setBet] = useState(100)
  const [selectedGifts, setSelectedGifts] = useState<OwnedGift[]>([])
  const [wager, setWager] = useState<ActiveWager | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { clock, view, resync } = useCrashClock()
  const [requestState, setRequestState] = useState<"bet" | "cashout" | "settle" | null>(null)
  const requestBusy = useRef(false)
  const [settleRetry, setSettleRetry] = useState(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settling = useRef(false)
  const crashSoundedRound = useRef<number | null>(null)
  const balance = me?.balance ?? 0
  const phase = view.phase
  const multiplier = view.multiplier
  const countdown = view.countdown
  const canBet = phase === "betting" && !wager && !requestState
  const canCashout = phase === "flying" && Boolean(wager) && wager?.roundId === view.roundId
  const readMultiplier = useCallback(() => clock.multiplier(performance.now()), [clock])
  const stakeValue = wager?.kind === "gift" ? wager.stakeValue : wager?.kind === "stars" ? wager.amount : stakeKind === "gift" ? selectedGifts.reduce((sum, gift) => sum + gift.value, 0) : bet

  useEffect(() => { if (view.roundId !== null) void mutate() }, [view.roundId, mutate])
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current) }, [])

  useEffect(() => {
    const roundEnded = wager && view.roundId !== null && (view.roundId > wager.roundId || (view.roundId === wager.roundId && phase === "crashed"))
    if (!roundEnded || !wager || settling.current || requestBusy.current) return
    settling.current = true
    requestBusy.current = true
    setRequestState("settle")
    const request = wager.kind === "gift" ? settleGiftCrashApi(wager.token) : settleCrashApi(wager.token)
    void request.then(() => {
      setWager(null)
      setSelectedGifts([])
      void refresh()
      void mutate()
      void mutateGifts()
      hapticNotify("error")
    }).catch(() => {
      setError("Reconnecting to confirm the result. Your bet is saved.")
      retryTimer.current = setTimeout(() => setSettleRetry((value) => value + 1), 2000)
    }).finally(() => {
      settling.current = false
      requestBusy.current = false
      setRequestState(null)
    })
  }, [mutate, mutateGifts, phase, refresh, wager, view.roundId, settleRetry])

  useEffect(() => {
    if (phase === "crashed" && view.roundId !== null && crashSoundedRound.current !== view.roundId) {
      crashSoundedRound.current = view.roundId
      playGameSound("crash")
    }
  }, [view.roundId, phase])

  async function placeWager() {
    if (!canBet || requestBusy.current || view.roundId === null || clock.phase(performance.now()) !== "betting") return
    if (stakeKind === "stars" && (bet <= 0 || bet > balance)) {
      setError("Not enough Stars. Top up to join the next flight.")
      return
    }
    if (stakeKind === "gift" && !selectedGifts.length) {
      setError("Choose one or several gifts for this flight.")
      return
    }

    setError(null)
    setOutcome(null)
    requestBusy.current = true
    setRequestState("bet")
    haptic("medium")
    playGameSound("bet")
    try {
      if (stakeKind === "gift" && selectedGifts.length) {
        const result = await startGiftCrashApi(selectedGifts.map((gift) => gift.id))
        setWager({ kind: "gift", token: result.token, gifts: selectedGifts, stakeValue: result.stakeValue, roundId: sharedRoundId(result.startTime) })
        void mutateGifts().catch(() => undefined)
      } else {
        const result = await startCrashApi(bet)
        setWager({ kind: "stars", token: result.token, amount: bet, roundId: sharedRoundId(result.startTime) })
        setBalance(result.balance)
      }
      void mutate().catch(() => undefined)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place the bet"
      setError(message === "BETTING_CLOSED" ? "Betting closed — wait for the next countdown." : message)
      mutate()
      mutateGifts()
    } finally {
      requestBusy.current = false
      setRequestState(null)
      resync()
      setSettleRetry((value) => value + 1)
    }
  }

  async function cashout() {
    if (!wager || !canCashout || requestBusy.current || clock.phase(performance.now()) !== "flying") return
    requestBusy.current = true
    setRequestState("cashout")
    setError(null)
    haptic("heavy")
    try {
      if (wager.kind === "gift") {
        const result = await cashoutGiftCrashApi(wager.token)
        if (result.success && result.gift) {
          setOutcome({ kind: "gift", gift: result.gift, at: result.multiplier })
          hapticNotify("success")
          playGameSound("cashout")
        } else hapticNotify("error")
        setSelectedGifts([])
        void mutateGifts().catch(() => undefined)
      } else {
        const result = await cashoutCrashApi(wager.token)
        if (result.success) {
          setOutcome({ kind: "stars", payout: result.payout, at: result.multiplier })
          setBalance(result.balance ?? balance)
          hapticNotify("success")
          playGameSound("cashout")
        } else hapticNotify("error")
      }
      setWager(null)
      refresh()
      mutate()
    } catch {
      setError("Could not confirm cashout. Reconnect and try again; the server decides the result.")
    } finally {
      requestBusy.current = false
      setRequestState(null)
      resync()
      setSettleRetry((value) => value + 1)
    }
  }

  function chooseStakeKind(kind: StakeKind) {
    if (wager || requestBusy.current) return
    setStakeKind(kind)
    setError(null)
    haptic("light")
  }

  return <div className="crash-board game-surface game-surface--crash flex min-h-[calc(100dvh-128px)] w-full flex-col pb-[calc(7rem+var(--tg-content-safe-area-inset-bottom,0px))]">
    <CrashRocket
      phase={phase === "flying" ? "running" : phase === "crashed" ? "crashed" : "idle"}
      multiplier={multiplier}
      payloadImage={wager?.kind === "gift" ? wager.gifts[0]?.imageUrl ?? null : null}
      collectImages={giftData?.rewardImages ?? []}
      readMultiplier={readMultiplier}
    >
      {phase === "syncing" ? <>
        <div className="font-display text-2xl font-semibold text-white">Connecting…</div>
        <div className="mt-2 text-xs text-white/50">Synchronizing the live round</div>
      </> : phase === "betting" ? <>
        <div className="font-display text-[82px] font-black leading-none tabular-nums text-white md:text-[104px]">{countdown || 1}</div>
        <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-white/45"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6e96ff]" />bets open</div>
      </> : phase === "crashed" ? <>
        <div className="rounded-full bg-[#071126]/75 px-4 py-2 font-display text-xl font-black text-rose-300 backdrop-blur-sm">CRASHED · {multiplier.toFixed(2)}×</div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-[.18em] text-white/38">next round in {countdown}s</div>
      </> : <>
        <LiveValue readMultiplier={readMultiplier} className="font-display text-5xl font-bold tabular-nums text-white md:text-7xl" />
        <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />live flight</div>
      </>}
      {outcome?.kind === "stars" && <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950"><Coin className="h-4 w-4" />CASHED {outcome.at.toFixed(2)}× · +{fmt(outcome.payout)}</div>}
      {outcome?.kind === "gift" && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/95 p-2 pr-4 text-left text-[#071126] shadow-xl">
        <img src={outcome.gift.imageUrl} alt="" className="h-10 w-10 object-contain" />
        <span><b className="block text-xs">{outcome.gift.name}</b><small className="flex items-center gap-1 text-[10px] font-bold text-[#526078]"><Coin className="h-3 w-3" />{fmt(outcome.gift.value)} · {outcome.at.toFixed(2)}×</small></span>
      </div>}
    </CrashRocket>

    <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto border-y border-white/[.055] bg-[#101726]/92 px-3 py-3 backdrop-blur-xl">
      <span className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-black", phase === "betting" ? "bg-white text-[#071126]" : phase === "crashed" ? "bg-rose-500 text-white" : "bg-emerald-400 text-emerald-950")}>{phase === "syncing" ? "SYNCING" : phase === "betting" ? "WAITING" : phase === "flying" ? <LiveValue readMultiplier={readMultiplier} /> : `${multiplier.toFixed(2)}×`}</span>
      {(view.recent ?? board?.recent)?.map((round, index) => <span key={index} className={cn("shrink-0 rounded-full px-4 py-2 font-mono text-xs font-black", round.multiplier >= 10 ? "bg-[#bd3f24] text-white" : round.multiplier >= 2 ? "bg-[#2461d3] text-white" : "bg-[#202a3f] text-white/85")}>{round.multiplier.toFixed(2)}×</span>)}
    </div>

    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3 px-3 pt-4 md:px-0">
      <section className="app-panel rounded-[28px] p-3">
        <div className="flex items-center justify-between px-1 pb-3">
          <div>
            <p className="font-display text-sm font-black text-white">Your stake</p>
            <p className="text-[10px] font-bold text-white/35">Stars and gifts fly in the same round</p>
          </div>
          <div className="flex rounded-full bg-black/25 p-1">
            <button onClick={() => chooseStakeKind("stars")} disabled={Boolean(wager)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black transition", stakeKind === "stars" ? "bg-[#2f70ff] text-white shadow-lg" : "text-white/45")}><Coin className="h-4 w-4" />Stars</button>
            <button onClick={() => chooseStakeKind("gift")} disabled={Boolean(wager)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black transition", stakeKind === "gift" ? "bg-[#8b4cff] text-white shadow-lg" : "text-white/45")}><Gift className="h-4 w-4" />Gift</button>
          </div>
        </div>

        {stakeKind === "stars" ? <div className="grid gap-2 md:grid-cols-[1fr_1.3fr]">
          <div className="grid grid-cols-3 gap-2">{[100, 500, 2500].map((amount) => <button key={amount} onClick={() => setBet(Math.min(amount, Math.floor(balance)))} disabled={Boolean(wager)} className={cn("flex items-center justify-center gap-1 rounded-xl bg-white/[.07] py-3 font-mono text-xs font-black text-white/60 ring-1 ring-white/[.05]", bet === amount && "bg-[#243f78] text-white ring-[#6e96ff]/45")}><Coin className="h-3.5 w-3.5" />{amount.toLocaleString()}</button>)}</div>
          <div className="flex items-center gap-2 rounded-xl bg-black/25 px-4 ring-1 ring-white/[.06]"><Coin className="h-5 w-5" /><input aria-label="Stars bet" type="number" inputMode="numeric" value={bet || ""} disabled={Boolean(wager)} onChange={(event) => setBet(Math.max(0, Math.min(Math.floor(balance), Number(event.target.value))))} className="min-w-0 flex-1 bg-transparent py-3 font-mono text-lg font-black outline-none" /><button onClick={() => setBet(Math.floor(balance))} className="text-[10px] font-black uppercase text-[#6e96ff]">max</button></div>
        </div> : <GiftStakeShelf gifts={giftData?.gifts ?? []} selected={selectedGifts} disabled={Boolean(wager)} onSelect={(gift) => setSelectedGifts((current) => current.some((item) => item.id === gift.id) ? current.filter((item) => item.id !== gift.id) : [...current, gift])} />}

        {error && <p className="px-2 pt-3 text-center text-xs font-bold text-rose-300">{error}</p>}

        {canCashout ? <button onClick={cashout} disabled={Boolean(requestState)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4 font-display text-lg font-black text-emerald-950 active:scale-[.98] disabled:opacity-60">
          {requestState === "cashout" ? "Confirming…" : wager?.kind === "gift" ? <><Gift className="h-5 w-5" />Cash out gift · <LiveValue readMultiplier={readMultiplier} /></> : <><Coin className="h-5 w-5" />Cash out · <LiveValue readMultiplier={readMultiplier} amount={stakeValue} /></>}
        </button> : <button onClick={placeWager} disabled={!canBet || (stakeKind === "gift" && !selectedGifts.length)} className="app-cta mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-black transition disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
          {requestState ? "Confirming…" : phase === "syncing" ? "RECONNECTING…" : wager ? <><Sparkles className="h-5 w-5" />BET ACCEPTED</> : phase === "betting" ? stakeKind === "gift" ? <><Gift className="h-5 w-5" />PLACE {selectedGifts.length || ""} GIFT{selectedGifts.length === 1 ? "" : "S"}</> : <><Coin className="h-5 w-5" />PLACE {fmt(bet)}</> : "NEXT ROUND"}
        </button>}
      </section>

      <section className="app-panel overflow-hidden rounded-[28px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[.12em] text-white/35"><span>Players</span><span>Stake</span><span className="w-20 text-right">Result</span></div>
        <div className="max-h-52 min-h-[112px] overflow-y-auto pb-2">
          {board?.roundId === view.roundId && board.players.length ? board.players.map((player, index) => <div key={`${player.name}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              {player.mode === "gift" && player.giftImage ? <i className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b to-transparent ring-1", rarityOf(player.giftRarity ?? "common").bg, rarityOf(player.giftRarity ?? "common").ring)}><img src={player.giftImage} alt="" className="h-8 w-8 object-contain" /></i> : <i className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3999e9] font-black not-italic text-white">{player.name.replace("@", "").charAt(0).toUpperCase()}</i>}
              <span className="min-w-0"><b className="block truncate text-sm">{player.name}</b>{player.giftName && <small className="block truncate text-[9px] font-bold text-violet-300/75">{player.giftName}</small>}</span>
            </span>
            <span className="flex items-center gap-1 font-mono font-black text-amber-300"><Coin className="h-4 w-4" />{fmt(player.bet)}</span>
            <span className={cn("w-20 text-right font-mono font-black", player.status === "cashed" ? "text-emerald-300" : player.status === "bust" ? "text-rose-300" : "text-white/45")}>{player.status === "cashed" ? `+${fmt(player.result)}` : player.status === "bust" || phase === "crashed" ? "LOST" : phase === "flying" ? <LiveValue readMultiplier={readMultiplier} amount={player.bet} /> : phase === "syncing" ? "—" : fmt(player.bet)}</span>
          </div>) : <div className="flex min-h-[112px] items-center justify-center px-4 text-center text-xs text-white/40">No bets yet. Stars and gifts join this same shared flight.</div>}
        </div>
      </section>
    </div>
  </div>
}

const LiveValue = memo(function LiveValue({ readMultiplier, amount, className }: { readMultiplier: () => number; amount?: number; className?: string }) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    let previous = ""
    let lastPaint = -Infinity
    const draw = () => {
      const now = performance.now()
      // The main multiplier stays frame-smooth. Currency rows do not need 60
      // locale-formatting/layout updates per second for every player.
      if (amount !== undefined && now - lastPaint < 80) {
        frame = window.requestAnimationFrame(draw)
        return
      }
      lastPaint = now
      const value = readMultiplier()
      const text = amount === undefined ? `${value.toFixed(2)}×` : fmt(amount * value)
      if (valueRef.current && text !== previous) valueRef.current.textContent = text
      previous = text
      frame = window.requestAnimationFrame(draw)
    }
    draw()
    return () => window.cancelAnimationFrame(frame)
  }, [readMultiplier, amount])

  // React never owns this text node: parent refreshes cannot write an older
  // multiplier over the animation frame, which caused the visible stutter.
  return <span ref={valueRef} className={cn("tabular-nums", className)} />
})

type ClockView = {
  roundId: number | null
  phase: ReturnType<CrashClock["phase"]>
  multiplier: number
  countdown: number
  recent?: { multiplier: number }[]
}

function useCrashClock() {
  const [clock] = useState(() => new CrashClock())
  const [view, setView] = useState<ClockView>({ roundId: null, phase: "syncing", multiplier: 1, countdown: 0 })
  const syncRef = useRef<() => void>(() => undefined)
  const resync = useCallback(() => syncRef.current(), [])
  const publish = useCallback(() => {
    const now = performance.now()
    const sample = clock.sample
    const phase = clock.phase(now)
    const countdown = sample ? Math.max(0, Math.ceil(((phase === "betting" ? sample.flightStart : sample.nextRoundAt) - clock.serverNow(now)) / 1000)) : 0
    const next: ClockView = { roundId: sample?.roundId ?? null, phase, countdown, multiplier: phase === "crashed" ? sample?.multiplier ?? 1 : 1, recent: sample?.recent }
    setView((previous) => previous.roundId === next.roundId && previous.phase === next.phase && previous.multiplier === next.multiplier && previous.countdown === next.countdown ? previous : next)
  }, [clock])

  useEffect(() => {
    let disposed = false
    let inFlight = false
    let timer = 0
    let controller: AbortController | null = null
    const sync = async () => {
      if (disposed || inFlight) return
      window.clearTimeout(timer)
      inFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 2200)
      const sentAt = performance.now()
      try {
        const response = await fetch("/api/crash/clock", { cache: "no-store", signal: controller.signal })
        if (response.ok) {
          const sample = await response.json() as CrashClockSample
          if (!disposed) clock.accept(sample, sentAt, performance.now())
        }
      } catch {
        // The monotonic clock expires independently: lost requests visibly
        // reconnect instead of continuing an invented, ever-growing flight.
      } finally {
        window.clearTimeout(timeout)
        inFlight = false
        if (!disposed) {
          publish()
          const sample = clock.sample
          const untilBoundary = sample ? sample.nextRoundAt - clock.serverNow(performance.now()) : 0
          timer = window.setTimeout(() => void sync(), untilBoundary > 0 && untilBoundary < 1000 ? Math.max(60, untilBoundary + 30) : 1000)
        }
      }
    }
    syncRef.current = () => { void sync() }
    const onWake = () => { if (!document.hidden) { publish(); void sync() } }
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("online", onWake)
    const ticker = window.setInterval(publish, 100)
    void sync()
    return () => {
      disposed = true
      controller?.abort()
      window.clearTimeout(timer)
      window.clearInterval(ticker)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("online", onWake)
      syncRef.current = () => undefined
    }
  }, [clock, publish])

  useEffect(() => {
    const roundId = view.roundId
    if (roundId === null || clock.sample?.phase === "crashed") return
    let disposed = false
    let retry = 0
    let timer = 0
    let controller: AbortController | null = null
    const watch = async () => {
      if (disposed || clock.sample?.roundId !== roundId || clock.sample?.phase === "crashed") return
      controller = new AbortController()
      // A long-poll must not hang through another round if the transport drops.
      const remaining = (clock.sample?.nextRoundAt ?? clock.serverNow(performance.now())) - clock.serverNow(performance.now())
      const timeout = window.setTimeout(() => controller?.abort(), Math.max(1000, remaining + 1000))
      try {
        const response = await fetch(`/api/crash/watch?roundId=${roundId}`, { cache: "no-store", signal: controller.signal })
        if (disposed) return
        if (response.status === 409) { resync(); return }
        if (!response.ok || response.status === 204) throw new Error("WATCH_RETRY")
        const signal = await response.json() as { roundId: number; multiplier: number }
        if (clock.crash(signal.roundId, signal.multiplier)) { publish(); resync(); return }
      } catch {
        if (!disposed) resync()
      } finally {
        window.clearTimeout(timeout)
        if (!disposed && clock.sample?.roundId === roundId && !clock.isCrashed(roundId)) {
          timer = window.setTimeout(() => void watch(), Math.min(1500, 300 * 2 ** retry++))
        }
      }
    }
    void watch()
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timer) }
  }, [view.roundId, clock, publish, resync])

  return { clock, view, resync }
}

function GiftStakeShelf({ gifts, selected, disabled, onSelect }: { gifts: OwnedGift[]; selected: OwnedGift[]; disabled: boolean; onSelect: (gift: OwnedGift) => void }) {
  if (!gifts.length) return <div className="flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-dashed border-white/10 bg-black/15 px-4">
    <span><b className="block text-sm text-white/75">No gifts available</b><small className="text-[10px] font-bold text-white/35">Open a case or deposit a gift first</small></span>
    <a href="/deposit" className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black text-white">ADD GIFT</a>
  </div>

  return <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
    {gifts.map((gift) => {
      const rarity = rarityOf(gift.rarity)
      const active = selected.some((item) => item.id === gift.id)
      return <button
        key={gift.id}
        type="button"
        disabled={disabled}
        onClick={() => { onSelect(gift); haptic("light") }}
        className={cn("relative flex w-[112px] shrink-0 flex-col items-center rounded-2xl bg-gradient-to-b p-2.5 text-center ring-1 transition active:scale-[.97]", rarity.bg, active ? `${rarity.ring} ${rarity.glow} bg-white/[.09]` : "ring-white/[.06] opacity-75 hover:opacity-100")}
      >
        {active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />}
        <img src={gift.imageUrl} alt={gift.name} className="h-16 w-16 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.28)]" />
        <b className="mt-1 w-full truncate text-[10px] text-white">{gift.name}</b>
        <span className="mt-1 flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 font-mono text-[10px] font-black text-amber-200"><Coin className="h-3 w-3" />{fmt(gift.value)}</span>
      </button>
    })}
  </div>
}
