"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Ban, Loader2, PackageX, Search, ShieldPlus, WalletCards } from "lucide-react"
import { creditBalance, getUserRestrictions, setUserRestriction, type UserRestrictionState } from "@/app/actions/admin"
import { fmt } from "@/lib/format"

export function AdminPanel() {
  const [telegramId, setTelegramId] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [moderationId, setModerationId] = useState("")
  const [moderationBusy, setModerationBusy] = useState(false)
  const [moderationMessage, setModerationMessage] = useState<string | null>(null)
  const [moderationUser, setModerationUser] = useState<UserRestrictionState | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await creditBalance(telegramId, Number(amount))
      setMessage(`Added ${fmt(result.amount)} to ${result.name}. New balance: ${fmt(result.balance)}`)
      setAmount("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update balance")
    } finally {
      setBusy(false)
    }
  }

  async function findUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setModerationBusy(true)
    setModerationMessage(null)
    try {
      setModerationUser(await getUserRestrictions(moderationId))
    } catch (error) {
      setModerationUser(null)
      setModerationMessage(error instanceof Error ? error.message : "Could not find user")
    } finally {
      setModerationBusy(false)
    }
  }

  async function toggleRestriction(kind: "casino" | "nft-withdrawals", blocked: boolean) {
    if (!moderationUser) return
    setModerationBusy(true)
    setModerationMessage(null)
    try {
      const updated = await setUserRestriction(moderationUser.id, kind, blocked)
      setModerationUser(updated)
      setModerationMessage(`${kind === "casino" ? "Casino access" : "NFT withdrawals"} ${blocked ? "blocked" : "unblocked"} for ${updated.name}.`)
    } catch (error) {
      setModerationMessage(error instanceof Error ? error.message : "Could not update restrictions")
    } finally {
      setModerationBusy(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="rounded-xl bg-secondary p-2 text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div><h1 className="font-display text-2xl font-black">Admin panel</h1><p className="text-xs text-muted-foreground">Users, restrictions and balances</p></div>
      </div>
      <section className="mb-4 rounded-[26px] bg-[#292d34] p-4 ring-1 ring-rose-300/15">
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-rose-500/15 p-2 text-rose-300"><Ban className="h-5 w-5" /></div><div><h2 className="font-display font-bold">User restrictions</h2><p className="text-xs text-white/40">Find a user by Telegram ID.</p></div></div>
        <form onSubmit={findUser} className="flex gap-2">
          <input value={moderationId} onChange={(event) => setModerationId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Telegram ID" required className="min-w-0 flex-1 rounded-xl bg-black/20 px-3 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#5f88ff]" />
          <button disabled={moderationBusy} aria-label="Find user" className="flex w-12 items-center justify-center rounded-xl bg-[#3674ff] disabled:opacity-50">{moderationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
        </form>
        {moderationUser && <div className="mt-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/[.06]"><div className="mb-3"><b className="block text-sm">{moderationUser.name}</b><span className="font-mono text-[10px] text-white/35">{moderationUser.username ? `@${moderationUser.username} · ` : ""}{moderationUser.id}</span></div><div className="space-y-2"><RestrictionRow icon={<PackageX className="h-4 w-4" />} title="NFT withdrawals" blocked={moderationUser.nftWithdrawalsBlocked} busy={moderationBusy} onToggle={() => toggleRestriction("nft-withdrawals", !moderationUser.nftWithdrawalsBlocked)} /><RestrictionRow icon={<Ban className="h-4 w-4" />} title="Casino access" blocked={moderationUser.casinoBlocked} busy={moderationBusy} onToggle={() => toggleRestriction("casino", !moderationUser.casinoBlocked)} /></div></div>}
        {moderationMessage && <p className="mt-3 rounded-xl bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-white/50">{moderationMessage}</p>}
      </section>
      <section className="card-premium rounded-2xl border border-primary/25 p-4">
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-primary/15 p-2 text-primary"><ShieldPlus className="h-5 w-5" /></div><div><h2 className="font-display font-bold">Add balance</h2><p className="text-xs text-muted-foreground">The user must have opened the bot first.</p></div></div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold">Telegram ID<input value={telegramId} onChange={(e) => setTelegramId(e.target.value)} inputMode="numeric" placeholder="e.g. 123456789" required className="mt-1.5 w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm outline-none ring-primary/40 focus:ring-2" /></label>
          <label className="text-xs font-semibold">Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="e.g. 500" required className="mt-1.5 w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm outline-none ring-primary/40 focus:ring-2" /></label>
          <button disabled={busy} className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}Add balance</button>
        </form>
        {message && <p className="mt-3 rounded-xl bg-secondary px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{message}</p>}
      </section>
    </>
  )
}

function RestrictionRow({ icon, title, blocked, busy, onToggle }: { icon: React.ReactNode; title: string; blocked: boolean; busy: boolean; onToggle: () => void }) {
  return <div className="flex items-center gap-3 rounded-xl bg-white/[.045] p-2.5"><span className={blocked ? "text-rose-300" : "text-emerald-300"}>{icon}</span><div className="min-w-0 flex-1"><b className="block text-xs">{title}</b><span className={blocked ? "text-[9px] font-bold text-rose-300/70" : "text-[9px] font-bold text-emerald-300/70"}>{blocked ? "BLOCKED" : "ALLOWED"}</span></div><button type="button" disabled={busy} onClick={onToggle} className={blocked ? "rounded-lg bg-emerald-400 px-3 py-2 text-[10px] font-black text-emerald-950 disabled:opacity-50" : "rounded-lg bg-rose-500 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"}>{blocked ? "Unblock" : "Block"}</button></div>
}
