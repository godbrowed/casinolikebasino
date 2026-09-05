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
  if (pathname === "/deposit" || pathname.startsWith("/case/")) return null

  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 bg-[#191b1f] px-2 pb-[max(env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px))]">
      <div className="mx-auto w-full max-w-[580px]">
        <ul className="grid grid-cols-5">
          {ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" || pathname === "/cases" || pathname === "/mines" || pathname === "/dice" || pathname === "/giveaways" : pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => haptic("light")}
                  className={cn(
                    "relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-1 py-2 text-[11px] font-medium transition-colors sm:text-[12px]",
                    active ? "text-[#2b6eff]" : "text-[#8a8d92] hover:text-white/80",
                  )}
                >
                  <span className="flex h-7 w-8 items-center justify-center">
                    <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                  </span>
                  <span>{t(item.label as "games" | "battles" | "crash" | "mines" | "upgrade" | "profile")}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
