"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()
  const displayName = me?.username ? `@${me.username}` : me?.firstName ?? "Guest"

  return (
    <header className="glass sticky top-0 z-40 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar key={me?.photoUrl ?? me?.id ?? "guest"} photoUrl={me?.photoUrl} name={me?.firstName} />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-sm font-bold">{title ?? "Giftlys"}</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {displayName}
              {me?.isDemo ? " · demo" : ""}
            </div>
          </div>
        </div>

        <Link
          href="/deposit"
          aria-label={`Balance ${fmt(me?.balance ?? 0)}. Add funds`}
          className="flex max-w-[48%] shrink-0 items-center gap-2 rounded-full border border-border bg-secondary/60 py-1.5 pl-3 pr-1.5 transition-colors hover:bg-secondary"
        >
          <Coin className="size-4 shrink-0" />
          <span className="truncate font-mono text-sm font-bold tabular-nums">
            {isLoading ? "…" : fmt(me?.balance ?? 0)}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus aria-hidden="true" strokeWidth={3} />
          </span>
        </Link>
      </div>
    </header>
  )
}

function UserAvatar({ photoUrl, name }: { photoUrl?: string | null; name?: string | null }) {
  const [hasError, setHasError] = useState(false)
  const initial = (name?.trim().charAt(0) || "G").toUpperCase()

  if (!photoUrl || hasError) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-xs font-bold text-secondary-foreground ring-1 ring-border"
        aria-label={`${name ?? "Guest"} avatar`}
      >
        {initial}
      </span>
    )
  }

  return (
    // Telegram profile photos are signed remote URLs and should be requested
    // without crossOrigin, otherwise browsers can reject an otherwise valid image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={`${name ?? "User"} avatar`}
      className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  )
}
