"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, Gem, Zap, Loader2, Gift as GiftIcon, Copy, Check, ChevronLeft } from "lucide-react"
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react"
import {
  addDemoBalance,
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
import { starsToGram, tonToStars } from "@/lib/deposit-shared"

type Method = "stars" | "ton" | "gifts" | "demo"

export function DepositView({
  starPacks,
  tonPacks,
  tonRate,
  giftCatalog,
  relayer,
}: {
  starPacks: number[]
  tonPacks: number[]
  tonRate: number
  giftCatalog: DepositGift[]
  relayer: RelayerInfo
}) {
  const { me, setBalance, refresh } = useUser()
  const [method, setMethod] = useState<Method>("stars")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [giftIntent, setGiftIntent] = useState<{ code: string; giftName: string; value: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [starAmount, setStarAmount] = useState(starPacks.includes(250) ? 250 : starPacks[0] ?? 50)
  const [tonAmount, setTonAmount] = useState(tonPacks[0] ?? 1.77)
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()

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

  async function handleDemo(amount: number) {
    setBusy(true)
    haptic("medium")
    try {
      const res = await addDemoBalance(amount)
      setBalance(res.balance)
      notify("ok", `Added ${fmt(amount)} to your balance`)
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
      refresh()
    }
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
    <div className="mx-auto flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-86px)] w-full max-w-[620px] flex-col px-1 pb-[max(1rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <header className="relative flex flex-col items-center pt-2">
        <Link href="/" className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#111419] text-white/70 ring-1 ring-white/[.06] transition hover:text-white"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="font-display text-2xl font-black md:text-3xl">Balance replenishment</h1>
        <div className={cn("mt-5 grid w-full max-w-[560px] gap-1 rounded-[22px] bg-[#3b3f46] p-1.5", me?.isDemo ? "grid-cols-4" : "grid-cols-3")}>
          <Tab active={method === "stars"} onClick={() => setMethod("stars")} icon={Sparkles} label="Stars" />
          <Tab active={method === "ton"} onClick={() => setMethod("ton")} icon={Gem} label="TON" />
          <Tab active={method === "gifts"} onClick={() => setMethod("gifts")} icon={GiftIcon} label="Gifts" />
          {me?.isDemo && <Tab active={method === "demo"} onClick={() => setMethod("demo")} icon={Zap} label="Demo" />}
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

      {method === "stars" && <DepositAmountPane amount={starAmount} detail={`Telegram invoice · +${fmt(starsToGram(starAmount))} balance`} />}

      {method === "ton" && <DepositAmountPane amount={tonToStars(tonAmount)} eyebrow={wallet ? "Wallet connected" : "Connect wallet"} detail={`≈ ${tonAmount} TON · 1 TON = ${fmt(tonRate)} Stars`} />}

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

      {method === "demo" && me?.isDemo && (
        <DepositAmountPane amount={starAmount} eyebrow="Demo balance" detail="No payment · development accounts only" />
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Processing…
        </div>
      )}

      {method !== "gifts" && <footer className="mt-auto border-t border-white/[.06] bg-[#171a20]/96 pt-3 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
          {(method === "ton" ? tonPacks : method === "demo" ? [100, 500, 2500] : starPacks).map((value) => {
            const active = method === "ton" ? tonAmount === value : starAmount === value
            return <button key={value} onClick={() => method === "ton" ? setTonAmount(value) : setStarAmount(value)} className={cn("min-w-[104px] flex-1 rounded-[18px] px-3 py-3 text-sm font-black transition", active ? "bg-white/18 text-white ring-1 ring-white/15" : "bg-[#3d4149] text-white/72 hover:bg-[#484d56]")}>+{fmt(value)}</button>
          })}
        </div>
        <button onClick={() => method === "stars" ? handleStars(starAmount) : method === "ton" ? handleTon(tonAmount) : handleDemo(starAmount)} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f70ff] py-4 font-display text-lg font-black shadow-[0_6px_0_#1945b9,0_16px_30px_-14px_rgba(47,112,255,.65)] transition active:translate-y-0.5 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : method === "ton" ? wallet ? `Top up ${tonAmount} TON` : "Connect TON wallet" : method === "demo" ? `Add ${fmt(starAmount)} demo Stars` : `Top up ${fmt(starAmount)} Stars`}</button>
        <p className="mt-3 text-center text-[10px] text-white/28">{method === "stars" ? "Credited after Telegram confirms the invoice" : method === "ton" ? "Sent to the configured project treasury and verified on-chain" : "Instant demo credit"}</p>
      </footer>}
    </div>
  )
}

function DepositAmountPane({ amount, eyebrow, detail }: { amount: number; eyebrow?: string; detail: string }) {
  return <section className="flex flex-1 flex-col items-center justify-center py-12 text-center md:min-h-[430px]"><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/65">{eyebrow ?? "Telegram Stars"}</span><div className="mt-5 flex items-center gap-3"><span className="font-display text-7xl font-black tabular-nums md:text-8xl">{fmt(amount)}</span><Coin className="h-16 w-16 md:h-20 md:w-20" /></div><div className="mt-4 text-sm font-bold text-[#4f7fff]">{detail}</div></section>
}

function Tab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Sparkles
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold transition-all",
        active ? "bg-primary text-white shadow-[0_4px_0_#1938a8]" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
