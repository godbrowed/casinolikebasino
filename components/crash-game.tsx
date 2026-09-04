"use client"

import { useEffect, useRef, useState } from "react"
import { Gift, Sparkles } from "lucide-react"
import useSWR from "swr"
import type { CrashBoard, OwnedGift } from "@/app/actions/crash"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { CRASH_BETTING_MS, CRASH_ROUND_MS, multiplierAtElapsed } from "@/lib/crash-shared"
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
  | { kind: "stars"; token: string; amount: number }
  | { kind: "gift"; token: string; gifts: OwnedGift[]; stakeValue: number }
type Outcome =
  | { kind: "stars"; payout: number; at: number }
  | { kind: "gift"; gift: OwnedGift; at: number }
type CrashSignal = { roundId: number; multiplier: number }

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
  const [crashSignal, setCrashSignal] = useState<CrashSignal | null>(null)
  const [clock, setClock] = useState(Date.now())
  const settling = useRef(false)
  const crashSoundedRound = useRef<number | null>(null)
  const balance = me?.balance ?? 0
  const signalledCrash = Boolean(board && crashSignal?.roundId === board.roundId)
  const phase = board?.phase === "crashed" || signalledCrash ? "crashed" : board && clock >= board.flightStart ? "flying" : "betting"
  const multiplier = !board
    ? 1
    : phase === "crashed"
      ? crashSignal?.roundId === board.roundId ? crashSignal.multiplier : board.multiplier
      : phase === "flying"
        ? multiplierAtElapsed(clock - board.flightStart)
        : 1
  const countdown = phase === "betting" ? Math.max(0, Math.ceil(((board?.flightStart ?? clock) - clock) / 1000)) : 0
  const nextRoundCountdown = board ? Math.max(1, Math.ceil((board.flightStart + (CRASH_ROUND_MS - CRASH_BETTING_MS) - clock) / 1000)) : 1
  const canBet = phase === "betting" && !wager
  const canCashout = phase === "flying" && Boolean(wager)
  const stakeValue = wager?.kind === "gift" ? wager.stakeValue : wager?.kind === "stars" ? wager.amount : stakeKind === "gift" ? selectedGifts.reduce((sum, gift) => sum + gift.value, 0) : bet

  useEffect(() => {
    let timer = 0
    const tick = () => {
      setClock(Date.now())
      timer = window.setTimeout(tick, 250)
    }
    timer = window.setTimeout(tick, 250)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (!board) return
    if (board.phase === "crashed") {
      setCrashSignal({ roundId: board.roundId, multiplier: board.multiplier })
      return
    }

    setCrashSignal((current) => current?.roundId === board.roundId ? current : null)
    const controller = new AbortController()
    void fetch(`/api/crash/watch?roundId=${board.roundId}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return
      const payload = await response.json() as CrashSignal
      if (payload.roundId === board.roundId && Number.isFinite(payload.multiplier)) setCrashSignal(payload)
    }).catch(() => undefined)
    return () => controller.abort()
  }, [board?.roundId])

  useEffect(() => {
    if (!board) return
    const nextRoundAt = board.flightStart + (CRASH_ROUND_MS - CRASH_BETTING_MS)
    const timer = window.setTimeout(() => void mutate(), Math.max(50, nextRoundAt - Date.now() + 80))
    return () => window.clearTimeout(timer)
  }, [board?.flightStart, mutate])

  useEffect(() => {
    if (phase !== "crashed" || !wager || settling.current) return
    settling.current = true
    const request = wager.kind === "gift" ? settleGiftCrashApi(wager.token) : settleCrashApi(wager.token)
    void request.finally(() => {
      setWager(null)
      setSelectedGifts([])
      settling.current = false
      refresh()
      mutate()
      mutateGifts()
      hapticNotify("error")
    })
  }, [mutate, mutateGifts, phase, refresh, wager])

  useEffect(() => {
    if (phase === "crashed" && board && crashSoundedRound.current !== board.roundId) {
      crashSoundedRound.current = board.roundId
      playGameSound("crash")
    }
  }, [board, phase])

  async function placeWager() {
    if (!canBet) return
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
    haptic("medium")
    playGameSound("bet")
    try {
      if (stakeKind === "gift" && selectedGifts.length) {
        const result = await startGiftCrashApi(selectedGifts.map((gift) => gift.id))
        setWager({ kind: "gift", token: result.token, gifts: selectedGifts, stakeValue: result.stakeValue })
        await mutateGifts()
      } else {
        const result = await startCrashApi(bet)
        setWager({ kind: "stars", token: result.token, amount: bet })
        setBalance(result.balance)
      }
      await mutate()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place the bet"
      setError(message === "BETTING_CLOSED" ? "Betting closed — wait for the next countdown." : message)
      mutate()
      mutateGifts()
    }
  }

  async function cashout() {
    if (!wager || !canCashout) return
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
        await mutateGifts()
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
      setError("Cashout failed. Try again in the next round.")
    }
  }

  function chooseStakeKind(kind: StakeKind) {
    if (wager) return
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
      flightStart={board?.flightStart ?? null}
    >
      {phase === "betting" ? <>
        <div className="font-display text-[82px] font-black leading-none tabular-nums text-white md:text-[104px]">{countdown || 1}</div>
        <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-white/45"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6e96ff]" />bets open</div>
      </> : phase === "crashed" ? <>
        <div className="rounded-full bg-[#071126]/75 px-4 py-2 font-display text-xl font-black text-rose-300 backdrop-blur-sm">CRASHED · {multiplier.toFixed(2)}×</div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-[.18em] text-white/38">next flight in {nextRoundCountdown}s</div>
      </> : <>
        <LiveFlightReadout flightStart={board?.flightStart ?? null} fallback={multiplier} />
        <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />live flight</div>
      </>}
      {outcome?.kind === "stars" && <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950"><Coin className="h-4 w-4" />CASHED {outcome.at.toFixed(2)}× · +{fmt(outcome.payout)}</div>}
      {outcome?.kind === "gift" && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/95 p-2 pr-4 text-left text-[#071126] shadow-xl">
        <img src={outcome.gift.imageUrl} alt="" className="h-10 w-10 object-contain" />
        <span><b className="block text-xs">{outcome.gift.name}</b><small className="flex items-center gap-1 text-[10px] font-bold text-[#526078]"><Coin className="h-3 w-3" />{fmt(outcome.gift.value)} · {outcome.at.toFixed(2)}×</small></span>
      </div>}
    </CrashRocket>

    <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto border-y border-white/[.055] bg-[#101726]/92 px-3 py-3 backdrop-blur-xl">
      <span className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-black", phase === "betting" ? "bg-white text-[#071126]" : phase === "crashed" ? "bg-rose-500 text-white" : "bg-emerald-400 text-emerald-950")}>{phase === "betting" ? "WAITING" : `${multiplier.toFixed(2)}×`}</span>
      {board?.recent.map((round, index) => <span key={index} className={cn("shrink-0 rounded-full px-4 py-2 font-mono text-xs font-black", round.multiplier >= 10 ? "bg-[#bd3f24] text-white" : round.multiplier >= 2 ? "bg-[#2461d3] text-white" : "bg-[#202a3f] text-white/85")}>{round.multiplier.toFixed(2)}×</span>)}
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

        {canCashout ? <button onClick={cashout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4 font-display text-lg font-black text-emerald-950 shadow-[0_12px_30px_rgba(52,211,153,.25)] active:scale-[.98]">
          {wager?.kind === "gift" ? <><Gift className="h-5 w-5" />Cash out gift · {multiplier.toFixed(2)}×</> : <><Coin className="h-5 w-5" />Cash out · {fmt(stakeValue * multiplier)}</>}
        </button> : <button onClick={placeWager} disabled={!canBet || (stakeKind === "gift" && !selectedGifts.length)} className="app-cta mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-black transition disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
          {wager ? <><Sparkles className="h-5 w-5" />BET ACCEPTED</> : phase === "betting" ? stakeKind === "gift" ? <><Gift className="h-5 w-5" />PLACE {selectedGifts.length || ""} GIFT{selectedGifts.length === 1 ? "" : "S"}</> : <><Coin className="h-5 w-5" />PLACE {fmt(bet)}</> : "NEXT ROUND"}
        </button>}
      </section>

      <section className="app-panel overflow-hidden rounded-[28px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[.12em] text-white/35"><span>Players</span><span>Stake</span><span className="w-20 text-right">Result</span></div>
        <div className="max-h-52 min-h-[112px] overflow-y-auto pb-2">
          {board?.players.length ? board.players.map((player, index) => <div key={`${player.name}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              {player.mode === "gift" && player.giftImage ? <i className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b to-transparent ring-1", rarityOf(player.giftRarity ?? "common").bg, rarityOf(player.giftRarity ?? "common").ring)}><img src={player.giftImage} alt="" className="h-8 w-8 object-contain" /></i> : <i className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3999e9] font-black not-italic text-white">{player.name.replace("@", "").charAt(0).toUpperCase()}</i>}
              <span className="min-w-0"><b className="block truncate text-sm">{player.name}</b>{player.giftName && <small className="block truncate text-[9px] font-bold text-violet-300/75">{player.giftName}</small>}</span>
            </span>
            <span className="flex items-center gap-1 font-mono font-black text-amber-300"><Coin className="h-4 w-4" />{fmt(player.bet)}</span>
            <span className={cn("w-20 text-right font-mono font-black", player.status === "cashed" ? "text-emerald-300" : player.status === "bust" ? "text-rose-300" : "text-white/45")}>{player.status === "cashed" ? `+${fmt(player.result)}` : player.status === "bust" ? "LOST" : `${fmt(player.bet * multiplier)}`}</span>
          </div>) : <div className="flex min-h-[112px] items-center justify-center px-4 text-center text-xs text-white/40">No bets yet. Stars and gifts join this same shared flight.</div>}
        </div>
      </section>
    </div>
  </div>
}

function LiveFlightReadout({ flightStart, fallback }: { flightStart: number | null; fallback: number }) {
  const valueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!flightStart) return
    let frame = 0
    const draw = () => {
      if (valueRef.current) valueRef.current.textContent = `${multiplierAtElapsed(Date.now() - flightStart).toFixed(2)}×`
      frame = window.requestAnimationFrame(draw)
    }
    draw()
    return () => window.cancelAnimationFrame(frame)
  }, [flightStart])

  return <div ref={valueRef} className="font-display text-5xl font-black tabular-nums text-white md:text-7xl">{fallback.toFixed(2)}×</div>
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
