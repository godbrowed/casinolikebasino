"use client"

import { useState } from "react"
import useSWR from "swr"
import { Gift, X, Check, Loader2, ExternalLink } from "lucide-react"
import { claimDaily, getRewardState } from "@/app/actions/rewards"
import type { RewardState } from "@/lib/rewards-shared"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const dailyChannel = (process.env.NEXT_PUBLIC_DAILY_CHANNEL_USERNAME || "puggift").trim().replace(/^@+/, "")

export function DailyReward() {
  const { setBalance, refresh } = useUser()
  const { data, mutate, isLoading } = useSWR<RewardState>("reward-state", () => getRewardState())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [claimed, setClaimed] = useState<number | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  if (isLoading || !data) return null

  async function handleClaim() {
    setBusy(true)
    setClaimError(null)
    haptic("medium")
    try {
      const res = await claimDaily()
      setBalance(res.balance)
      setClaimed(res.reward)
      hapticNotify("success")
      await mutate()
      refresh()
      setTimeout(() => {
        setClaimed(null)
        setOpen(false)
      }, 1600)
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      setClaimError(
        message.includes("SUBSCRIPTION_REQUIRED")
          ? `Subscribe to @${dailyChannel}, then check again.`
          : "Could not verify your subscription. Try again.",
      )
      hapticNotify("error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[560px] px-3 md:px-4">
      <button
        onClick={() => {
          haptic("light")
          setOpen(true)
        }}
        className={cn(
          "card-premium flex w-full items-center gap-3 rounded-2xl p-3 ring-1 transition-transform active:scale-[0.98]",
          data.canClaim ? "ring-amber-400/40" : "ring-border",
        )}
      >
        <span
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-amber-300",
            data.canClaim && "shadow-lg shadow-amber-500/30",
          )}
        >
          <Gift className="h-5 w-5" />
          {data.canClaim && (
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-card" />
          )}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="font-display text-sm font-bold">Daily reward</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {data.canClaim ? "Your bonus is ready to claim" : `Day ${data.streak} streak · come back tomorrow`}
          </div>
        </div>
        {data.canClaim ? (
          <span className="btn-glow rounded-full px-3 py-1.5 text-xs font-bold">Claim</span>
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground">Claimed</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="card-premium relative mx-auto w-full max-w-md rounded-t-3xl border border-border p-5 pb-8 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !busy && setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-black">Daily rewards</h3>
            <p className="text-xs text-muted-foreground">Log in every day — the longer the streak, the more Stars.</p>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {data.rewards.map((r, i) => {
                const done = i < data.streak % data.rewards.length || (!data.canClaim && i < data.streak)
                const isNext = data.canClaim && i === data.nextIndex
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                      isNext
                        ? "border-amber-400/60 bg-amber-500/10"
                        : done
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border bg-secondary/40",
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Day {i + 1}</span>
                    <Coin className="h-5 w-5" />
                    <span className="font-mono text-xs font-bold">{fmt(r)}</span>
                    {done && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-background">
                        <Check className="h-2.5 w-2.5" strokeWidth={4} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {data.canClaim && claimed == null && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Daily rewards are available to subscribers of <span className="font-bold text-foreground">@{dailyChannel}</span>.
                </p>
                <a
                  href={`https://t.me/${dailyChannel}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-xs font-bold text-foreground"
                >
                  Subscribe to channel
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {claimError && <p className="mt-2 text-center text-[11px] font-medium text-rose-400">{claimError}</p>}
              </div>
            )}

            {claimed != null ? (
              <div className="mt-5 flex animate-pop-in items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-3 font-display text-lg font-black text-emerald-300">
                <Coin className="h-6 w-6" />+{fmt(claimed)} Stars
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={!data.canClaim || busy}
                className={cn(
                  "mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display font-bold transition-transform active:scale-[0.98] disabled:opacity-50",
                  data.canClaim ? "btn-glow" : "bg-secondary text-muted-foreground",
                )}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : data.canClaim ? (
                  <>
                    Check subscription & claim{" "}
                    <span className="inline-flex items-center gap-1">
                      <Coin className="h-4 w-4" />
                      {fmt(data.rewards[data.nextIndex])}
                    </span>
                  </>
                ) : (
                  "Come back tomorrow"
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
