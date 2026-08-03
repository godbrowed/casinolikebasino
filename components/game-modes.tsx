"use client"

import Link from "next/link"
import { Package, Swords, Rocket, TrendingUp } from "lucide-react"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const MODES = [
  {
    href: "/",
    label: "Cases",
    tag: "Open & win",
    icon: Package,
    glow: "shadow-cyan-500/30",
    ring: "ring-cyan-400/40",
    from: "from-cyan-500/25",
    text: "text-cyan-300",
  },
  {
    href: "/battles",
    label: "Battles",
    tag: "PvP · 1v1",
    icon: Swords,
    glow: "shadow-fuchsia-500/30",
    ring: "ring-fuchsia-400/40",
    from: "from-fuchsia-500/25",
    text: "text-fuchsia-300",
    hot: true,
  },
  {
    href: "/crash",
    label: "Crash",
    tag: "Cash out",
    icon: Rocket,
    glow: "shadow-rose-500/30",
    ring: "ring-rose-400/40",
    from: "from-rose-500/25",
    text: "text-rose-300",
  },
  {
    href: "/upgrade",
    label: "Upgrade",
    tag: "Level up",
    icon: TrendingUp,
    glow: "shadow-amber-500/30",
    ring: "ring-amber-400/40",
    from: "from-amber-500/25",
    text: "text-amber-300",
  },
]

export function GameModes() {
  return (
    <section className="px-4">
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.label}
              href={m.href}
              onClick={() => haptic("light")}
              className={cn(
                "card-premium group relative flex min-h-32 flex-col items-start justify-between overflow-hidden rounded-3xl p-4 ring-1 transition-transform active:scale-[0.97]",
                m.ring,
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-b to-transparent blur-2xl",
                  m.from,
                )}
              />
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/45 shadow-lg",
                  m.glow,
                  m.text,
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div className="relative min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-base font-black">{m.label}</span>
                  {m.hot && (
                    <span className="rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-fuchsia-300">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{m.tag}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
