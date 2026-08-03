"use client"

import Link from "next/link"
import { useState } from "react"
import { Gift, Plus } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { LanguageSwitcher } from "@/components/language-switcher"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarUrl = !avatarFailed ? me?.photoUrl : null

  return (
    <header className="sticky top-0 z-40 px-3 pt-2">
      <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-card/90 px-3 py-2.5 shadow-[0_8px_0_-5px_rgba(30,12,58,.8),0_12px_26px_-18px_rgba(0,0,0,.9)] backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_0_rgb(151,92,28)]"><Gift className="h-5 w-5" /></div>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full ring-2 ring-white/20"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
              {(me?.firstName?.[0] ?? "G").toUpperCase()}
            </div>
          )}
          <div className="leading-tight">
            <div className="font-display text-sm font-black tracking-tight">{title ?? "Giftly Club"}</div>
            <div className="text-[10px] text-muted-foreground">
              {me?.username ? `@${me.username}` : me?.firstName ?? "Guest"}
              {me?.isDemo ? " · demo" : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <Link
          href="/deposit"
          className="flex items-center gap-2 rounded-2xl border border-white/12 bg-secondary/75 py-1.5 pl-3 pr-1.5 transition-colors active:scale-95"
        >
          <Coin className="h-4 w-4" />
          <span className="font-mono text-sm font-bold tabular-nums">
            {isLoading ? "…" : fmt(me?.balance ?? 0)}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </span>
        </Link>
        </div>
      </div>
    </header>
  )
}
