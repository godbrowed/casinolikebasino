"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import type { CrashBoard, OwnedGift } from "@/app/actions/crash"
import { multiplierAtElapsed } from "@/lib/crash-shared"
import { Coin } from "@/components/coin"
import { CrashRocket } from "@/components/crash-rocket"
import { useUser } from "@/components/user-provider"
import { fmt, rarityOf } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { playGameSound } from "@/lib/game-sound"
import { cashoutGiftCrashApi, fetchCrashBoard, fetchCrashGifts, settleGiftCrashApi, startGiftCrashApi } from "@/lib/client-game-api"

type LocalPhase = "select" | "queued" | "running" | "cashed" | "crashed"

export function GiftCrashGame() {
  const { refresh } = useUser()
  const { data: giftData, mutate: mutateGifts, isLoading } = useSWR<{ gifts: OwnedGift[]; rewardImages: string[] }>("crash-gifts", fetchCrashGifts)
  const { data: board, mutate: mutateBoard } = useSWR<CrashBoard>("shared-crash-board", fetchCrashBoard, { refreshInterval: 1000, revalidateOnFocus: true })
  const gifts = giftData?.gifts
  const rewardImages = giftData?.rewardImages
  const [selected, setSelected] = useState<OwnedGift | null>(null)
  const [localPhase, setLocalPhase] = useState<LocalPhase>("select")
  const [won, setWon] = useState<OwnedGift | null>(null)
  const [wonAt, setWonAt] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState(Date.now())
  const tokenRef = useRef<string | null>(null)
  const settling = useRef(false)

  const boardPhase = board?.phase === "crashed" ? "crashed" : board && clock >= board.flightStart ? "flying" : "betting"
  const multiplier = boardPhase === "flying" && board ? multiplierAtElapsed(clock - board.flightStart) : board?.multiplier ?? 1
  const countdown = boardPhase === "betting" ? Math.max(0, Math.ceil(((board?.flightStart ?? clock) - clock) / 1000)) : 0
  const hasWager = Boolean(tokenRef.current)
  const canJoin = boardPhase === "betting" && localPhase === "select" && Boolean(selected)

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 125)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (localPhase === "queued" && boardPhase === "flying") setLocalPhase("running")
  }, [boardPhase, localPhase])

  useEffect(() => {
    if (boardPhase !== "crashed" || !tokenRef.current || settling.current || localPhase === "cashed") return
    settling.current = true
    const token = tokenRef.current
    void settleGiftCrashApi(token).finally(() => {
      tokenRef.current = null
      settling.current = false
      setLocalPhase("crashed")
      setSelected(null)
      hapticNotify("error")
      playGameSound("crash")
      mutateGifts()
      mutateBoard()
      refresh()
    })
  }, [boardPhase, localPhase, mutateBoard, mutateGifts, refresh])

  async function handleStart() {
    if (!selected || !canJoin) return
    setError(null)
    setWon(null)
    haptic("medium")
    playGameSound("bet")
    try {
      const result = await startGiftCrashApi(selected.id)
      tokenRef.current = result.token
      setLocalPhase("queued")
      mutateBoard()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place gift"
      setError(message === "BETTING_CLOSED" ? "Wait for the next 5 second countdown." : message)
    }
  }

  async function handleCashout() {
    if (localPhase !== "running" || !tokenRef.current) return
    haptic("heavy")
    try {
      const result = await cashoutGiftCrashApi(tokenRef.current)
      tokenRef.current = null
      if (result.success && result.gift) {
        setWon(result.gift)
        setWonAt(result.multiplier)
        setLocalPhase("cashed")
        hapticNotify("success")
        playGameSound("cashout")
      } else {
        setLocalPhase("crashed")
        setSelected(null)
        hapticNotify("error")
        playGameSound("crash")
      }
      mutateGifts()
      mutateBoard()
      refresh()
    } catch {
      setError("Cashout failed")
    }
  }

  function reset() {
    setLocalPhase("select")
    setSelected(null)
    setWon(null)
    setError(null)
  }

  const lostThisRound = boardPhase === "crashed" && (localPhase === "queued" || localPhase === "running" || localPhase === "crashed")
  const stagePhase = lostThisRound ? "crashed" : localPhase === "running" ? "running" : localPhase === "cashed" ? "cashed" : "idle"
  const target = selected ? selected.value * multiplier : 0

  return <div className="flex min-h-[calc(100dvh-130px)] w-full flex-col bg-[#071126] pb-6">
    <CrashRocket phase={stagePhase} multiplier={multiplier} payloadImage={hasWager ? selected?.imageUrl : null} collectImages={rewardImages ?? []}>
      {localPhase === "cashed" && won ? <div className="flex flex-col items-center rounded-3xl bg-[#071126]/70 px-5 py-3 backdrop-blur-sm"><img src={won.imageUrl || "/images/nft-gift.png"} alt={won.name} className="h-16 w-16 object-contain" /><b className={cn("mt-1 text-sm", rarityOf(won.rarity).text)}>{won.name}</b><span className="text-[10px] font-bold text-emerald-300">collected at {wonAt.toFixed(2)}× · flight {multiplier.toFixed(2)}×</span></div> : boardPhase === "betting" ? <><div className="font-display text-[82px] font-black leading-none text-white">{countdown || 1}</div><div className="mt-2 text-[10px] font-black uppercase tracking-[.25em] text-white/45">gift launch</div></> : localPhase === "running" ? <><div className="font-display text-5xl font-black text-white md:text-7xl">{multiplier.toFixed(2)}×</div><div className="mt-1 flex items-center gap-1 text-xs font-bold text-white/45">possible value {fmt(target)} <Coin className="h-3 w-3" /></div></> : lostThisRound ? <div className="rounded-full bg-[#071126]/75 px-4 py-2 font-display text-xl font-black text-rose-300">GIFT LOST · {multiplier.toFixed(2)}×</div> : <div className="font-display text-xl font-black text-white/55">ROUND IN FLIGHT</div>}
    </CrashRocket>

    <div className="no-scrollbar flex gap-2 overflow-x-auto border-y border-white/[.06] bg-[#0a152a] px-3 py-3">{board?.recent.map((round, index) => <span key={index} className={cn("shrink-0 rounded-full px-4 py-2 font-mono text-xs font-black", round.multiplier >= 10 ? "bg-[#bd3f24]" : round.multiplier >= 2 ? "bg-[#2461d3]" : "bg-[#202a3f]")}>{round.multiplier.toFixed(2)}×</span>)}</div>

    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-4 md:px-0">
      {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
      {localPhase === "running" ? <button onClick={handleCashout} className="w-full rounded-2xl bg-emerald-400 py-4 font-display text-lg font-black text-emerald-950">Cash out gift · {multiplier.toFixed(2)}×</button> : localPhase === "queued" ? <button disabled className="w-full rounded-2xl bg-white/10 py-4 font-display text-lg font-black text-white/40">GIFT ACCEPTED · LAUNCH IN {countdown}s</button> : localPhase === "cashed" || localPhase === "crashed" ? <button onClick={reset} className="w-full rounded-2xl bg-[#2f70ff] py-4 font-display text-lg font-black">PLAY AGAIN</button> : <button onClick={handleStart} disabled={!canJoin} className="w-full rounded-2xl bg-[#2f70ff] py-4 font-display text-lg font-black disabled:bg-white/10 disabled:text-white/35">{boardPhase === "betting" ? selected ? "PLACE GIFT" : "SELECT A GIFT" : "NEXT ROUND"}</button>}

      {localPhase === "select" && <section className="rounded-[28px] bg-[#202a3f] p-3 ring-1 ring-white/[.07]"><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-black">Your gifts</h2><span className="text-[10px] text-white/40">{gifts?.length ?? 0} owned</span></div>{isLoading ? <p className="py-6 text-center text-xs text-white/40">Loading…</p> : !gifts?.length ? <p className="py-6 text-center text-xs text-white/40">Open a case to get a gift first.</p> : <div className="no-scrollbar flex gap-2 overflow-x-auto">{gifts.map((gift) => { const rarity = rarityOf(gift.rarity); return <button key={gift.id} onClick={() => { haptic("light"); setSelected(gift) }} className={cn("flex w-24 shrink-0 flex-col items-center rounded-2xl bg-[#171e30] p-2 ring-1", selected?.id === gift.id ? "ring-2 ring-[#6f96ff]" : rarity.ring)}><img src={gift.imageUrl || "/images/nft-gift.png"} alt={gift.name} className="h-14 w-14 object-contain" /><span className={cn("mt-1 w-full truncate text-[10px] font-bold", rarity.text)}>{gift.name}</span><span className="mt-0.5 flex items-center gap-1 text-[9px] text-white/45"><Coin className="h-2.5 w-2.5" />{fmt(gift.value)}</span></button> })}</div>}</section>}
    </div>
  </div>
}
