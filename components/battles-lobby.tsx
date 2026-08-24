"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search, ShieldCheck, Swords, Users, X } from "lucide-react"
import { getMatchState, joinBattle, leaveBattle, type BattleResult, type MatchState } from "@/app/actions/battles"
import { BattleArena } from "@/components/battle-arena"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Phase = "config" | "matching" | "arena"
const BETS = [50, 100, 250, 500, 1000, 2500]

export function BattlesLobby() {
  const { me, refresh } = useUser()
  const [bet, setBet] = useState(250)
  const [players, setPlayers] = useState(2)
  const [phase, setPhase] = useState<Phase>("config")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<number | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  const canAfford = (me?.balance ?? 0) >= bet
  const possibleWin = Math.floor(bet * players * 0.9)

  const stopPolling = useCallback(() => { if (poll.current) clearInterval(poll.current); poll.current = null }, [])
  const tick = useCallback(async (id: number) => {
    try {
      const state = await getMatchState(id)
      setMatch(state)
      if (state.status === "done" && state.result) {
        stopPolling(); setResult(state.result); setPhase("arena"); refresh()
      }
    } catch { /* retry on the next lightweight poll */ }
  }, [refresh, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function findBattle() {
    if (busy || !canAfford) return setError("Not enough Stars for this bet.")
    setBusy(true); setError(null); haptic("medium")
    try {
      const { roomId: id } = await joinBattle({ bet, capacity: players })
      setRoomId(id); setPhase("matching"); refresh(); await tick(id)
      poll.current = setInterval(() => void tick(id), 1000)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not join PvP"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars for this bet." : message === "INVALID_BET" ? "Choose a valid bet." : message)
    } finally { setBusy(false) }
  }

  async function cancelQueue() {
    stopPolling(); const id = roomId; setPhase("config"); setMatch(null); setRoomId(null)
    if (id != null) await leaveBattle(id).catch(() => undefined)
    refresh()
  }

  function reset() { stopPolling(); setRoomId(null); setMatch(null); setResult(null); setPhase("config"); refresh() }

  if (phase === "arena" && result) return <BattleArena result={result} onDone={reset} />
  if (phase === "matching") return <Matchmaking match={match} capacity={players} bet={bet} onCancel={cancelQueue} />

  return <div className="flex flex-col gap-4">
    <section className="relative overflow-hidden rounded-[30px] border border-fuchsia-300/20 bg-[linear-gradient(145deg,#78229a,#2e123f)] p-5 shadow-[0_9px_0_-5px_rgba(0,0,0,.65)]">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-pink-300/20 blur-3xl" />
      <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20"><Swords className="h-6 w-6" /></span><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-white/55">Real-time wager</div><h1 className="font-display text-2xl font-black">Stars PvP</h1><p className="text-xs text-white/60">Equal bets. One shared bank. One winner.</p></div></div>
    </section>

    <section className="rounded-[28px] border border-white/10 bg-[#282b32] p-3">
      <div className="mb-3 flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Your stake</div><div className="mt-1 flex items-center gap-1 font-display text-3xl font-black"><Coin className="h-7 w-7" />{fmt(bet)}</div></div><div className="rounded-2xl bg-emerald-400/10 px-3 py-2 text-right"><div className="text-[9px] font-black uppercase text-emerald-300/70">Possible win</div><div className="flex items-center gap-1 font-display text-lg font-black text-emerald-300"><Coin className="h-4 w-4" />{fmt(possibleWin)}</div></div></div>
      <div className="grid grid-cols-3 gap-2">{BETS.map((amount) => <button key={amount} onClick={() => { haptic("light"); setBet(amount) }} className={cn("rounded-2xl py-2.5 text-xs font-black transition-all", bet === amount ? "bg-primary text-white shadow-[0_4px_0_#1938a8]" : "bg-[#373b44] text-white/65")}>{fmt(amount)}</button>)}</div>
    </section>

    <section className="rounded-[28px] border border-white/10 bg-[#282b32] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black"><Users className="h-4 w-4 text-blue-300" />Players</div>
      <div className="grid grid-cols-3 gap-2">{[2, 3, 4].map((count) => <button key={count} onClick={() => setPlayers(count)} className={cn("rounded-2xl py-3 font-black", players === count ? "bg-white text-[#20232a]" : "bg-[#373b44] text-white/55")}>{count}P</button>)}</div>
    </section>

    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />90% shared payout</span><span>Real players have priority</span></div>
    {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
    <button onClick={findBattle} disabled={busy || !canAfford} className={cn("flex items-center justify-center gap-2 rounded-3xl py-4 font-display text-base font-black", canAfford ? "btn-glow" : "bg-secondary text-muted-foreground")}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-5 w-5" />Find a battle</>}
    </button>
  </div>
}

function Matchmaking({ match, capacity, bet, onCancel }: { match: MatchState | null; capacity: number; bet: number; onCancel: () => void }) {
  const slots = match?.slots ?? []
  const seconds = match?.secondsLeft ?? 30
  return <div className="flex min-h-[520px] flex-col items-center justify-center gap-6 rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_50%_25%,#193d87,#10141e_55%)] p-5 text-center">
    <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-white/8"><div className="absolute inset-2 rounded-full border border-blue-300/20" /><div><div className="font-display text-4xl font-black">{seconds}</div><div className="text-[9px] font-black uppercase tracking-[.15em] text-white/45">matching</div></div></div>
    <div><h1 className="font-display text-xl font-black">Building the room</h1><p className="mt-1 text-xs text-muted-foreground">{slots.length}/{match?.capacity ?? capacity} players · {fmt(bet)} Stars each</p></div>
    <div className="flex justify-center gap-3">{Array.from({ length: match?.capacity ?? capacity }).map((_, index) => { const slot = slots[index]; return <div key={index} className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-black", slot ? "border-blue-300 bg-blue-400/20" : "border-dashed border-white/15 bg-white/5 text-white/25")} title={slot?.name}>{slot ? slot.name.slice(0, 1).toUpperCase() : "?"}</div> })}</div>
    <button onClick={onCancel} className="flex items-center gap-2 rounded-2xl bg-white/8 px-5 py-3 text-sm font-bold text-white/65"><X className="h-4 w-4" />Cancel and refund</button>
  </div>
}
