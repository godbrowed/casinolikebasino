"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Clock3, Loader2, Plus, ShieldCheck, Swords, Users, X } from "lucide-react"
import { getBattleSessions, getMatchState, joinBattle, leaveBattle, type BattleResult, type BattleSession, type MatchState } from "@/app/actions/battles"
import { BattleArena } from "@/components/battle-arena"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Phase = "lobby" | "session" | "arena"
const BETS = [50, 100, 250, 500, 1000, 2500]

export function BattlesLobby() {
  const { me, refresh } = useUser()
  const { data: sessions, mutate: refreshSessions } = useSWR<BattleSession[]>("pvp-sessions", getBattleSessions, { refreshInterval: 2000 })
  const [bet, setBet] = useState(250)
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
      const state = await getMatchState(id)
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
      const { roomId: id } = await joinBattle({ bet: amount, roomId: targetRoomId })
      setBet(amount); setRoomId(id); setPhase("session"); refresh(); await tick(id)
      poll.current = setInterval(() => void tick(id), 800)
      void refreshSessions()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not join PvP"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars for this stake." : message === "INVALID_BET" ? "Choose a valid stake." : message === "SESSION_CLOSED" ? "This session has already started. Choose another one." : message)
    } finally { setBusy(false) }
  }

  async function cancelQueue() {
    if (match?.status !== "waiting") return
    stopPolling(); const id = roomId; setPhase("lobby"); setMatch(null); setRoomId(null)
    if (id != null) await leaveBattle(id).catch(() => undefined)
    refresh(); void refreshSessions()
  }

  function reset() { stopPolling(); setRoomId(null); setMatch(null); setResult(null); setPhase("lobby"); refresh(); void refreshSessions() }

  if (phase === "arena" && result) return <BattleArena result={result} onDone={reset} />
  if (phase === "session") return <SessionRoom match={match} bet={bet} onCancel={cancelQueue} />

  return <div className="flex flex-col gap-4">
    <section className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#371349,#8d176a_55%,#db358a)] p-5 shadow-[0_18px_46px_-24px_rgba(219,53,138,.8)] ring-1 ring-white/10">
      <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-pink-200/15 blur-3xl" />
      <div className="relative flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fa3f98] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_28px_rgba(0,0,0,.28)]"><Swords className="h-9 w-9" /></span><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-pink-100/65">Shared live sessions</div><h1 className="font-display text-3xl font-black">Stars PvP</h1><p className="mt-1 text-xs text-white/65">Second stake starts one 30-second clock for everyone.</p></div></div>
    </section>

    <section className="rounded-[28px] bg-[#30333a] p-4 ring-1 ring-white/10">
      <div className="mb-3 flex items-end justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-white/45">Create your stake</div><div className="mt-1 flex items-center gap-1 font-display text-3xl font-black"><Coin className="h-8 w-8 text-[28px]" glow />{fmt(bet)}</div></div><div className="text-right text-[10px] text-white/45">2–4 players<br/><b className="text-emerald-300">90% bank payout</b></div></div>
      <div className="grid grid-cols-3 gap-2">{BETS.map((amount) => <button key={amount} onClick={() => { haptic("light"); setBet(amount) }} className={cn("rounded-2xl py-3 text-xs font-black transition", bet === amount ? "bg-[#2f70ff] text-white shadow-[0_4px_0_#1744b9]" : "bg-[#41454e] text-white/65 hover:bg-[#4a4f59]")}>{fmt(amount)}</button>)}</div>
      <button onClick={() => enterSession(bet)} disabled={busy || !canAfford} className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display font-black disabled:opacity-40">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" />Create or join session</>}</button>
    </section>

    <section className="overflow-hidden rounded-[28px] bg-[#2b2e34] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="flex items-center gap-2 font-display text-sm font-black"><Users className="h-4 w-4 text-[#6e8cff]" />Live sessions</div><span className="text-[10px] font-bold text-white/40">updates automatically</span></div>
      <div className="divide-y divide-white/[.06]">{sessions?.length ? sessions.map((session) => <div key={session.roomId} className="flex items-center gap-3 px-3 py-3">
        <div className="flex -space-x-2">{Array.from({ length: Math.max(2, session.players) }).slice(0, 3).map((_, index) => <span key={index} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2b2e34] bg-[#414650] text-[10px] font-black">{session.names[index]?.slice(0, 1).toUpperCase() ?? "?"}</span>)}</div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1 font-black"><Coin className="h-4 w-4 text-[15px]" />{fmt(session.bet)} <span className="text-[10px] font-medium text-white/35">each</span></div><div className="mt-0.5 truncate text-[10px] text-white/45">{session.status === "waiting" ? "Waiting for the second stake" : `${session.secondsLeft}s · ${session.players}/${session.capacity} joined`}</div></div>
        <button onClick={() => enterSession(session.bet, session.roomId)} disabled={busy || session.players >= session.capacity || (me?.balance ?? 0) < session.bet} className="rounded-xl bg-[#2f70ff] px-3 py-2 text-xs font-black disabled:opacity-35">Join</button>
      </div>) : <div className="px-4 py-7 text-center text-xs text-white/40">No public session yet — your stake will create the first one.</div>}</div>
    </section>

    <div className="flex items-center justify-center gap-2 text-[10px] text-white/40"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Equal stake, shared timer, one synchronized result</div>
    {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
  </div>
}

function SessionRoom({ match, bet, onCancel }: { match: MatchState | null; bet: number; onCancel: () => void }) {
  const slots = match?.slots ?? []
  const waiting = !match || match.status === "waiting"
  const seconds = match?.secondsLeft ?? 30
  return <div className="relative flex min-h-[calc(100dvh-170px)] flex-col items-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_22%,#183b80,#0b1220_58%,#080b11)] px-4 py-7 text-center ring-1 ring-white/10">
    <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:34px_34px]" />
    <div className="relative text-[9px] font-black uppercase tracking-[.2em] text-blue-300">Public Stars session</div>
    <div className="relative mt-7 flex h-48 w-48 items-center justify-center rounded-full border-[10px] border-white/8 shadow-[0_0_55px_rgba(47,112,255,.22)]"><div className={cn("absolute inset-3 rounded-full border-2 border-blue-400/35", !waiting && "animate-pulse")} /><div><div className="font-display text-6xl font-black tabular-nums">{waiting ? "···" : seconds}</div><div className="mt-1 text-[9px] font-black uppercase tracking-[.18em] text-white/45">{waiting ? "waiting" : "to spin"}</div></div></div>
    <div className="relative mt-6"><h1 className="font-display text-2xl font-black">{waiting ? "Waiting for the second stake" : "The room is locked in"}</h1><p className="mt-1 text-xs text-white/50">{waiting ? "The first opponent starts the shared 30-second timer." : "More players can join until the timer reaches zero."}</p></div>
    <div className="relative mt-7 flex justify-center gap-3">{Array.from({ length: match?.capacity ?? 4 }).map((_, index) => { const slot = slots[index]; return <div key={index} className="flex flex-col items-center gap-1.5"><div className={cn("flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-black", slot ? "border-blue-300 bg-blue-400/20" : "border-dashed border-white/15 bg-white/5 text-white/25")} title={slot?.name}>{slot?.photoUrl ? <img src={slot.photoUrl} alt="" className="h-full w-full object-cover" /> : slot ? slot.name.slice(0, 1).toUpperCase() : "?"}</div><span className="max-w-14 truncate text-[9px] text-white/45">{slot?.isYou ? "You" : slot?.name ?? "Open"}</span></div> })}</div>
    <div className="relative mt-7 flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-xs font-bold"><Coin className="h-5 w-5 text-[18px]" />{fmt(bet)} each</div>
    {waiting ? <button onClick={onCancel} className="relative mt-auto flex items-center gap-2 rounded-2xl bg-white/8 px-5 py-3 text-sm font-bold text-white/65"><X className="h-4 w-4" />Cancel and refund</button> : <div className="relative mt-auto flex items-center gap-2 text-xs font-bold text-emerald-300"><Clock3 className="h-4 w-4" />Stake locked · shared countdown active</div>}
  </div>
}
