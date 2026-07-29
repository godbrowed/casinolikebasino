"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ShieldPlus, WalletCards } from "lucide-react"
import { creditBalance } from "@/app/actions/admin"
import { fmt } from "@/lib/format"

export function AdminPanel() {
  const [telegramId, setTelegramId] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="rounded-xl bg-secondary p-2 text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div><h1 className="font-display text-2xl font-black">Admin panel</h1><p className="text-xs text-muted-foreground">Balance management</p></div>
      </div>
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
