"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { LanguageSwitcher } from "@/components/language-switcher"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarUrl = !avatarFailed ? me?.photoUrl : null

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[.06] bg-[#181a1e]/90 px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[620px] items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2.5">
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
            <div className="font-display text-base font-black tracking-tight">{title ?? "Giftlys"}</div>
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
