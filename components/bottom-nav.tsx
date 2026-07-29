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
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md">
      <div className="glass border-t border-border px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
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
                    "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                      active && "bg-primary/15 neon-text-cyan shadow-[0_0_16px_-2px] shadow-primary/50",
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
