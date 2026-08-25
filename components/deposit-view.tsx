"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { Loader2, Gift as GiftIcon, Copy, Check, ChevronLeft } from "lucide-react"
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react"
import {
  createStarsInvoice,
  createTonIntent,
  verifyTonDeposit,
} from "@/app/actions/deposit"
import {
  createGiftDepositIntent,
  type DepositGift,
  type RelayerInfo,
} from "@/app/actions/gifts-transfer"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { getWebApp, haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Method = "stars" | "ton" | "gifts"

export function DepositView({
  tonRate,
  giftCatalog,
  relayer,
}: {
  tonRate: number
  giftCatalog: DepositGift[]
  relayer: RelayerInfo
}) {
  const { setBalance, refresh } = useUser()
  const [method, setMethod] = useState<Method>("ton")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [giftIntent, setGiftIntent] = useState<{ code: string; giftName: string; value: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [amountText, setAmountText] = useState("200")
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const starAmount = amountText ? Number(amountText) : 0
  const tonAmount = starAmount > 0 ? Number((starAmount / tonRate).toFixed(4)) : 0

  async function handleGiftDeposit(slug: string) {
    setBusy(true)
    haptic("medium")
    try {
      const intent = await createGiftDepositIntent(slug)
      setGiftIntent({ code: intent.code, giftName: intent.giftName, value: intent.value })
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Could not start gift deposit")
    } finally {
      setBusy(false)
    }
  }

  function notify(type: "ok" | "err", text: string) {
    setMsg({ type, text })
    hapticNotify(type === "ok" ? "success" : "error")
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleStars(stars: number) {
    setBusy(true)
    haptic("medium")
    try {
      const { link } = await createStarsInvoice(stars)
      const wa = getWebApp()
      if (wa?.openInvoice) {
        wa.openInvoice(link, (status) => {
          if (status === "paid") {
            notify("ok", "Payment received! Balance will update shortly.")
            setTimeout(refresh, 1500)
          } else {
            notify("err", `Payment ${status}`)
          }
        })
      } else {
        window.open(link, "_blank")
        notify("ok", "Invoice opened in a new tab")
      }
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Stars not configured")
    } finally {
      setBusy(false)
    }
  }

  async function handleTon(ton: number) {
    setBusy(true)
    haptic("medium")
    try {
      if (!wallet) {
        await tonConnectUI.openModal()
        setBusy(false)
        return
      }
      const intent = await createTonIntent(ton)
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: intent.receiver,
            amount: intent.amountNano,
            payload: undefined,
          },
        ],
      })
      notify("ok", "Transaction sent. Verifying on-chain…")
      // Poll verification a few times.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const res = await verifyTonDeposit(intent.transactionId)
        if (res.status === "completed") {
          if (res.balance != null) setBalance(res.balance)
          notify("ok", `Deposited ${ton} TON → ${fmt(intent.credited)}`)
          break
        }
      }
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "TON deposit failed")
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-118px)] w-full max-w-[620px] flex-col px-1 pb-[max(1rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <header className="relative flex flex-col items-center pt-2">
        <Link href="/" aria-label="Back" className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#111419] text-white/70 transition hover:text-white"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="px-12 font-display text-2xl font-black md:px-0 md:text-3xl"><span className="md:hidden">Balance</span><span className="hidden md:inline">Balance replenishment</span></h1>
        <div className="mt-5 grid w-full max-w-[560px] grid-cols-3 gap-1 rounded-[22px] bg-[#3b3f46] p-1.5">
          <Tab active={method === "ton"} onClick={() => setMethod("ton")} icon={<img src="/icons/ton.svg" alt="" className="h-5 w-5" />} label="TON" />
          <Tab active={method === "stars"} onClick={() => setMethod("stars")} icon={<Coin className="h-5 w-5" />} label="Stars" />
          <Tab active={method === "gifts"} onClick={() => setMethod("gifts")} icon={<GiftIcon className="h-5 w-5 text-[#ff6fbd]" />} label="Gifts" />
        </div>
      </header>

      {msg && (
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-center text-xs font-medium",
            msg.type === "ok" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
          )}
        >
          {msg.text}
        </div>
      )}

      {(method === "stars" || method === "ton") && (
        <DepositAmountPane
          value={amountText}
          onChange={(value) => {
            const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 5)
            setAmountText(digits && Number(digits) > 10_000 ? "10000" : digits)
          }}
          detail={method === "ton" && tonAmount > 0 ? `≈ ${tonAmount} TON` : undefined}
        />
      )}

      {method === "gifts" && (
        <div className="flex flex-1 flex-col pt-7">
          {giftIntent ? (
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 rounded-[30px] bg-[#3b3f46] p-5 ring-1 ring-white/10">
              <div className="text-center">
                <div className="font-display text-lg font-black text-primary">Send your gift to the relayer</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Transfer your <span className="font-bold text-foreground">{giftIntent.giftName}</span> Telegram gift to
                  {relayer.username ? (
                    <>
                      {" "}
                      <span className="font-bold text-foreground">@{relayer.username}</span>
                    </>
                  ) : (
                    " our relayer account"
                  )}{" "}
                  with the code below in the message. You&apos;ll be credited{" "}
                  <span className="inline-flex items-center gap-0.5 font-bold text-foreground">
                    {fmt(giftIntent.value)} <Coin className="h-3 w-3" />
                  </span>
                  Stars.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(giftIntent.code)
                  setCopied(true)
                  haptic("light")
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-mono text-lg font-black tracking-widest"
              >
                {giftIntent.code}
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                {relayer.automated
                  ? "Your deposit is detected automatically and credited within a minute."
                  : "Deposits are reviewed and credited shortly after the gift arrives."}
              </p>
              <button
                onClick={() => setGiftIntent(null)}
                className="rounded-xl bg-secondary py-2.5 text-sm font-bold transition-colors hover:bg-secondary/70"
              >
                Deposit another gift
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto w-full max-w-[560px] rounded-[30px] bg-[#3b3f46] p-5 text-center ring-1 ring-white/[.07]"><h2 className="font-display text-2xl font-black">Add a gift</h2><p className="mx-auto mt-1 max-w-sm text-sm text-white/45">Then keep it in your collection, use it for an upgrade or sell it for Stars.</p><button onClick={() => document.getElementById("deposit-gifts")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 w-full rounded-[20px] bg-[#2f70ff] py-4 text-lg font-black shadow-[0_5px_0_#1945b9]">Add</button></div>
              {giftCatalog.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No gifts available yet.</p>
              ) : (
                <div id="deposit-gifts" className="mx-auto mt-5 grid w-full max-w-[560px] scroll-mt-5 grid-cols-3 gap-x-2 gap-y-5 rounded-[30px] bg-[#363a42] p-4 ring-1 ring-white/[.07]">
                  {giftCatalog.map((g) => {
                    return (
                      <button
                        key={g.slug}
                        onClick={() => handleGiftDeposit(g.slug)}
                        disabled={busy}
                        className="group flex min-w-0 flex-col items-center text-center transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.imageUrl || "/images/nft-gift.png"} alt={g.name} className="h-20 w-20 object-contain drop-shadow-[0_9px_11px_rgba(0,0,0,.45)] transition-transform group-hover:scale-105 md:h-24 md:w-24" />
                        <span className="mt-1 flex w-full items-center justify-center gap-1 rounded-full bg-white/10 px-2 py-2 text-xs font-black text-white"><Coin className="h-4 w-4" />{fmt(g.value)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Processing…
        </div>
      )}

      {method !== "gifts" && <footer className="mt-auto bg-[#171a20]/96 pt-3">
        <div className="grid grid-cols-3 gap-3 pb-3">
          {[500, 2000, 5000].map((value) => {
            const active = starAmount === value
            return <button key={value} onClick={() => setAmountText(String(value))} className={cn("rounded-[18px] bg-[#50535a] px-3 py-3 text-sm font-black text-white transition", active && "bg-[#656971]")}>+{fmt(value)}</button>
          })}
        </div>
        <button onClick={() => method === "stars" ? handleStars(starAmount) : handleTon(tonAmount)} disabled={busy || starAmount < 1 || starAmount > 10_000} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f70ff] py-4 font-display text-lg font-black transition active:scale-[.99] disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : method === "ton" ? wallet ? `Top up ${tonAmount} TON` : "Connect wallet" : `Top up ${fmt(starAmount)} Stars`}</button>
      </footer>}
    </div>
  )
}

function DepositAmountPane({ value, onChange, detail }: { value: string; onChange: (value: string) => void; detail?: string }) {
  return <section className="flex min-h-[220px] flex-1 flex-col items-center justify-center py-8 text-center"><div className="flex w-full items-center justify-center gap-3"><input aria-label="Stars amount" type="text" inputMode="numeric" enterKeyHint="done" pattern="[0-9]*" autoComplete="off" spellCheck={false} maxLength={5} value={value} onChange={(event) => onChange(event.target.value)} onFocus={(event) => event.currentTarget.select()} placeholder="0" className="min-w-0 max-w-[76%] bg-transparent text-right font-display text-7xl font-black tabular-nums text-white caret-[#2f70ff] outline-none placeholder:text-white/20 md:text-8xl" style={{ width: `${Math.max(1, value.length) + 0.45}ch` }} /><Coin className="h-16 w-16 md:h-20 md:w-20" /></div>{detail && <div className="mt-4 text-sm font-bold text-white/42">{detail}</div>}</section>
}

function Tab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold transition-all",
        active ? "bg-[#2f70ff] text-white" : "text-white/65",
      )}
    >
      {Icon}
      {label}
    </button>
  )
}
