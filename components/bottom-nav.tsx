"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gamepad2, Rocket, TrendingUp, User, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"
import { useLanguage } from "@/components/language-provider"

const ITEMS = [
  { href: "/", label: "games", icon: Gamepad2 }, { href: "/battles", label: "battles", icon: Swords }, { href: "/crash", label: "crash", icon: Rocket }, { href: "/upgrade", label: "upgrade", icon: TrendingUp }, { href: "/profile", label: "profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[.07] bg-[#15171b]/95 px-3 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[560px] px-2">
        <ul className="flex items-center justify-between">
          {ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => haptic("light")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[9px] font-bold transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
                      active ? "bg-primary/12 text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  </span>
                  {t(item.label as "games")}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
