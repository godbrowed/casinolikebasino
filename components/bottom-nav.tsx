"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, Rocket, TrendingUp, User, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"
import { useLanguage } from "@/components/language-provider"

const ITEMS = [
  { href: "/", label: "cases", icon: Package }, { href: "/battles", label: "battles", icon: Swords }, { href: "/crash", label: "crash", icon: Rocket }, { href: "/upgrade", label: "upgrade", icon: TrendingUp }, { href: "/profile", label: "profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="rounded-3xl border border-white/10 bg-[#282b32]/95 px-2 py-2 shadow-[0_16px_32px_-12px_rgba(0,0,0,.9)] backdrop-blur-xl">
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
                      active && "bg-primary text-primary-foreground shadow-[0_4px_0_#1938a8]",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  </span>
                  {t(item.label as "cases")}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
