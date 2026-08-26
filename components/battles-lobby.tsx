"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Clock3, Loader2, Plus, ShieldCheck, Users, X } from "lucide-react"
import type { BattleResult, BattleSession, MatchState } from "@/app/actions/battles"
import { BattleArena } from "@/components/battle-arena"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fetchBattleSessions, fetchMatchState, joinBattleApi, leaveBattleApi } from "@/lib/client-game-api"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"

const COLORS = ["#2f70ff", "#ff9d3d", "#a855f7", "#1fc996", "#f0447d", "#00b8d9", "#f4c430", "#7c6cff"]

export function BattlesLobby() {
  const { me, refresh } = useUser()
  const { data: sessions, mutate: refreshSession } = useSWR<BattleSession[]>("global-pvp", fetchBattleSessions, { refreshInterval: 1000 })
  const session = sessions?.[0] ?? null
  const [roomId, setRoomId] = useState<number | null>(null)
  const [bet, setBet] = useState(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const { data: match } = useSWR<MatchState>(roomId ? `global-pvp-room-${roomId}` : null, () => fetchMatchState(roomId!), { refreshInterval: 900 })

  useEffect(() => {
    if (session?.myStake && session.myStake > 0) setRoomId(session.roomId)
  }, [session?.myStake, session?.roomId])
  useEffect(() => {
    if (match?.status === "done" && match.result) {
      setResult(match.result)
      void refresh()
      void refreshSession()
    }
  }, [match, refresh, refreshSession])

  async function placeStake() {
    if (busy || bet < 10) return
    if ((me?.balance ?? 0) < bet) { setError("Not enough Stars for this stake."); return }
    setBusy(true); setError(null); haptic("medium")
    try {
      const joined = await joinBattleApi(bet)
      setRoomId(joined.roomId)
      await Promise.all([refresh(), refreshSession()])
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not place stake"
      setError(message === "INSUFFICIENT_FUNDS" ? "Not enough Stars for this stake." : message === "INVALID_BET" ? "Enter between 10 and 100,000 Stars." : "PvP is temporarily unavailable. Please try again.")
    } finally { setBusy(false) }
  }

  async function cancelStake() {
    if (!session || session.status !== "waiting" || busy) return
    setBusy(true)
    await leaveBattleApi(session.roomId).catch(() => setError("Could not refund this stake."))
    setRoomId(null)
    await Promise.all([refresh(), refreshSession()])
    setBusy(false)
  }

  if (result) return <BattleArena result={result} onDone={() => { setResult(null); setRoomId(null); void refreshSession() }} />

  const live = match && match.status !== "done" ? match : null
  const display = live ? {
    roomId: live.roomId, bank: live.bank, payout: live.payout, myStake: live.myStake,
    players: live.slots.length, status: live.status === "countdown" ? "countdown" as const : "waiting" as const,
    secondsLeft: live.secondsLeft, names: live.slots.map((slot) => slot.name), photos: live.slots.map((slot) => slot.photoUrl),
    stakes: live.slots.map((slot) => slot.stake), chances: live.slots.map((slot) => slot.chance), isYou: live.slots.map((slot) => slot.isYou),
  } : session

  return <div className="mx-auto flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-84px)] w-full max-w-[760px] flex-col gap-3 pb-5">
    <header className="flex items-center justify-between px-1">
      <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101217] text-white/70 ring-1 ring-white/[.06]"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="text-center"><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#6f91ff]">One room · real players</div><h1 className="font-display text-xl font-black">Global PvP</h1></div>
      <div className="h-11 w-11" />
    </header>

    <JackpotWheel session={display} />

    <section className="rounded-[26px] bg-[#2b2e34] p-3 ring-1 ring-white/10">
      <div className="mb-3 flex items-end justify-between px-1">
        <div><div className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">{(display?.myStake ?? 0) > 0 ? "Add to your stake" : "Your stake"}</div><div className="text-xs text-white/55">Your chance changes instantly with the bank</div></div>
        {(display?.myStake ?? 0) > 0 && <div className="text-right"><div className="text-[9px] font-black uppercase text-white/35">in round</div><div className="flex items-center gap-1 font-black text-[#7fa0ff]"><Coin className="h-4 w-4" />{fmt(display!.myStake)}</div></div>}
      </div>
      <div className="flex items-center gap-3 rounded-[19px] bg-[#17191e] px-4 py-3 ring-1 ring-white/[.07]">
        <Coin className="h-6 w-6" />
        <input aria-label="PvP stake" type="number" inputMode="numeric" min={10} max={100000} value={bet || ""} onChange={(event) => setBet(Math.max(0, Math.min(100000, Math.floor(Number(event.target.value)))))} className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-black outline-none" />
        <button onClick={() => setBet(Math.min(100000, Math.floor(me?.balance ?? 0)))} className="rounded-xl bg-white/[.07] px-3 py-2 text-[10px] font-black uppercase text-[#7e9eff]">max</button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">{[50, 250, 1000].map((amount) => <button key={amount} onClick={() => { haptic("light"); setBet(Math.min(100000, bet + amount)) }} className="rounded-xl bg-[#41454e] py-2.5 text-xs font-black text-white/60">+{fmt(amount)}</button>)}</div>
      <button onClick={placeStake} disabled={busy || bet < 10 || (me?.balance ?? 0) < bet} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[19px] bg-[#2f70ff] py-4 font-display text-base font-black text-white shadow-[0_7px_22px_rgba(47,112,255,.3)] disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" />{(display?.myStake ?? 0) > 0 ? "Add stake" : "Place stake"}</>}
      </button>
      {(display?.myStake ?? 0) > 0 && display?.status === "waiting" && <button onClick={cancelStake} disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold text-white/45"><X className="h-4 w-4" />Cancel and refund {fmt(display!.myStake)}</button>}
    </section>

    <Participants session={display} />
    <div className="flex items-center justify-center gap-2 text-[10px] text-white/40"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />No bots · chance equals stake share · synchronized result</div>
    {error && <p className="text-center text-xs font-bold text-rose-300">{error}</p>}
  </div>
}

type WheelData = Pick<BattleSession, "bank" | "payout" | "myStake" | "players" | "status" | "secondsLeft" | "names" | "photos" | "stakes" | "chances" | "isYou"> | null

function JackpotWheel({ session }: { session: WheelData }) {
  const segments = useMemo(() => {
    if (!session?.players || !session.bank) return []
    let cursor = 0
    return session.stakes.map((stake, index) => {
      const start = cursor; const size = stake / session.bank * 360; cursor += size
      return { start, end: cursor, middle: start + size / 2, color: COLORS[index % COLORS.length] }
    })
  }, [session])
  const wheel = segments.length ? `conic-gradient(${segments.map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`).join(",")})` : "repeating-conic-gradient(#42454c 0deg 36deg,#555960 36deg 72deg)"
  const mine = session?.isYou.findIndex(Boolean) ?? -1
  const myChance = mine >= 0 ? session!.chances[mine] : 0
  return <section className="flex flex-col items-center rounded-[30px] bg-[#0b0c0f] px-3 pb-4 pt-3 ring-1 ring-white/[.055]">
    <div className="relative aspect-square w-full max-w-[430px]">
      <i className="absolute left-1/2 top-[-6px] z-20 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-white" />
      <div className="absolute inset-[5%] rounded-full border-[9px] border-[#1e2025] shadow-[0_22px_55px_rgba(0,0,0,.58),inset_0_0_24px_rgba(0,0,0,.4)] transition-[background] duration-500" style={{ background: wheel }} />
      {segments.slice(0, 12).map((segment, index) => { const rad = segment.middle * Math.PI / 180; return <div key={`${session!.names[index]}-${index}`} className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#171a20] text-xs font-black shadow-xl" style={{ left: `${50 + Math.sin(rad) * 36}%`, top: `${50 - Math.cos(rad) * 36}%` }}>{session!.photos[index] ? <img src={session!.photos[index] ?? undefined} alt="" className="h-full w-full object-cover" /> : session!.names[index].slice(0,1).toUpperCase()}</div> })}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#0b0c0f] text-center ring-[7px] ring-[#1e2025]">
        <span className="font-display text-3xl font-black tabular-nums">{session?.status === "countdown" ? session.secondsLeft : session?.players ? "WAIT" : "0"}</span>
        <span className="mt-1 text-[8px] font-black uppercase tracking-[.14em] text-white/35">{session?.status === "countdown" ? "seconds" : session?.players ? "for player" : "players"}</span>
      </div>
    </div>
    <div className="-mt-1 grid w-full max-w-md grid-cols-3 gap-2">
      <Stat label="Bank" value={session?.bank ?? 0} coin />
      <Stat label="Prize" value={session?.payout ?? 0} coin />
      <Stat label="Your chance" value={`${myChance.toFixed(myChance < 10 ? 2 : 1)}%`} />
    </div>
    <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">The first stake opens the global wheel. The second player starts one shared 30-second countdown; everyone can join or add stake until it ends.</p>
  </section>
}

function Stat({ label, value, coin }: { label: string; value: number | string; coin?: boolean }) {
  return <div className="rounded-2xl bg-[#292c32] px-2 py-2.5 text-center ring-1 ring-white/[.06]"><div className="text-[8px] font-black uppercase tracking-[.12em] text-white/35">{label}</div><div className="mt-1 flex items-center justify-center gap-1 font-mono text-sm font-black">{coin && <Coin className="h-3.5 w-3.5" />}{typeof value === "number" ? fmt(value) : value}</div></div>
}

function Participants({ session }: { session: WheelData }) {
  return <section className="overflow-hidden rounded-[26px] bg-[#2b2e34] ring-1 ring-white/10">
    <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3"><div className="flex items-center gap-2 font-display text-sm font-black"><Users className="h-4 w-4 text-[#6e8cff]" />Players</div><span className="text-[10px] font-bold text-white/40">{session?.players ?? 0} live</span></div>
    {session?.players ? <div className="max-h-64 divide-y divide-white/[.055] overflow-y-auto">{session.names.map((name, index) => <div key={`${name}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-black" style={{ borderColor: COLORS[index % COLORS.length], background: `${COLORS[index % COLORS.length]}24` }}>{session.photos[index] ? <img src={session.photos[index] ?? undefined} alt="" className="h-full w-full object-cover" /> : name.slice(0,1).toUpperCase()}</div>
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{session.isYou[index] ? "You" : name}</div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/45"><Coin className="h-3 w-3" />{fmt(session.stakes[index])}</div></div>
      <div className="rounded-full bg-white/[.06] px-2.5 py-1 font-mono text-xs font-black" style={{ color: COLORS[index % COLORS.length] }}>{session.chances[index].toFixed(session.chances[index] < 10 ? 2 : 1)}%</div>
    </div>)}</div> : <div className="px-4 py-7 text-center"><Clock3 className="mx-auto h-5 w-5 text-white/25" /><div className="mt-2 text-xs font-bold text-white/45">No stakes yet. Be the first player in the global room.</div></div>}
  </section>
}
