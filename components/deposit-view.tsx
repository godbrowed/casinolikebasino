"use client"

import { useState } from "react"
import { Sparkles, Gem, Zap, Loader2, Gift as GiftIcon, Copy, Check } from "lucide-react"
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
import { rarityOf, fmt } from "@/lib/format"
import { getWebApp, haptic, hapticNotify } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"
import { starsToGram } from "@/lib/deposit-shared"

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
    <>
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-[30px] border border-blue-300/20 bg-[linear-gradient(145deg,#2458d3,#13255c)] p-5 shadow-[0_9px_0_-5px_rgba(0,0,0,.6)]">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <div className="relative text-[10px] font-black uppercase tracking-[.16em] text-white/55">Current balance</div>
        <div className="mt-1 flex items-center gap-2">
          <Coin className="h-6 w-6" />
          <span className="font-display text-3xl font-black tabular-nums">{fmt(me?.balance ?? 0)}</span>
          <span className="mb-0.5 self-end text-sm font-bold text-muted-foreground">GRAM</span>
        </div>
      </div>

      {/* Method tabs */}
      <div className={cn("grid gap-1.5 rounded-3xl border border-white/10 bg-[#282b32] p-1.5", me?.isDemo ? "grid-cols-4" : "grid-cols-3")}>
        <Tab active={method === "stars"} onClick={() => setMethod("stars")} icon={Sparkles} label="Stars" />
        <Tab active={method === "ton"} onClick={() => setMethod("ton")} icon={Gem} label="TON" />
        <Tab active={method === "gifts"} onClick={() => setMethod("gifts")} icon={GiftIcon} label="Gifts" />
        {me?.isDemo && <Tab active={method === "demo"} onClick={() => setMethod("demo")} icon={Zap} label="Demo" />}
      </div>

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

      {method === "stars" && (
        <Grid>
          {starPacks.map((s) => (
            <PackButton key={s} onClick={() => handleStars(s)} disabled={busy}>
              <Sparkles className="h-5 w-5 text-amber-300" />
              <span className="flex items-center gap-1 font-display text-lg font-black">
                <Coin className="h-4 w-4" />
                {fmt(s)}
              </span>
              <span className="text-[11px] text-muted-foreground">{s} Stars</span>
              <span className="flex items-center gap-1 text-[11px] text-cyan-300"><Coin className="h-3 w-3" />+{fmt(starsToGram(s))}</span>
            </PackButton>
          ))}
        </Grid>
      )}

      {method === "ton" && (
        <>
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
            {wallet ? (
              <span className="text-emerald-300">Wallet connected — pick an amount</span>
            ) : (
              "Connect your TON wallet to deposit GRAM"
            )}
          </div>
          <Grid>
            {tonPacks.map((t) => (
              <PackButton key={t} onClick={() => handleTon(t)} disabled={busy}>
                <Gem className="h-5 w-5 text-cyan-300" />
                <span className="font-display text-lg font-black">{t} TON</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Coin className="h-3 w-3" />+{fmt(Math.round(t * tonRate))}
                </span>
              </PackButton>
            ))}
          </Grid>
        </>
      )}

      {method === "gifts" && (
        <>
          {giftIntent ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
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
                  .
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
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
                Deposit a real Telegram NFT gift and get its value in GRAM. Pick the gift you&apos;re sending.
              </div>
              {giftCatalog.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No gifts available yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {giftCatalog.map((g) => {
                    const r = rarityOf(g.rarity)
                    return (
                      <button
                        key={g.slug}
                        onClick={() => handleGiftDeposit(g.slug)}
                        disabled={busy}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-2 text-center ring-1 transition-transform active:scale-95 disabled:opacity-50",
                          r.ring,
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.imageUrl || "/images/nft-gift.png"} alt={g.name} className="h-12 w-12 object-contain" />
                        <span className={cn("truncate text-[11px] font-semibold", r.text)}>{g.name}</span>
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Coin className="h-2.5 w-2.5" /> {fmt(g.value)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {method === "demo" && me?.isDemo && (
        <>
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
            Demo mode: top up instantly to try every game. No real payment.
          </div>
          <Grid>
            {[100, 500, 2500].map((a) => (
              <PackButton key={a} onClick={() => handleDemo(a)} disabled={busy}>
                <Zap className="h-5 w-5 text-fuchsia-300" />
                <span className="flex items-center gap-1 font-display text-lg font-black">
                  <Coin className="h-4 w-4" />
                  {fmt(a)}
                </span>
                <span className="text-[11px] text-muted-foreground">free demo</span>
              </PackButton>
            ))}
          </Grid>
        </>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Processing…
        </div>
      )}
    </>
  )
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>
}

function PackButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-3xl border border-white/10 bg-[#282b32] py-4 shadow-[0_7px_0_-5px_rgba(0,0,0,.7)] transition-transform active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
