"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Link2Off, Loader2, Wallet } from "lucide-react"
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react"
import { linkTonWallet, unlinkTonWallet } from "@/app/actions/wallet"
import { haptic } from "@/lib/telegram-webapp"

export function TonWalletCard({ linkedAddress }: { linkedAddress: string | null }) {
  const wallet = useTonWallet()
  const [tonConnectUI] = useTonConnectUI()
  const [saved, setSaved] = useState(linkedAddress)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const connectedAddress = wallet?.account.address ?? null

  useEffect(() => {
    if (!connectedAddress || connectedAddress === saved) return
    let active = true
    setBusy(true)
    linkTonWallet(connectedAddress)
      .then(({ address }) => {
        if (active) setSaved(address)
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [connectedAddress, saved])

  async function disconnect() {
    setBusy(true)
    haptic("medium")
    try {
      await unlinkTonWallet()
      if (wallet) await tonConnectUI.disconnect()
      setSaved(null)
    } finally {
      setBusy(false)
    }
  }

  function short(address: string) {
    return `${address.slice(0, 6)}…${address.slice(-6)}`
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-black">TON wallet</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {saved ? "Linked to your Telegram account" : "Connect for deposits and payouts"}
            </p>
          </div>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>

      {saved ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-2">
          <code className="min-w-0 flex-1 truncate px-1 text-xs font-bold text-foreground">{short(saved)}</code>
          <button
            type="button"
            aria-label="Copy wallet address"
            onClick={() => {
              navigator.clipboard?.writeText(saved)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-muted-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Unlink TON wallet"
            disabled={busy}
            onClick={disconnect}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-rose-400 disabled:opacity-50"
          >
            <Link2Off className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => tonConnectUI.openModal()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          Connect TON wallet
        </button>
      )}
    </section>
  )
}
