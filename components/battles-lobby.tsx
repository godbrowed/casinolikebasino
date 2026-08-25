"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft, Clock3, Loader2, Plus, ShieldCheck, Users, X } from "lucide-react"
import type { BattleResult, BattleSession, MatchState } from "@/app/actions/battles"
import { BattleArena } from "@/components/battle-arena"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { fetchBattleSessions, fetchMatchState, joinBattleApi, leaveBattleApi } from "@/lib/client-game-api"

type Phase = "lobby" | "session" | "arena"
export function BattlesLobby() {
  const { me, refresh } = useUser()
  const { data: sessions, mutate: refreshSessions } = useSWR<BattleSession[]>("pvp-sessions", fetchBattleSessions, { refreshInterval: 2500 })
  const [bet, setBet] = useState(100)
  const [phase, setPhase] = useState<Phase>("lobby")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<number | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  const canAfford = (me?.balance ?? 0) >= bet

  const stopPolling = useCallback(() => { if (poll.current) clearInterval(poll.current); poll.current = null }, [])
  const tick = useCallback(async (id: number) => {
    try {
      const state = await fetchMatchState(id)
      setMatch(state)
      if (state.status === "done" && state.result) {
        stopPolling(); setResult(state.result); setPhase("arena"); refresh(); void refreshSessions()
      }
    } catch { /* a short network miss is retried on the next shared tick */ }
  }, [refresh, refreshSessions, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function enterSession(amount: number, targetRoomId?: number) {
    if (busy || (me?.balance ?? 0) < amount) return setError("Not enough Stars for this stake.")
    setBusy(true); setError(null); haptic("medium")
    try {
      const { roomId: id } = await joinBattleApi(amount, targetRoomId)
      setBet(amount); setRoomId(id); setPhase("session"); refresh(); await tick(id)
      poll.current = setInterval(() => void tick(id), 1000)
      void refreshSessions()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not join PvP"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars for this stake." : message === "INVALID_BET" ? "Choose a valid stake." : message === "SESSION_CLOSED" ? "This session has already started. Choose another one." : message)
    } finally { setBusy(false) }
  }

  async function cancelQueue() {
    if (match?.status !== "waiting") return
    stopPolling(); const id = roomId; setPhase("lobby"); setMatch(null); setRoomId(null)
    if (id != null) await leaveBattleApi(id).catch(() => undefined)
    refresh(); void refreshSessions()
  }

  function reset() { stopPolling(); setRoomId(null); setMatch(null); setResult(null); setPhase("lobby"); refresh(); void refreshSessions() }

  if (phase === "arena" && result) return <BattleArena result={result} onDone={reset} />
  if (phase === "session") return <SessionRoom match={match} bet={bet} onCancel={cancelQueue} />

  return <div className="mx-auto flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-84px)] w-full max-w-[720px] flex-col gap-4 pb-5">
    <div className="flex items-center justify-between px-1">
      <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101217] text-white/70 ring-1 ring-white/[.06]"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="text-center"><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#6f91ff]">Real players · shared session</div><h1 className="font-display text-xl font-black">PugGift PvP</h1></div>
      <div className="h-11 w-11" />
    </div>

    <LobbyWheel session={sessions?.[0] ?? null} />

    <section className="rounded-[28px] bg-[#2b2e34] p-3 ring-1 ring-white/10">
      <div className="mb-3 px-1"><div className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">Your stake</div><div className="text-xs text-white/55">Enter any amount from 10 to 100,000</div></div>
      <div className="flex items-center gap-3 rounded-[20px] bg-[#17191e] px-4 py-3 ring-1 ring-white/[.07]"><Coin className="h-6 w-6" /><input aria-label="PvP stake" type="number" inputMode="numeric" min={10} max={100000} value={bet || ""} onChange={(event) => setBet(Math.max(0, Math.min(100000, Math.floor(Number(event.target.value)))))} className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-black outline-none" /><button onClick={() => setBet(Math.floor(me?.balance ?? 0))} className="rounded-xl bg-white/[.07] px-3 py-2 text-[10px] font-black uppercase text-[#7e9eff]">max</button></div>
      <div className="mt-2 grid grid-cols-3 gap-2">{[50, 250, 1000].map((amount) => <button key={amount} onClick={() => { haptic("light"); setBet(Math.min(100000, bet + amount)) }} className="rounded-xl bg-[#41454e] py-2.5 text-xs font-black text-white/60">+{fmt(amount)}</button>)}</div>
      <button onClick={() => enterSession(bet)} disabled={busy || !canAfford || bet < 10} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f70ff] py-4 font-display text-base font-black text-white shadow-[0_7px_22px_rgba(47,112,255,.3)] disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" />Place stake</>}</button>
    </section>

    <section className="overflow-hidden rounded-[28px] bg-[#2b2e34] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="flex items-center gap-2 font-display text-sm font-black"><Users className="h-4 w-4 text-[#6e8cff]" />Live sessions</div><span className="text-[10px] font-bold text-white/40">updates automatically</span></div>
      <div className="divide-y divide-white/[.06]">{sessions?.length ? sessions.map((session) => <div key={session.roomId} className="flex items-center gap-3 px-3 py-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[4px] border-[#171a20] shadow-md" style={{ background: session.players === 1 ? "#2f70ff" : "conic-gradient(#2f70ff 0deg 180deg,#ffad32 180deg 360deg)" }}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#11141a] text-[9px] font-black">{session.players}/2</span></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1 font-black"><Coin className="h-4 w-4 text-[15px]" />{fmt(session.bet)} <span className="text-[10px] font-medium text-white/35">each</span></div><div className="mt-0.5 truncate text-[10px] text-white/45">{session.status === "waiting" ? "Waiting for the second stake" : `${session.secondsLeft}s · ${session.players}/${session.capacity} joined`}</div></div>
        <button onClick={() => enterSession(session.bet, session.roomId)} disabled={busy || session.players >= session.capacity || (me?.balance ?? 0) < session.bet} className="rounded-xl bg-[#2f70ff] px-3 py-2 text-xs font-black disabled:opacity-35">Join</button>
      </div>) : <div className="px-4 py-7 text-center text-xs text-white/40">No public session yet — your stake will create the first one.</div>}</div>
    </section>

    <div className="flex items-center justify-center gap-2 text-[10px] text-white/40"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />No bots · equal stake · synchronized result</div>
    {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
  </div>
}

function LobbyWheel({ session }: { session: BattleSession | null }) {
  const hasStake = Boolean(session)
  const players = session?.players ?? 0
  const wheel = !hasStake
    ? "repeating-conic-gradient(#4b4b4b 0deg 36deg,#666 36deg 72deg)"
    : players === 1
      ? "#2f70ff"
      : "conic-gradient(#2f70ff 0deg 180deg,#ff9f38 180deg 360deg)"
  const bank = session ? session.bet * session.players : 0
  return <section className="flex flex-col items-center rounded-[32px] bg-[#0b0c0f] px-3 pb-5 pt-4 ring-1 ring-white/[.055]">
    <div className="relative aspect-square w-full max-w-[420px]">
      <i className="absolute left-1/2 top-[-7px] z-20 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-white" />
      <div className="absolute inset-[5%] rounded-full border-[9px] border-[#1e2025] shadow-[0_22px_55px_rgba(0,0,0,.58),inset_0_0_24px_rgba(0,0,0,.4)]" style={{ background: wheel }} />
      {(session?.names ?? []).map((name, index) => <div key={`${name}-${index}`} className="absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[linear-gradient(145deg,#88a5ff,#2f70ff)] font-black shadow-xl" style={{ left: players === 1 ? "34%" : index === 0 ? "31%" : "69%", top: players === 1 ? "42%" : "50%" }}>{session?.photos?.[index] ? <img src={session.photos[index] ?? undefined} alt="" className="h-full w-full object-cover" /> : name.slice(0,1).toUpperCase()}</div>)}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-[31%] w-[31%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#0b0c0f] text-center ring-[7px] ring-[#1e2025]"><span className="font-display text-lg font-black md:text-2xl">{session?.status === "countdown" ? session.secondsLeft : "WAITING"}</span><span className="mt-1 text-[8px] font-black uppercase tracking-[.14em] text-white/30">{session?.status === "countdown" ? "seconds" : hasStake ? "player two" : "first stake"}</span></div>
    </div>
    <div className="-mt-1 flex items-center gap-2 rounded-full bg-[#35373c] px-4 py-2 text-sm font-black"><span className="text-white/45">Bank</span><Coin className="h-4 w-4" />{fmt(bank)}</div>
    <div className="mt-3 text-center"><h2 className="font-display text-lg font-black">{hasStake ? "A public room is waiting" : "Nobody is playing yet"}</h2><p className="mt-1 text-xs text-white/40">{hasStake ? "Join the exact stake below, or create a room with your own amount." : "Choose any stake. The wheel stays idle until another real player joins."}</p></div>
  </section>
}

function SessionRoom({ match, bet, onCancel }: { match: MatchState | null; bet: number; onCancel: () => void }) {
  const slots = match?.slots ?? []
  const waiting = !match || match.status === "waiting"
  const seconds = match?.secondsLeft ?? 30
  const wheel = slots.length === 0 ? "#242934" : slots.length === 1 ? "#2f70ff" : "conic-gradient(#2f70ff 0deg 180deg,#ffad32 180deg 360deg)"
  return <div className="relative flex min-h-[calc(100dvh-170px)] flex-col items-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_25%,#172b52,#09111f_58%,#06090f)] px-4 py-7 text-center ring-1 ring-white/10">
    <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:38px_38px]" />
    <div className="relative text-[9px] font-black uppercase tracking-[.2em] text-blue-300">Live PvP room · real players only</div>
    <div className="relative mt-7 h-64 w-64">
      <i className="absolute left-1/2 top-[-9px] z-20 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-white drop-shadow-[0_4px_5px_rgba(0,0,0,.5)]" />
      <div className="absolute inset-0 rounded-full border-[9px] border-[#252b36] shadow-[0_22px_55px_rgba(0,0,0,.55),inset_0_0_28px_rgba(0,0,0,.35)]" style={{ background: wheel }} />
      {slots.map((slot, index) => <div key={slot.slot} className="absolute z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#171c26] text-sm font-black shadow-[0_8px_18px_rgba(0,0,0,.4)]" style={{ left: slots.length === 1 ? "50%" : index === 0 ? "22%" : "78%", top: slots.length === 1 ? "28%" : "50%" }}>{slot.photoUrl ? <img src={slot.photoUrl} alt="" className="h-full w-full object-cover" /> : slot.name.slice(0,1).toUpperCase()}</div>)}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#070a10] ring-[6px] ring-[#222733]"><div className="font-display text-5xl font-black tabular-nums">{waiting ? slots.length : seconds}</div><div className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-white/45">{waiting ? "of 2 joined" : "seconds"}</div></div>
    </div>
    <div className="relative mt-6"><h1 className="font-display text-2xl font-black">{waiting ? "Waiting for player two" : "Wheel locked"}</h1><p className="mx-auto mt-1 max-w-[330px] text-xs leading-relaxed text-white/50">{waiting ? "Your color owns the full wheel. A second real stake will split it and start the countdown." : "Two equal halves, two real profiles, one synchronized winner."}</p></div>
    <div className="relative mt-5 grid w-full max-w-sm grid-cols-2 gap-2">{Array.from({ length: 2 }).map((_, index) => { const slot = slots[index]; return <div key={index} className={cn("flex items-center gap-2 rounded-2xl border p-2.5 text-left", slot ? index === 0 ? "border-blue-300/35 bg-blue-400/12" : "border-amber-300/35 bg-amber-400/12" : "border-dashed border-white/10 bg-white/[.03]")}><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-black">{slot?.photoUrl ? <img src={slot.photoUrl} alt="" className="h-full w-full object-cover" /> : slot ? slot.name.slice(0,1).toUpperCase() : "?"}</div><div className="min-w-0"><div className="truncate text-xs font-black">{slot?.isYou ? "You" : slot?.name ?? "Open seat"}</div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/45"><Coin className="h-3 w-3" />{slot ? fmt(bet) : "waiting"}</div></div></div> })}</div>
    {waiting ? <button onClick={onCancel} className="relative mt-auto flex items-center gap-2 rounded-2xl bg-white/8 px-5 py-3 text-sm font-bold text-white/65"><X className="h-4 w-4" />Cancel and refund</button> : <div className="relative mt-auto flex items-center gap-2 text-xs font-bold text-emerald-300"><Clock3 className="h-4 w-4" />Stake locked · shared countdown active</div>}
  </div>
}
