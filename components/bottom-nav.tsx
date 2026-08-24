"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, Rocket, TrendingUp, UserRound, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"
import { useLanguage } from "@/components/language-provider"

const ITEMS = [
  { href: "/", label: "games", icon: Boxes }, { href: "/battles", label: "battles", icon: Swords }, { href: "/crash", label: "crash", icon: Rocket }, { href: "/upgrade", label: "upgrade", icon: TrendingUp }, { href: "/profile", label: "profile", icon: UserRound },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  if (pathname === "/deposit" || pathname === "/crash" || pathname.startsWith("/case/")) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[.075] bg-[#111419]/94 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px))] pt-2 shadow-[0_-18px_42px_rgba(0,0,0,.28)] backdrop-blur-2xl">
      <div className="mx-auto w-full max-w-[620px]">
        <ul className="grid grid-cols-5 gap-1 rounded-[24px] bg-white/[.025] p-1">
          {ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => haptic("light")}
                  className={cn(
                    "group relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 py-1.5 text-[9px] font-black transition-all",
                    active ? "text-white" : "text-white/38 hover:text-white/65",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-8 w-11 items-center justify-center rounded-[13px] transition-all",
                      active ? "bg-[#2f70ff] text-white shadow-[0_5px_16px_rgba(47,112,255,.36),inset_0_1px_0_rgba(255,255,255,.28)]" : "text-white/42 group-hover:bg-white/[.05]",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.7 : 2.1} />
                  </span>
                  <span className={cn("transition-colors", active && "text-[#70a0ff]")}>{t(item.label as "games")}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
