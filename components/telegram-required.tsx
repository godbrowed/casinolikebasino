"use client"

import { ExternalLink, ShieldCheck } from "lucide-react"
import { Coin } from "@/components/coin"

type TelegramRequiredProps = {
  botUsername: string | null
}

export function TelegramRequired({ botUsername }: TelegramRequiredProps) {
  const username = botUsername?.replace(/^@/, "")
  const destination = typeof window !== "undefined" ? window.location.pathname.replace(/^\//, "") : ""
  const telegramUrl = username
    ? `https://t.me/${username}?startapp=${encodeURIComponent(destination || "home")}`
    : "https://t.me"

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground">
      <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 shadow-[0_0_32px_hsl(var(--primary)/0.18)]">
          <Coin className="h-12 w-12" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Telegram Mini App</p>
          <h1 className="font-display text-3xl font-black text-balance">Open Giftlys in Telegram</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your account is securely connected to your Telegram profile. Open the app through Telegram to continue.
          </p>
        </div>
        <a
          href={telegramUrl}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.25)] transition-transform active:scale-[0.98]"
        >
          Open in Telegram
          <ExternalLink className="h-4 w-4" />
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Telegram verification is required
        </div>
      </section>
    </main>
  )
}
