"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Package, TrendingUp, Rocket, Gift, Swords, Send, Loader2, Shield, WalletCards, History, Layers3, Plus, ChevronRight, Crown, LockKeyhole, Users, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Coin } from "@/components/coin"
import { TonWalletCard } from "@/components/ton-wallet-card"
import { useUser } from "@/components/user-provider"
import { rarityOf, fmt } from "@/lib/format"
import { levelProgress } from "@/lib/level"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { sellAllGiftsApi, sellGiftApi, withdrawGiftApi } from "@/lib/client-game-api"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number; source: string; locked: boolean }
type FreeCaseClaim = { qualified: number; required: number; ready: boolean; inviteUrl: string } | null
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
  isAdmin?: boolean
  xp?: number
  tonWalletAddress?: string | null
} | null

const GAME_ICON: Record<string, typeof Package> = {
  case: Gift,
  crash: Rocket,
  upgrade: TrendingUp,
  battle: Swords,
}

export function ProfileView({ me, inventory, history, freeCaseClaim }: { me: Me; inventory: Item[]; history: Hist[]; freeCaseClaim: FreeCaseClaim }) {
  const router = useRouter()
  const { setBalance, refresh } = useUser()
  const [items, setItems] = useState(inventory)
  const [busy, setBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showGiveawayTasks, setShowGiveawayTasks] = useState(false)
  const [view, setView] = useState<"collection" | "activity" | "wallet">("collection")

  const invValue = items.reduce((s, i) => s + i.value, 0)
  const sellableItems = items.filter((item) => !item.locked)
  const sellableValue = sellableItems.reduce((sum, item) => sum + item.value, 0)
  const lockedFreeGifts = items.filter((item) => item.locked).length

  useEffect(() => setItems(inventory), [inventory])

  function inviteFriends() {
    if (!freeCaseClaim?.inviteUrl) return
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(freeCaseClaim.inviteUrl)}&text=${encodeURIComponent("🎁 Join PugGift with me and open Telegram NFT gifts!")}`
    window.open(shareUrl, "_blank", "noopener,noreferrer")
  }

  async function handleWithdraw(id: number, name: string) {
    setWithdrawing(id)
    haptic("medium")
    try {
      await withdrawGiftApi(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setToast(`Withdrawal requested for ${name}. It will be sent to your Telegram once processed.`)
      setTimeout(() => setToast(null), 4500)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Withdraw failed"
      if (message === "GIVEAWAY_WITHDRAW_REQUIREMENTS") setShowGiveawayTasks(true)
      else setToast(message === "FREE_CASE_REFERRALS_REQUIRED" ? "Invite 3 Premium friends with an NFT gift to unlock this prize." : message)
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
      const res = await sellGiftApi(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setBalance(res.balance)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sell failed"
      setToast(message === "FREE_CASE_REFERRALS_REQUIRED" ? "This free-case gift is locked until 3 qualified friends join." : message)
      setTimeout(() => setToast(null), 4000)
    } finally {
      setBusy(false)
      refresh()
      router.refresh()
    }
  }

  async function handleSellAll() {
    if (sellableItems.length === 0) return
    setBusy(true)
    haptic("medium")
    try {
      const res = await sellAllGiftsApi()
      if (res.balance != null) setBalance(res.balance)
      setItems((current) => current.filter((item) => item.locked))
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
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-2xl bg-[#2f70ff] px-4 py-3 text-center text-xs font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
      {showGiveawayTasks && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><div className="w-full max-w-sm rounded-[28px] bg-[#292d34] p-5 text-center ring-1 ring-white/10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3674ff]/15 text-3xl">🎁</div><h2 className="mt-4 font-display text-xl font-black">Complete withdrawal tasks</h2><p className="mt-2 text-xs leading-relaxed text-white/50">Before sending a giveaway NFT, share PugGift with one friend and subscribe to @PugGift — the same tasks as the Free Case.</p><Link href="/cases" onClick={() => setShowGiveawayTasks(false)} className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[#3674ff] text-sm font-black">Open Free Case tasks</Link><button onClick={() => setShowGiveawayTasks(false)} className="mt-2 w-full py-2 text-xs font-bold text-white/35">Not now</button></div></div>}

      <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#333842,#292c33)] p-5 shadow-[0_22px_55px_-38px_rgba(47,112,255,.8)] ring-1 ring-white/[.08] md:p-6">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#2f70ff]/15 blur-3xl" />
        <img src="/images/puggift-bot-avatar-web-v2.webp" alt="" className="absolute -bottom-16 -right-12 h-52 w-52 rounded-full object-cover opacity-[.07]" />
        <div className="relative flex items-center gap-4">
          <div className="relative"><img src={me?.photoUrl || "/images/puggift-bot-avatar-web-v2.webp"} alt="" className="h-20 w-20 rounded-full border-[3px] border-[#2f70ff] object-cover shadow-[0_0_30px_rgba(47,112,255,.3)]" /><i className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-[#30343c] bg-emerald-400" /></div>
          <div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#75a0ff]">PugGift player</div><h1 className="mt-1 truncate font-display text-2xl font-black">{me?.firstName || me?.username || "Player"}</h1><div className="mt-1 flex items-center gap-2"><span className="truncate text-xs text-white/40">@{me?.username || "puggift"}</span><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black">LVL {lvl.level}</span></div></div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <ProfileMetric label="Balance" value={fmt(me?.balance ?? 0)} icon={<Coin className="h-4 w-4" />} />
          <ProfileMetric label="Gifts" value={String(items.length)} icon={<Gift className="h-4 w-4 text-[#6e96ff]" />} />
          <ProfileMetric label="Value" value={fmt(invValue)} icon={<Coin className="h-4 w-4" />} />
        </div>

        <div className="relative mt-4 rounded-2xl bg-[#242830] p-3"><div className="flex items-center justify-between text-[10px]"><span className="font-bold text-white/65">Level {lvl.level}</span><span className="text-white/35">{fmt(Math.round(lvl.into))} / {fmt(Math.round(lvl.span))} XP</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2f70ff,#79a1ff)] shadow-[0_0_10px_rgba(47,112,255,.6)]" style={{ width: `${Math.min(100, lvl.pct)}%` }} /></div></div>

        <div className="relative mt-4 grid grid-cols-2 gap-2"><Link href="/deposit" className="flex items-center justify-center gap-2 rounded-[18px] bg-[#2f70ff] py-3 text-sm font-black shadow-[0_4px_0_#1945b9]"><Plus className="h-4 w-4" />Top up</Link><button onClick={() => setView("wallet")} className="flex items-center justify-center gap-2 rounded-[18px] bg-white/10 py-3 text-sm font-black text-white/75"><WalletCards className="h-4 w-4" />Wallet</button></div>
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-[24px] bg-[#30343b] p-1.5 ring-1 ring-white/[.06]">
        <ProfileTab active={view === "collection"} onClick={() => setView("collection")} icon={Layers3} label="Gifts" />
        <ProfileTab active={view === "activity"} onClick={() => setView("activity")} icon={History} label="Activity" />
        <ProfileTab active={view === "wallet"} onClick={() => setView("wallet")} icon={WalletCards} label="Wallet" />
      </div>

      {view === "wallet" && <TonWalletCard linkedAddress={me?.tonWalletAddress ?? null} />}

      {me?.isAdmin && (
        <Link href="/admin" className="flex items-center justify-between rounded-[24px] border border-primary/30 bg-primary/10 p-4 text-primary">
          <span className="flex items-center gap-2 font-display font-bold"><Shield className="h-5 w-5" /> Admin panel</span>
          <span className="text-xs font-semibold">Open</span>
        </Link>
      )}

      {view === "collection" && <section className="rounded-[30px] bg-[#292d34] p-4 ring-1 ring-white/[.06]">
        {lockedFreeGifts > 0 && freeCaseClaim && !freeCaseClaim.ready && <div className="mb-4 overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#342a17,#252a38)] p-4 ring-1 ring-amber-300/20"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-amber-950"><Crown className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.16em] text-amber-200/70">Free case prize</div><h3 className="mt-0.5 font-display text-base font-black">Invite 3 qualified friends</h3><p className="mt-1 text-[11px] leading-relaxed text-white/45">Each new friend needs Telegram Premium and at least one Telegram NFT gift in their profile.</p></div></div><div className="mt-3 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${Math.min(100, freeCaseClaim.qualified / freeCaseClaim.required * 100)}%` }} /></div><b className="text-xs text-amber-200">{freeCaseClaim.qualified}/{freeCaseClaim.required}</b></div><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button onClick={inviteFriends} className="flex items-center justify-center gap-2 rounded-2xl bg-[#2f70ff] py-3 text-xs font-black shadow-[0_4px_0_#1945b9]"><Users className="h-4 w-4" />Invite friends</button><button onClick={() => router.refresh()} aria-label="Check referral progress" className="flex w-12 items-center justify-center rounded-2xl bg-white/10 text-white/65"><RefreshCw className="h-4 w-4" /></button></div></div>}
        <div className="mb-4 flex items-center justify-between">
          <div><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#6e96ff]">Collection</div><h2 className="font-display text-xl font-black">Your gifts · {items.length}</h2></div>
          {sellableItems.length > 0 && (
            <button
              onClick={handleSellAll}
              disabled={busy}
              className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black text-white/65 transition hover:bg-white/15 disabled:opacity-50"
            >
              Sell all · {fmt(sellableValue)}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-[#22252b] p-8 text-center">
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#2f70ff]/10 blur-2xl" /><div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#11141a] ring-1 ring-white/10"><img src="/images/puggift-bot-avatar-web-v2.webp" alt="" className="h-full w-full object-cover opacity-75" /></div>
            <p className="text-sm text-white/40">No gifts yet. Open a case to build your collection.</p><Link href="/cases" className="rounded-2xl bg-[#2f70ff] px-4 py-2.5 text-xs font-black">Open cases</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {items.map((it) => {
              const r = rarityOf(it.rarity)
              return (
                <div
                  key={it.id}
                  className={cn("group flex min-w-0 flex-col rounded-[22px] bg-[#363a42] p-2.5 text-center ring-1", r.ring)}
                >
                  <div className="relative mx-auto h-20 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl || "/images/nft-gift.png"} alt={it.name} className="h-full w-full object-contain" />
                    {it.locked && <span className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-lg"><LockKeyhole className="h-3.5 w-3.5" /></span>}
                  </div>
                  <div className={cn("mt-1 truncate text-xs font-black", r.text)}>{it.name}</div><div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-white/50"><Coin className="h-3 w-3" />{fmt(it.value)}</div>
                  {it.locked ? <button onClick={inviteFriends} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-amber-300 py-2 text-[9px] font-black text-amber-950"><Users className="h-3 w-3" />Invite to unlock</button> : <div className="mt-2 grid grid-cols-2 gap-1">
                  <button
                    onClick={() => handleSell(it.id)}
                    disabled={busy || withdrawing === it.id}
                    className="flex items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-[9px] font-black transition hover:bg-white/15 disabled:opacity-50"
                  >
                    Sell
                  </button>
                  <button
                    onClick={() => handleWithdraw(it.id, it.name)}
                    disabled={busy || withdrawing === it.id}
                    className="flex items-center justify-center gap-1 rounded-xl bg-[#2f70ff] py-2 text-[9px] font-black text-white transition hover:bg-[#3e7aff] disabled:opacity-50"
                  >
                    {withdrawing === it.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-2.5 w-2.5" /> Send
                      </>
                    )}
                  </button>
                  </div>
                  }
                </div>
              )
            })}
          </div>
        )}
      </section>}

      {view === "activity" && <section className="rounded-[30px] bg-[#292d34] p-4 ring-1 ring-white/[.06]">
        <div className="mb-4"><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#6e96ff]">Timeline</div><h2 className="font-display text-xl font-black">Recent activity</h2></div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No games played yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.map((h) => {
              const Icon = GAME_ICON[h.game] ?? Package
              const won = h.result > 0
              const rewardImage = typeof h.meta?.imageUrl === "string" ? h.meta.imageUrl : null
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-[20px] bg-[#363a42] px-3 py-3 ring-1 ring-white/[.05]"
                >
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] bg-white/[.07]">
                    {rewardImage ? <img src={rewardImage} alt="" className="h-9 w-9 object-contain" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="text-xs font-black capitalize">{h.game}</div>
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
                  </div><ChevronRight className="h-4 w-4 text-white/20" />
                </div>
              )
            })}
          </div>
        )}
      </section>}
    </div>
  )
}

function ProfileMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="min-w-0 rounded-[18px] bg-[#242830] p-3 text-center"><div className="flex items-center justify-center gap-1 text-[9px] font-bold text-white/35">{icon}{label}</div><div className="mt-1 truncate font-display text-base font-black">{value}</div></div>
}

function ProfileTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Layers3; label: string }) {
  return <button onClick={onClick} className={cn("flex items-center justify-center gap-1.5 rounded-[18px] py-3 text-[11px] font-black transition", active ? "bg-[#2f70ff] text-white shadow-[0_4px_0_#1945b9]" : "text-white/42 hover:text-white/65")}><Icon className="h-4 w-4" />{label}</button>
}
