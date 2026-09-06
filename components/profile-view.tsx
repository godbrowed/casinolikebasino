"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bomb, Dices, Package, TrendingUp, Rocket, Gift, Swords, Loader2, Shield, WalletCards, History, Layers3, Plus, ChevronRight, LockKeyhole, Users, RefreshCw, Copy, CheckCheck, X } from "lucide-react"
import Link from "next/link"
import { Coin } from "@/components/coin"
import { TonWalletCard } from "@/components/ton-wallet-card"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { levelProgress } from "@/lib/level"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { sellAllGiftsApi, sellGiftApi, withdrawGiftApi } from "@/lib/client-game-api"

type Item = { id: number; name: string; rarity: string; imageUrl: string; value: number; source: string; locked: boolean; sending: boolean }
type FreeCaseClaim = { qualified: number; required: number; ready: boolean; inviteUrl: string } | null
type ReferralDashboard = { invited: number; earned: number; ratePercent: number; inviteUrl: string } | null
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
  mines: Bomb,
  dice: Dices,
}

export function ProfileView({ me, inventory, history, freeCaseClaim, referral }: { me: Me; inventory: Item[]; history: Hist[]; freeCaseClaim: FreeCaseClaim; referral: ReferralDashboard }) {
  const router = useRouter()
  const { setBalance, refresh } = useUser()
  const [items, setItems] = useState(inventory)
  const [busy, setBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showGiveawayTasks, setShowGiveawayTasks] = useState(false)
  const [view, setView] = useState<"collection" | "activity" | "wallet" | "refer">("collection")
  const [copiedReferral, setCopiedReferral] = useState(false)

  const invValue = items.reduce((s, i) => s + i.value, 0)
  const sellableItems = items.filter((item) => !item.locked && !item.sending)
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
      const result = await withdrawGiftApi(id)
      setBalance(result.balance)
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, sending: true } : item))
      setToast(`Withdrawal requested for ${name}. The 25 Stars transfer fee was charged.`)
      setTimeout(() => setToast(null), 4500)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Withdraw failed"
      if (message === "GIVEAWAY_WITHDRAW_REQUIREMENTS") setShowGiveawayTasks(true)
      else if (message === "WITHDRAW_FEE_REQUIRED") setToast("You need at least 25 Stars on your PugGift balance to withdraw an NFT.")
      else if (message === "NFT_WITHDRAWALS_BLOCKED") setToast("NFT withdrawals are blocked for this account. Contact support.")
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
      setItems((current) => current.filter((item) => item.locked || item.sending))
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
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 pb-4">
      {toast && (
        <div role="status" className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-2xl bg-[#42454b] px-4 py-3 text-center text-sm font-medium leading-relaxed text-white">
          {toast}
        </div>
      )}
      {showGiveawayTasks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="withdrawal-tasks-title" className="relative w-full max-w-[460px] rounded-[28px] bg-[#303236] p-6 text-center">
            <button onClick={() => setShowGiveawayTasks(false)} aria-label="Close withdrawal tasks" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
            <Gift className="mx-auto mt-4 h-10 w-10 text-[#76a1ff]" strokeWidth={1.7} />
            <h2 id="withdrawal-tasks-title" className="mt-5 text-2xl font-bold tracking-tight">Complete withdrawal tasks</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#aeb0b6]">Before sending a giveaway NFT, share PugGift with one friend and subscribe to @PugGift — the same tasks as the Free Case.</p>
            <Link href="/cases" onClick={() => setShowGiveawayTasks(false)} className="mt-6 flex min-h-14 items-center justify-center rounded-[20px] bg-[#2b6eff] px-4 text-base font-semibold">Open Free Case tasks</Link>
            <button onClick={() => setShowGiveawayTasks(false)} className="mt-2 min-h-11 w-full text-sm font-medium text-[#aeb0b6]">Not now</button>
          </div>
        </div>
      )}

      <section className="flex items-center gap-3 px-1">
        {me?.photoUrl ? <img src={me.photoUrl} alt="Your profile" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <span aria-label="Your profile" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2b6eff] text-2xl font-semibold">{(me?.firstName || me?.username || "P").charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[24px] font-bold leading-tight tracking-tight">{me?.firstName || me?.username || "Your profile"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#aeb0b6]">
            {me?.username && <span className="max-w-full truncate">@{me.username}</span>}
            <span title={`${fmt(Math.round(lvl.into))} / ${fmt(Math.round(lvl.span))} XP`}>Level {lvl.level}</span>
          </div>
        </div>
        <Link href="/deposit" aria-label="Top up balance" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2b6eff] text-white transition-colors hover:bg-[#3d7bff]"><Plus className="h-5 w-5" /></Link>
      </section>

      <div className="grid grid-cols-4 gap-1 rounded-[21px] bg-[#36383c] p-1">
        <ProfileTab active={view === "collection"} onClick={() => setView("collection")} icon={Layers3} label="Gifts" />
        <ProfileTab active={view === "activity"} onClick={() => setView("activity")} icon={History} label="Activity" />
        <ProfileTab active={view === "wallet"} onClick={() => setView("wallet")} icon={WalletCards} label="Wallet" />
        <ProfileTab active={view === "refer"} onClick={() => setView("refer")} icon={Users} label="Refer" />
      </div>

      {view === "wallet" && <TonWalletCard linkedAddress={me?.tonWalletAddress ?? null} />}

      {(view === "refer" || view === "collection") && referral && (
        <section className="rounded-[28px] bg-[#36383c] p-5 sm:p-6">
          <h2 className="text-[25px] font-bold leading-[1.2] tracking-tight sm:text-[28px]">Invite friends and earn <span className="inline-block rounded-lg bg-[#2b6eff] px-1.5 pb-0.5">{referral.ratePercent}%</span> from their deposits!</h2>
          <p className="mt-3 text-[15px] leading-snug text-[#aeb0b6]">Share your link. Get a reward whenever your friends top up.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProfileMetric label="Invited" value={String(referral.invited)} />
            <ProfileMetric label="Earned" value={fmt(referral.earned)} icon={<Coin className="h-5 w-5" />} />
          </div>
          {view === "refer" && <div className="mt-4 break-all rounded-2xl bg-[#424449] px-4 py-3 text-[13px] leading-relaxed text-[#d0d1d5]">{referral.inviteUrl}</div>}
          <div className="mt-4 grid grid-cols-[1fr_56px] gap-3">
            <button onClick={() => { const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referral.inviteUrl)}&text=${encodeURIComponent("🎁 Join PugGift with me!")}`; window.open(shareUrl, "_blank", "noopener,noreferrer") }} className="flex min-h-14 items-center justify-center rounded-[20px] bg-[#2b6eff] text-[17px] font-semibold transition-colors hover:bg-[#3d7bff]">Invite</button>
            <button onClick={async () => { await navigator.clipboard.writeText(referral.inviteUrl); setCopiedReferral(true); window.setTimeout(() => setCopiedReferral(false), 1600) }} aria-label={copiedReferral ? "Referral link copied" : "Copy referral link"} className="flex min-h-14 items-center justify-center rounded-[20px] bg-[#55575c] text-white transition-colors hover:bg-[#62646a]">{copiedReferral ? <CheckCheck className="h-6 w-6" /> : <Copy className="h-6 w-6" />}</button>
          </div>
          {view === "refer" && <p className="mt-4 text-[13px] leading-relaxed text-[#aeb0b6]">Rewards are added to your balance after a Stars, TON or NFT gift deposit is confirmed.</p>}
        </section>
      )}

      {me?.isAdmin && (
        <Link href="/admin" className="flex items-center justify-between rounded-[20px] bg-[#36383c] px-4 py-4 text-[#d0d1d5]">
          <span className="flex items-center gap-3 text-sm font-semibold"><Shield className="h-5 w-5" /> Admin panel</span>
          <ChevronRight className="h-5 w-5 text-[#aeb0b6]" />
        </Link>
      )}

      {view === "collection" && <section>
        <div className="mb-6 text-center">
          <h2 className="text-[27px] font-bold tracking-tight">Your gifts <span className="text-[#aeb0b6]">· {items.length}</span></h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#4b4d52] px-3 text-sm font-semibold"><Coin className="h-4 w-4" />{fmt(invValue)}</span>
            {sellableItems.length > 0 && <button onClick={handleSellAll} disabled={busy} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#36383c] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#424449] disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Sell all · {fmt(sellableValue)}</button>}
          </div>
        </div>
        {lockedFreeGifts > 0 && freeCaseClaim && !freeCaseClaim.ready && (
          <div className="mb-5 rounded-[24px] bg-[#36383c] p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-[#aeb0b6]" />
              <div className="min-w-0 flex-1"><h3 className="text-base font-bold">Unlock your free case gifts</h3><p className="mt-2 text-[13px] leading-relaxed text-[#aeb0b6]">Invite 3 new friends with Telegram Premium and at least one Telegram NFT gift in their profile.</p></div>
            </div>
            <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#505258]"><div className="h-full rounded-full bg-[#2b6eff] transition-[width]" style={{ width: `${Math.min(100, freeCaseClaim.qualified / freeCaseClaim.required * 100)}%` }} /></div><span className="text-[13px] font-semibold text-[#d0d1d5]">{freeCaseClaim.qualified}/{freeCaseClaim.required}</span></div>
            <div className="mt-4 grid grid-cols-[1fr_48px] gap-2"><button onClick={inviteFriends} className="flex min-h-12 items-center justify-center rounded-2xl bg-[#2b6eff] text-sm font-semibold">Invite friends</button><button onClick={() => router.refresh()} aria-label="Check referral progress" className="flex min-h-12 items-center justify-center rounded-2xl bg-[#55575c] text-white"><RefreshCw className="h-5 w-5" /></button></div>
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[26px] bg-[#36383c] px-6 py-8 text-center">
            <Gift className="h-9 w-9 text-[#aeb0b6]" strokeWidth={1.5} />
            <h3 className="mt-4 text-lg font-semibold">Your collection starts here</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#aeb0b6]">Open a case or add a gift from Telegram.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/cases" className="flex min-h-11 items-center justify-center rounded-2xl bg-[#2b6eff] px-5 text-sm font-semibold">Open cases</Link><Link href="/deposit" className="flex min-h-11 items-center justify-center rounded-2xl bg-[#505258] px-5 text-sm font-semibold">Add gift</Link></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 min-[440px]:grid-cols-3">
            {items.map((it) => (
                <div
                  key={it.id}
                  className="flex min-w-0 flex-col rounded-[25px] bg-[#36383c] p-2.5 text-center"
                >
                  <div className="relative mx-auto flex h-28 w-full items-center justify-center sm:h-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl || "/images/nft-gift.png"} alt={it.name} className="h-full w-full object-contain p-1" />
                    {it.locked && <span aria-label="Gift locked" className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#55575c] text-white"><LockKeyhole className="h-3.5 w-3.5" /></span>}
                  </div>
                  <div title={it.name} className="mt-2 truncate text-[13px] font-semibold text-white">{it.name}</div>
                  <div className="mt-2 flex min-h-8 items-center justify-center gap-1 rounded-full bg-[#505258] px-1 text-sm font-semibold text-white"><Coin className="h-4 w-4" />{fmt(it.value)}</div>
                  {it.sending ? <button disabled className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#45474c] text-[13px] font-semibold text-[#aeb0b6]"><Loader2 className="h-4 w-4 animate-spin" />Sending</button> : it.locked ? <button onClick={inviteFriends} className="mt-2 flex min-h-10 w-full items-center justify-center gap-1 rounded-[14px] bg-[#2b6eff] text-[13px] font-semibold text-white">Invite to unlock</button> : <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleSell(it.id)}
                    disabled={busy || withdrawing === it.id}
                    className="flex min-h-10 items-center justify-center rounded-[14px] bg-[#505258] text-[13px] font-semibold transition-colors hover:bg-[#5b5d63] disabled:opacity-50"
                  >
                    Sell
                  </button>
                  <button
                    onClick={() => handleWithdraw(it.id, it.name)}
                    disabled={busy || withdrawing === it.id}
                    className="flex min-h-10 items-center justify-center gap-1 rounded-[14px] bg-[#2b6eff] text-[12px] font-semibold text-white transition-colors hover:bg-[#3d7bff] disabled:opacity-50"
                  >
                    {withdrawing === it.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send · 25
                      </>
                    )}
                  </button>
                  </div>
                  }
                </div>
            ))}
          </div>
        )}
      </section>}

      {view === "activity" && <section>
        <h2 className="mb-5 px-1 text-[25px] font-bold tracking-tight">Recent activity</h2>
        {history.length === 0 ? (
          <div className="rounded-[26px] bg-[#36383c] px-6 py-8 text-center"><History className="mx-auto h-8 w-8 text-[#aeb0b6]" strokeWidth={1.5} /><p className="mt-4 text-sm text-[#aeb0b6]">Your game history will appear here.</p></div>
        ) : (
          <div className="divide-y divide-white/[.07] overflow-hidden rounded-[26px] bg-[#36383c] px-4">
            {history.map((h) => {
              const Icon = GAME_ICON[h.game] ?? Package
              const won = h.result > 0
              const rewardImage = typeof h.meta?.imageUrl === "string" ? h.meta.imageUrl : null
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 py-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4b4d52]">
                    {rewardImage ? <img src={rewardImage} alt="" className="h-10 w-10 object-contain" /> : <Icon className="h-5 w-5 text-[#d0d1d5]" />}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-[15px] font-semibold capitalize">{h.game}</div>
                    <div className="mt-1 text-[13px] text-[#aeb0b6]">
                      Bet {fmt(h.bet)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-semibold tabular-nums",
                      won ? "text-[#7cdca0]" : "text-[#eaa0a4]",
                    )}
                  >
                    {won ? "+" : "-"}
                    {fmt(won ? h.result : h.bet)}
                    <Coin className="h-4 w-4" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>}
    </div>
  )
}

function ProfileMetric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="min-w-0 rounded-[22px] bg-[#505258] px-3 py-3 text-center"><div className="flex items-center justify-center gap-1.5 text-[25px] font-bold leading-tight tabular-nums">{icon}<span className="truncate">{value}</span></div><div className="mt-1 text-[13px] font-medium text-[#b7b9bf]">{label}</div></div>
}

function ProfileTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Layers3; label: string }) {
  return <button onClick={onClick} aria-pressed={active} className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-[17px] px-1 text-[13px] font-semibold transition-colors sm:text-sm", active ? "bg-[#2b6eff] text-white" : "text-[#b7b9bf] hover:text-white")}><Icon className="hidden h-[17px] w-[17px] min-[440px]:block" />{label}</button>
}
