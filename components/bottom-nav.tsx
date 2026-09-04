"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, Gauge, Sparkles, UserRound, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"
import { useLanguage } from "@/components/language-provider"

const ITEMS = [
  { href: "/", label: "games", icon: Boxes }, { href: "/battles", label: "battles", icon: Swords }, { href: "/crash", label: "crash", icon: Gauge }, { href: "/upgrade", label: "upgrade", icon: Sparkles }, { href: "/profile", label: "profile", icon: UserRound },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  if (pathname === "/deposit" || pathname.startsWith("/case/")) return null

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto mx-auto w-full max-w-[620px] rounded-[25px] border border-white/[.075] bg-[#111620]/94 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-2xl">
        <ul className="grid grid-cols-5 gap-0.5">
          {ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" || pathname === "/cases" || pathname === "/mines" || pathname === "/dice" || pathname === "/giveaways" : pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => haptic("light")}
                  className={cn(
                    "group relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[19px] px-1 py-1 text-[9px] font-black transition-colors",
                    active ? "text-white" : "text-white/34 hover:text-white/60",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-8 w-11 items-center justify-center rounded-[12px] transition-colors",
                      active ? "bg-[#4f75ff] text-white shadow-[0_5px_16px_rgba(58,93,232,.25)]" : "text-white/42",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2.1} />
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
