"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Clock3, Loader2, Plus, ShieldCheck, Users, X } from "lucide-react"
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
    <section className="relative min-h-[190px] overflow-hidden rounded-[32px] bg-[#071226] p-5 shadow-[0_18px_46px_-24px_rgba(47,112,255,.65)] ring-1 ring-white/10">
      <img src="/images/puggift-pvp-card-v2.webp" alt="" className="absolute right-0 top-0 h-full w-[62%] object-cover [mask-image:linear-gradient(to_right,transparent,black_35%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#09111f_0%,rgba(9,17,31,.8)_44%,transparent_78%)]" />
      <div className="absolute right-5 top-5 flex h-[150px] w-[150px] items-center justify-center rounded-full border-[8px] border-[#252b36] bg-[#343a46]/95 shadow-[0_16px_38px_rgba(0,0,0,.55),inset_0_0_22px_rgba(0,0,0,.35)] backdrop-blur-sm"><i className="absolute left-1/2 top-[-12px] h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[17px] border-x-transparent border-t-white" /><span className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#080b11] ring-4 ring-[#222733]"><b className="font-display text-xl">0/2</b><small className="text-[7px] font-black uppercase tracking-[.12em] text-white/35">no stakes</small></span></div>
      <div className="relative flex h-full max-w-[62%] flex-col justify-end"><div className="mb-10 text-[9px] font-black uppercase tracking-[.2em] text-blue-300">Real-player sessions</div><h1 className="font-display text-3xl font-black">Stars PvP</h1><p className="mt-1 text-xs leading-relaxed text-white/60">First stake owns the wheel. The second splits it and starts one shared timer.</p></div>
    </section>

    <section className="rounded-[28px] bg-[#30333a] p-4 ring-1 ring-white/10">
      <div className="mb-3 flex items-end justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-white/45">Create your stake</div><div className="mt-1 flex items-center gap-1 font-display text-3xl font-black"><Coin className="h-8 w-8 text-[28px]" glow />{fmt(bet)}</div></div><div className="text-right text-[10px] text-white/45">2 real players<br/><b className="text-emerald-300">90% bank payout</b></div></div>
      <div className="grid grid-cols-3 gap-2">{BETS.map((amount) => <button key={amount} onClick={() => { haptic("light"); setBet(amount) }} className={cn("rounded-2xl py-3 text-xs font-black transition", bet === amount ? "bg-[#2f70ff] text-white shadow-[0_4px_0_#1744b9]" : "bg-[#41454e] text-white/65 hover:bg-[#4a4f59]")}>{fmt(amount)}</button>)}</div>
      <button onClick={() => enterSession(bet)} disabled={busy || !canAfford} className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display font-black disabled:opacity-40">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" />Create or join session</>}</button>
    </section>

    <section className="overflow-hidden rounded-[28px] bg-[#2b2e34] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="flex items-center gap-2 font-display text-sm font-black"><Users className="h-4 w-4 text-[#6e8cff]" />Live sessions</div><span className="text-[10px] font-bold text-white/40">updates automatically</span></div>
      <div className="divide-y divide-white/[.06]">{sessions?.length ? sessions.map((session) => <div key={session.roomId} className="flex items-center gap-3 px-3 py-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[4px] border-[#171a20] shadow-md" style={{ background: session.players === 1 ? "#2f70ff" : "conic-gradient(#2f70ff 0deg 180deg,#ffad32 180deg 360deg)" }}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#11141a] text-[9px] font-black">{session.players}/2</span></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1 font-black"><Coin className="h-4 w-4 text-[15px]" />{fmt(session.bet)} <span className="text-[10px] font-medium text-white/35">each</span></div><div className="mt-0.5 truncate text-[10px] text-white/45">{session.status === "waiting" ? "Waiting for the second stake" : `${session.secondsLeft}s · ${session.players}/${session.capacity} joined`}</div></div>
        <button onClick={() => enterSession(session.bet, session.roomId)} disabled={busy || session.players >= session.capacity || (me?.balance ?? 0) < session.bet} className="rounded-xl bg-[#2f70ff] px-3 py-2 text-xs font-black disabled:opacity-35">Join</button>
      </div>) : <div className="px-4 py-7 text-center text-xs text-white/40">No public session yet — your stake will create the first one.</div>}</div>
    </section>

    <div className="flex items-center justify-center gap-2 text-[10px] text-white/40"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Real accounts only · equal stake · synchronized result</div>
    {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
  </div>
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
