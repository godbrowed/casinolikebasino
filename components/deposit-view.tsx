"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, ExternalLink, ShieldCheck } from "lucide-react"
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react"
import {
  createStarsInvoice,
  createTonIntent,
  verifyTonDeposit,
} from "@/app/actions/deposit"
import {
  cancelGiftDeposit,
  checkGiftDeposit,
  createGiftDepositIntent,
  type DepositGift,
  type RelayerInfo,
} from "@/app/actions/gifts-transfer"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { TON_DEPOSIT_BONUS_MULTIPLIER, TON_DEPOSIT_BONUS_PERCENT } from "@/lib/deposit-shared"
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
  const [giftIntent, setGiftIntent] = useState<{
    transactionId: number
    giftName: string
    value: number
    relayerUsername: string | null
    relayerUrl: string
  } | null>(null)
  const [amountText, setAmountText] = useState("200")
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const starAmount = amountText ? Number(amountText) : 0
  const tonAmount = starAmount > 0 ? Number((starAmount / tonRate).toFixed(4)) : 0
  const tonCreditedStars = Math.max(1, Math.round(starAmount * TON_DEPOSIT_BONUS_MULTIPLIER))

  async function handleGiftDeposit(slug: string) {
    setBusy(true)
    haptic("medium")
    try {
      const intent = await createGiftDepositIntent(slug)
      setGiftIntent({
        transactionId: intent.transactionId,
        giftName: intent.giftName,
        value: intent.value,
        relayerUsername: intent.relayerUsername,
        relayerUrl: intent.relayerUrl,
      })
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

  useEffect(() => {
    if (!giftIntent) return
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null
    const poll = async () => {
      try {
        const result = await checkGiftDeposit(giftIntent.transactionId)
        if (!active || !result.completed) return
        active = false
        if (timer) clearInterval(timer)
        setGiftIntent(null)
        notify("ok", `${giftIntent.giftName} was credited automatically`)
        refresh()
      } catch {
        // The background cron keeps checking too; temporary API/network errors
        // must not interrupt the transfer screen.
      }
    }
    void poll()
    timer = setInterval(poll, 6_000)
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [giftIntent?.transactionId])

  return (
    <div className="mx-auto flex min-h-[calc(var(--tg-viewport-stable-height,100dvh)-118px)] w-full max-w-[560px] flex-col pb-[max(1rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <header className="relative flex flex-col items-center pt-2">
        <h1 className="text-center text-[28px] font-bold leading-tight tracking-tight text-white">Balance replenishment</h1>
        <div className="mt-6 grid h-[60px] w-full grid-cols-3 rounded-[26px] bg-[#36383c]">
          <Tab active={method === "ton"} onClick={() => setMethod("ton")} icon={<img src="/icons/ton-network-v2.svg" alt="" className="h-6 w-6 shrink-0" />} label="TON" />
          <Tab active={method === "stars"} onClick={() => setMethod("stars")} icon={<Coin className="h-5 w-5" />} label="Stars" />
          <Tab active={method === "gifts"} onClick={() => setMethod("gifts")} icon={<img src="/images/menu/gift.svg" alt="" className="h-6 w-6 shrink-0 object-contain" />} label="Gifts" />
        </div>
      </header>

      {msg && (
        <div
          className={cn(
            "mt-4 rounded-2xl bg-[#36383c] px-4 py-3 text-center text-sm font-medium leading-relaxed",
            msg.type === "ok" ? "text-[#91deb0]" : "text-[#efa9ab]",
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
          bonus={method === "ton" && tonAmount > 0 ? `+ Bonus ${fmt(tonCreditedStars - starAmount)} Stars (${TON_DEPOSIT_BONUS_PERCENT}%)` : undefined}
          detail={method === "ton" && tonAmount > 0 ? `≈ ${tonAmount} TON` : undefined}
          connectWallet={method === "ton" && !wallet ? () => { void tonConnectUI.openModal() } : undefined}
          walletConnected={method === "ton" && Boolean(wallet)}
        />
      )}

      {method === "gifts" && (
        <div className="flex flex-1 flex-col pt-7">
          {giftIntent ? (
            <div className="mx-auto flex w-full flex-col gap-4 rounded-[28px] bg-[#36383c] p-5 sm:p-6">
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-4 h-9 w-9 text-[#aeb0b6]" strokeWidth={1.5} />
                <h2 className="text-[24px] font-bold leading-tight tracking-tight text-white">Send the gift to @{giftIntent.relayerUsername ?? "pugsrelayer"}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#aeb0b6]">
                  Transfer <span className="font-semibold text-white">{giftIntent.giftName}</span>{" "}from this Telegram account. PugGift will detect it and add the gift automatically.
                </p>
              </div>
              <a href={giftIntent.relayerUrl} target="_blank" rel="noreferrer" onClick={() => haptic("medium")} className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-[#2b6eff] px-3 py-3 text-base font-semibold text-white transition-colors hover:bg-[#3d7bff]"><ExternalLink className="h-5 w-5 shrink-0" />Open t.me/{giftIntent.relayerUsername ?? "pugsrelayer"}</a>
              <div className="flex items-center justify-center gap-2 rounded-[18px] bg-[#45474c] px-3 py-3 text-center text-[13px] font-medium leading-relaxed text-[#c2c4ca]"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Waiting for the transfer · value {fmt(giftIntent.value)} Stars</div>
              <p className="text-center text-[13px] leading-relaxed text-[#aeb0b6]">No code or Business Connection is needed. Keep the sender visible for instant matching; a private send is credited automatically only when it has one unambiguous pending owner.</p>
              <button
                onClick={async () => {
                  setBusy(true)
                  try {
                    await cancelGiftDeposit(giftIntent.transactionId)
                    setGiftIntent(null)
                  } finally {
                    setBusy(false)
                  }
                }}
                className="min-h-12 rounded-2xl bg-[#505258] px-3 py-3 text-sm font-semibold transition-colors hover:bg-[#5b5d63]"
              >
                Cancel · choose another gift
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto w-full rounded-[28px] bg-[#36383c] p-5 text-center sm:p-6"><h2 className="text-[28px] font-bold tracking-tight">Add a gift</h2><p className="mx-auto mt-2 max-w-sm text-[15px] leading-snug text-[#aeb0b6]">Send it to <a href={relayer.url} target="_blank" rel="noreferrer" className="font-semibold text-[#77a3ff] underline underline-offset-2">@{relayer.username ?? "pugsrelayer"}</a>, then keep it, upgrade it or sell it for Stars.</p><button onClick={() => document.getElementById("deposit-gifts")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 min-h-14 w-full rounded-[20px] bg-[#2b6eff] px-4 text-[18px] font-semibold transition-colors hover:bg-[#3d7bff]">Add</button></div>
              {giftCatalog.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#aeb0b6]">No gifts available yet.</p>
              ) : (
                <div id="deposit-gifts" className="mx-auto mt-6 grid w-full scroll-mt-5 grid-cols-3 gap-x-2 gap-y-5 rounded-[28px] bg-[#36383c] p-4 sm:gap-x-4 sm:p-5">
                  <h3 className="col-span-3 text-center text-[15px] font-semibold text-[#aeb0b6]">Available gifts</h3>
                  {giftCatalog.map((g) => {
                    return (
                      <button
                        key={g.slug}
                        onClick={() => handleGiftDeposit(g.slug)}
                        disabled={busy}
                        className="group flex min-w-0 flex-col items-center rounded-2xl text-center transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.imageUrl || "/images/nft-gift.png"} alt={g.name} className="h-24 w-full object-contain sm:h-28" />
                        <span className="mt-1 flex min-h-10 w-full items-center justify-center gap-1 rounded-full bg-[#505258] px-1 py-2 text-[13px] font-semibold text-white sm:text-sm"><Coin className="h-4 w-4 shrink-0" />{fmt(g.value)}</span>
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
        <div role="status" className="flex items-center justify-center gap-2 py-3 text-sm text-[#aeb0b6]">
          <Loader2 className="h-4 w-4 animate-spin" /> Processing…
        </div>
      )}

      {method !== "gifts" && <footer className="mt-auto pt-5">
        <div className="grid grid-cols-3 gap-2 pb-4 sm:gap-3">
          {[500, 2000, 5000].map((value) => {
            return <button key={value} onClick={() => setAmountText((current) => String(Math.min(10_000, Number(current || 0) + value)))} disabled={busy || starAmount >= 10_000} className="min-h-[50px] rounded-[19px] bg-[#4b4d52] px-2 py-3 text-base font-semibold text-white transition-colors hover:bg-[#585b61] disabled:opacity-50">+{fmt(value)}</button>
          })}
        </div>
        <button onClick={() => method === "stars" ? handleStars(starAmount) : handleTon(tonAmount)} disabled={busy || starAmount < 1 || starAmount > 10_000} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[24px] bg-[#2b6eff] px-4 py-4 text-[20px] font-semibold text-white transition-colors hover:bg-[#3d7bff] disabled:opacity-50 sm:min-h-[70px]">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : method === "ton" ? wallet ? `Top up ${tonAmount} TON` : "Connect wallet" : `Top up ${fmt(starAmount)} Stars`}</button>
      </footer>}
    </div>
  )
}

function DepositAmountPane({ value, onChange, bonus, detail, connectWallet, walletConnected }: { value: string; onChange: (value: string) => void; bonus?: string; detail?: string; connectWallet?: () => void; walletConnected?: boolean }) {
  return (
    <section className="flex min-h-[280px] flex-1 flex-col items-center justify-center py-10 text-center">
      {connectWallet ? <button onClick={connectWallet} className="mb-5 rounded-full bg-[#505258] px-4 py-1.5 text-sm font-semibold text-white">Connect wallet</button> : walletConnected ? <span className="mb-5 rounded-full bg-[#505258] px-4 py-1.5 text-sm font-semibold text-white">Wallet connected</span> : null}
      <div className="flex w-full items-center justify-center gap-3">
        <input aria-label="Stars amount" type="text" inputMode="numeric" enterKeyHint="done" pattern="[0-9]*" autoComplete="off" spellCheck={false} maxLength={5} value={value} onChange={(event) => onChange(event.target.value)} onFocus={(event) => event.currentTarget.select()} placeholder="0" className="min-w-0 max-w-[76%] bg-transparent text-right text-[72px] font-bold leading-none tabular-nums text-white caret-[#2b6eff] outline-none placeholder:text-white/25 sm:text-[88px]" style={{ width: `${Math.max(1, value.length) + 0.15}ch` }} />
        <Coin className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
      </div>
      {bonus && <div className="mt-5 text-[15px] font-semibold text-[#2b6eff] sm:text-base">{bonus}</div>}
      {detail && <div className="mt-2 text-[15px] text-[#989ba2] sm:text-base">{detail}</div>}
    </section>
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
  icon: ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-[60px] items-center justify-center gap-2 rounded-[26px] px-2 text-[15px] font-semibold transition-colors sm:text-base",
        active ? "bg-[#2b6eff] text-white" : "text-[#e4e5e8] hover:bg-white/[.04]",
      )}
    >
      {Icon}
      {label}
    </button>
  )
}
