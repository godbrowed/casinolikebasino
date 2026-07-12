"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, TrendingUp, Rocket, Gift, Swords, Star, Send, Loader2 } from "lucide-react"
import { sellGift, sellAll } from "@/app/actions/user"
import { requestGiftWithdraw } from "@/app/actions/gifts-transfer"
import { Coin } from "@/components/coin"
import { TonWalletCard } from "@/components/ton-wallet-card"
import { useUser } from "@/components/user-provider"
import { rarityOf, fmt } from "@/lib/format"
import { levelProgress } from "@/lib/level"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number }
type Hist = {
  id: number
  game: string
  bet: number
  result: number
  meta: Record<string, unknown> | null
  createdAt: string | Date
}
type Me = {
  firstName: string | null
  username: string | null
  photoUrl: string | null
  balance: number
  isDemo: boolean
  xp?: number
  tonWalletAddress?: string | null
} | null

const GAME_ICON: Record<string, typeof Package> = {
  case: Gift,
  crash: Rocket,
  upgrade: TrendingUp,
  battle: Swords,
}

export function ProfileView({ me, inventory, history }: { me: Me; inventory: Item[]; history: Hist[] }) {
  const router = useRouter()
  const { setBalance, refresh } = useUser()
  const [items, setItems] = useState(inventory)
  const [busy, setBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const invValue = items.reduce((s, i) => s + i.value, 0)

  async function handleWithdraw(id: number, name: string) {
    setWithdrawing(id)
    haptic("medium")
    try {
      await requestGiftWithdraw(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setToast(`Withdrawal requested for ${name}. It will be sent to your Telegram once processed.`)
      setTimeout(() => setToast(null), 4500)
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Withdraw failed")
      setTimeout(() => setToast(null), 4000)
    } finally {
      setWithdrawing(null)
      refresh()
      router.refresh()
    }
  }

  async function handleSell(id: number) {
    setBusy(true)
    haptic("light")
    try {
      const res = await sellGift(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setBalance(res.balance)
    } catch {
      // ignore
    } finally {
      setBusy(false)
      refresh()
      router.refresh()
    }
  }

  async function handleSellAll() {
    if (items.length === 0) return
    setBusy(true)
    haptic("medium")
    try {
      const res = await sellAll()
      if (res.balance != null) setBalance(res.balance)
      setItems([])
    } catch {
      // ignore
    } finally {
      setBusy(false)
      refresh()
      router.refresh()
    }
  }

  const lvl = levelProgress(me?.xp ?? 0)

  return (
    <>
      {toast && (
        <div className="fixed inset-x-4 top-16 z-50 rounded-xl bg-primary/15 px-4 py-2.5 text-center text-xs font-medium text-primary shadow-lg ring-1 ring-primary/30 backdrop-blur">
          {toast}
        </div>
      )}

      {/* Level */}
      <div className="card-premium rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Star className="h-5 w-5 fill-primary" />
            </div>
            <div>
              <div className="font-display text-lg font-black leading-none">Level {lvl.level}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {fmt(Math.round(lvl.into))} / {fmt(Math.round(lvl.span))} XP
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {fmt(Math.round(lvl.span - lvl.into))} XP to
            <br />
            Level {lvl.level + 1}
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all"
            style={{ width: `${Math.min(100, lvl.pct)}%` }}
          />
        </div>
      </div>

      <TonWalletCard linkedAddress={me?.tonWalletAddress ?? null} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="mt-1 flex items-center gap-1.5">
            <Coin className="h-5 w-5" />
            <span className="font-display text-2xl font-black">{fmt(me?.balance ?? 0)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Inventory value</div>
          <div className="mt-1 flex items-center gap-1.5">
            <Coin className="h-5 w-5" />
            <span className="font-display text-2xl font-black">{fmt(invValue)}</span>
          </div>
        </div>
      </div>

      {/* Inventory */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Inventory</h2>
          {items.length > 0 && (
            <button
              onClick={handleSellAll}
              disabled={busy}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold transition-colors hover:bg-secondary/70 disabled:opacity-50"
            >
              Sell all · {fmt(invValue)}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No gifts yet. Open a case to win some!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((it) => {
              const r = rarityOf(it.rarity)
              return (
                <div
                  key={it.id}
                  className={cn("flex flex-col rounded-xl border border-border bg-card p-2 text-center ring-1", r.ring)}
                >
                  <div className="relative mx-auto h-14 w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl || "/images/nft-gift.png"} alt={it.name} className="h-full w-full object-contain" />
                  </div>
                  <div className={cn("mt-1 truncate text-[11px] font-semibold", r.text)}>{it.name}</div>
                  <button
                    onClick={() => handleSell(it.id)}
                    disabled={busy || withdrawing === it.id}
                    className="mt-1 flex items-center justify-center gap-1 rounded-lg bg-secondary py-1 text-[11px] font-bold transition-colors hover:bg-secondary/70 disabled:opacity-50"
                  >
                    Sell <Coin className="h-2.5 w-2.5" /> {fmt(it.value)}
                  </button>
                  <button
                    onClick={() => handleWithdraw(it.id, it.name)}
                    disabled={busy || withdrawing === it.id}
                    className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  >
                    {withdrawing === it.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-2.5 w-2.5" /> Withdraw
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">Recent activity</h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No games played yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.map((h) => {
              const Icon = GAME_ICON[h.game] ?? Package
              const won = h.result > 0
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="text-xs font-semibold capitalize">{h.game}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Bet <span className="font-mono">{fmt(h.bet)}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 font-mono text-sm font-bold",
                      won ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {won ? "+" : "-"}
                    {fmt(won ? h.result : h.bet)}
                    <Coin className="h-3 w-3" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
