"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Swords, Users, Layers, Loader2, Trophy, Search, X } from "lucide-react"
import type { CaseDTO } from "@/app/actions/cases"
import { joinBattle, getMatchState, leaveBattle, type BattleResult, type MatchState } from "@/app/actions/battles"
import { BattleArena } from "@/components/battle-arena"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Phase = "config" | "matching" | "arena"

type RecentBattle = { id: number; caseName: string; winnerName: string; pot: number; players: number; youWon: boolean }

export function BattlesLobby({ cases, recent = [] }: { cases: CaseDTO[]; recent?: RecentBattle[] }) {
  const { me, refresh } = useUser()
  const battleCases = cases.filter((c) => !c.isFree)
  const [caseId, setCaseId] = useState(battleCases[0]?.id ?? 0)
  const [players, setPlayers] = useState(2)
  const [rounds, setRounds] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>("config")
  const [roomId, setRoomId] = useState<number | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  const selected = battleCases.find((c) => c.id === caseId) ?? battleCases[0]
  const cost = selected ? selected.price * rounds : 0
  const balance = me?.balance ?? 0
  const canAfford = balance >= cost

  const stopPolling = useCallback(() => {
    if (poll.current) {
      clearInterval(poll.current)
      poll.current = null
    }
  }, [])

  const tick = useCallback(
    async (id: number) => {
      try {
        const state = await getMatchState(id)
        setMatch(state)
        if (state.status === "done" && state.result) {
          stopPolling()
          setResult(state.result)
          setPhase("arena")
          refresh()
        }
      } catch {
        // transient; keep polling
      }
    },
    [refresh, stopPolling],
  )

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  async function findBattle() {
    if (busy || !selected) return
    if (!canAfford) {
      setError("Not enough balance. Deposit to play.")
      return
    }
    setError(null)
    setBusy(true)
    haptic("medium")
    try {
      const { roomId: id } = await joinBattle({ caseId: selected.id, capacity: players, rounds })
      setRoomId(id)
      setPhase("matching")
      refresh()
      await tick(id)
      poll.current = setInterval(() => tick(id), 1000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not join battle"
      setError(
        msg === "INSUFFICIENT_FUNDS"
          ? "Not enough balance. Deposit to play."
          : msg === "FREE_CASE_NOT_ALLOWED"
            ? "Daily free cases cannot be used in battles."
            : msg === "EMPTY_CASE"
              ? "This case is temporarily unavailable. Choose another one."
            : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    stopPolling()
    setRoomId(null)
    setMatch(null)
    setResult(null)
    setPhase("config")
    refresh()
  }

  async function cancelQueue() {
    stopPolling()
    const id = roomId
    setPhase("config")
    setMatch(null)
    if (id != null) {
      try {
        await leaveBattle(id)
      } catch {
        // ignore — room may have already started
      }
    }
    setRoomId(null)
    refresh()
  }

  if (phase === "arena" && result && selected) {
    return <BattleArena result={result} poolImages={selected.items.map((i) => i.imageUrl)} onDone={reset} />
  }

  if (phase === "matching") {
    return <Matchmaking match={match} capacity={players} cost={cost} onCancel={cancelQueue} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* intro */}
      <div className="grad-border overflow-hidden rounded-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-card p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-fuchsia-300" />
            <h1 className="font-display text-xl font-black">Case Battles</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a paid case, find a match, and compete for the pot.
          </p>
        </div>
      </div>

      {/* case picker */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Pick a case</h2>
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {battleCases.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                haptic("light")
                setCaseId(c.id)
              }}
              className={cn(
                "card-premium flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl p-2 ring-1 transition-transform active:scale-95",
                c.id === caseId ? "ring-2 ring-cyan-400" : "ring-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.items[0]?.imageUrl || c.coverUrl || "/images/nft-gift.png"}
                alt={c.name}
                className="h-16 w-16 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
              />
              <span className="truncate text-[11px] font-bold">{c.name}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Coin className="h-3 w-3" />
                {fmt(c.price)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* options */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card-premium rounded-2xl p-3 ring-1 ring-border">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Users className="h-4 w-4" /> Players
          </div>
          <div className="flex gap-1.5">
            {[2, 3, 4].map((n) => (
              <OptionPill key={n} active={players === n} onClick={() => setPlayers(n)}>
                {n}
              </OptionPill>
            ))}
          </div>
        </div>
        <div className="card-premium rounded-2xl p-3 ring-1 ring-border">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Layers className="h-4 w-4" /> Rounds
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <OptionPill key={n} active={rounds === n} onClick={() => setRounds(n)}>
                {n}
              </OptionPill>
            ))}
          </div>
        </div>
      </section>

      {battleCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
          Add a paid case to enable battles. Daily free cases are not eligible.
        </div>
      ) : null}

      {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}

      {/* find */}
      <button
        onClick={findBattle}
        disabled={busy || !selected}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-black transition-transform active:scale-[0.98] disabled:opacity-70",
          canAfford ? "btn-glow" : "bg-secondary text-muted-foreground",
        )}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Search className="h-5 w-5" />
            <span>Find battle</span>
            <span className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5">
              <Coin className="h-3.5 w-3.5" />
              <span className="font-mono">{fmt(cost)}</span>
            </span>
          </>
        )}
      </button>

      {/* recent battles */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold">Recent battles</h2>
          <div className="flex flex-col gap-2">
            {recent.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Trophy className={cn("h-4 w-4", b.youWon ? "text-amber-300" : "text-muted-foreground")} />
                  <div className="leading-tight">
                    <div className="text-xs font-bold">{b.winnerName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {b.caseName} · {b.players}p
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Coin className="h-3 w-3" />
                  {fmt(b.pot)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Matchmaking({
  match,
  capacity,
  cost,
  onCancel,
}: {
  match: MatchState | null
  capacity: number
  cost: number
  onCancel: () => void
}) {
  const cap = match?.capacity ?? capacity
  const slots = match?.slots ?? []
  const filled = slots.length
  const secondsLeft = match?.secondsLeft ?? 30
  const starting = match?.status === "resolving" || (match?.status === "waiting" && secondsLeft <= 0)

  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 animate-pulse text-cyan-300" />
          <h1 className="font-display text-xl font-black">
            {starting ? "Starting battle…" : "Finding players…"}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {match?.caseName} · {cap} players · pot builds as players join
        </p>
      </div>

      {/* countdown ring */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#mmg)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - Math.max(0, Math.min(1, secondsLeft / 30)))}
            className="transition-all duration-1000 ease-linear"
          />
          <defs>
            <linearGradient id="mmg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col items-center">
          {starting ? (
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          ) : (
            <>
              <span className="font-display text-3xl font-black tabular-nums">{secondsLeft}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">sec</span>
            </>
          )}
        </div>
      </div>

      {/* slots */}
      <div className="grid w-full grid-cols-2 gap-2.5">
        {Array.from({ length: cap }).map((_, i) => {
          const s = slots[i]
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-2xl border p-3 transition-all",
                s
                  ? s.isYou
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-border bg-card"
                  : "border-dashed border-border/60 bg-secondary/20",
              )}
            >
              {s ? (
                <>
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photoUrl || "/images/nft-gift.png"}
                      alt=""
                      className="h-8 w-8 rounded-full"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      {s.name[0]?.toUpperCase()}
                    </span>
                  )}
                  <div className="leading-tight">
                    <div className={cn("truncate text-xs font-bold", s.isYou && "text-cyan-300")}>{s.name}</div>
                    <div className="text-[10px] text-muted-foreground">{s.isBot ? "Practice player" : "Player"}</div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin opacity-60" />
                  <span className="text-xs">Waiting…</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Entry</span>
        <Coin className="h-4 w-4" />
        <span className="font-mono font-black">{fmt(cost)}</span>
        <span className="ml-2 text-muted-foreground">
          {filled}/{cap} joined
        </span>
      </div>

      {!starting && (
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary/70"
        >
          <X className="h-4 w-4" /> Leave queue
        </button>
      )}
    </div>
  )
}

function OptionPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={() => {
        haptic("light")
        onClick()
      }}
      className={cn(
        "flex-1 rounded-lg py-1.5 font-display text-sm font-black transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
      )}
    >
      {children}
    </button>
  )
}
