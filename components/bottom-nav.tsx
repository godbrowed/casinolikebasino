"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, Gauge, Sparkles, UserRound, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"
import { useLanguage } from "@/components/language-provider"

const ITEMS = [
  { href: "/", label: "games", icon: Boxes }, { href: "/battles", label: "battles", icon: Swords }, { href: "/crash", label: "crash", icon: Gauge }, { href: "/mines", label: "mines", icon: MineIcon }, { href: "/upgrade", label: "upgrade", icon: Sparkles }, { href: "/profile", label: "profile", icon: UserRound },
]

function MineIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="m6.2 7.1-2-2m13.6 2 2-2M12 4V1.8M4 12H1.8M22.2 12H20M6.2 16.9l-2 2m13.6-2 2 2" /><circle cx="12" cy="12" r="6.1" /><path d="M9.5 10.2c.7-1.1 2.1-1.7 3.4-1.3" /><circle cx="10" cy="14" r=".7" fill="currentColor" stroke="none" /></svg>
}

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  if (pathname === "/deposit" || pathname.startsWith("/case/")) return null

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto mx-auto w-full max-w-[680px] rounded-[26px] bg-[#15191d]/96 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-xl">
        <ul className="grid grid-cols-6 gap-0.5">
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
