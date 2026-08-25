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
  if (pathname === "/deposit" || pathname === "/crash" || pathname === "/battles" || pathname.startsWith("/case/")) return null

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto mx-auto w-full max-w-[680px] rounded-[26px] bg-[#15191d]/96 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 gap-0.5">
          {ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => haptic("light")}
                  className={cn(
                    "group relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-1 text-[10px] font-bold transition-colors",
                    active ? "text-[#4b7cff]" : "text-white/38 hover:text-white/60",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-9 w-10 items-center justify-center rounded-[13px] transition-colors",
                      active ? "bg-[#2f70ff] text-white" : "text-white/42",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2.1} />
                  </span>
                  <span>{t(item.label as "games")}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
