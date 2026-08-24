"use client"

import { useState } from "react"
import { Sparkles, Gem, Zap, Loader2, Gift as GiftIcon, Copy, Check, ShieldCheck } from "lucide-react"
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
      <div className="flex flex-col items-center gap-4 pt-2">
        <h1 className="font-display text-2xl font-black">Balance replenishment</h1>
        <div className={cn("grid w-full max-w-[560px] gap-1 rounded-3xl bg-[#3a3d43] p-1.5", me?.isDemo ? "grid-cols-4" : "grid-cols-3")}>
          <Tab active={method === "stars"} onClick={() => setMethod("stars")} icon={Sparkles} label="Stars" />
          <Tab active={method === "ton"} onClick={() => setMethod("ton")} icon={Gem} label="TON" />
          <Tab active={method === "gifts"} onClick={() => setMethod("gifts")} icon={GiftIcon} label="Gifts" />
          {me?.isDemo && <Tab active={method === "demo"} onClick={() => setMethod("demo")} icon={Zap} label="Demo" />}
        </div>
      </div>

      <div className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-[30px] bg-[#23262b] ring-1 ring-white/8">
        <img src="/images/puggift-mascot-web-v1.webp" alt="" className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full object-cover opacity-[.09]" />
        <div className="relative rounded-full bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-white/45">Current balance</div>
        <div className="relative mt-3 flex items-center gap-2"><span className="font-display text-6xl font-black tabular-nums">{fmt(me?.balance ?? 0)}</span><Coin className="h-12 w-12" /></div>
        <div className="relative mt-1 text-xs font-bold text-white/35">PugGift Stars</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-blue-300/15 bg-blue-400/8 px-3 py-2 text-[10px]"><span className="flex items-center gap-1.5 font-bold text-blue-200"><ShieldCheck className="h-3.5 w-3.5" />Transparent rate</span><span className="text-white/60">1 TON = {fmt(tonRate)} Stars</span></div>

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
              <span className="text-[11px] text-muted-foreground">Telegram invoice</span>
              <span className="flex items-center gap-1 text-[11px] text-amber-300">+{fmt(starsToGram(s))} balance</span>
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
              "Connect your TON wallet to buy Stars"
            )}
          </div>
          <Grid>
            {tonPacks.map((t) => (
              <PackButton key={t} onClick={() => handleTon(t)} disabled={busy}>
                <Gem className="h-5 w-5 text-cyan-300" />
                <span className="font-display text-lg font-black">{t} TON</span>
                <span className="flex items-center gap-1 text-[11px] text-amber-300">
                  <Coin className="h-3 w-3" />+{fmt(tonToStars(t))} Stars
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
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
                Deposit a real Telegram NFT gift and receive its live value in Stars. Pick the gift you&apos;re sending.
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

      <section className="rounded-[28px] border border-white/10 bg-[#282b32] p-4">
        <h2 className="font-display text-sm font-black">Where your deposit goes</h2>
        <div className="mt-3 flex flex-col gap-2 text-[11px] text-muted-foreground">
          <Route icon="⭐" title="Telegram Stars" text="Paid through an official Telegram invoice. The bot webhook credits the balance after Telegram confirms payment." />
          <Route icon="💎" title="TON" text="Sent from TON Connect to the project treasury configured in TON_RECEIVER_ADDRESS and verified on-chain before credit." />
          <Route icon="🎁" title="Telegram gifts" text={relayer.username ? `Sent to @${relayer.username} with your unique code${relayer.automated ? "; detection is automatic." : "; confirmation is currently manual."}` : "A RELAYER_USERNAME must be configured before real gift deposits can be accepted."} />
        </div>
      </section>
    </>
  )
}

function Route({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl bg-[#20232a] p-3"><span className="text-xl">{icon}</span><div><div className="font-bold text-white">{title}</div><div className="mt-0.5 leading-relaxed">{text}</div></div></div>
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
