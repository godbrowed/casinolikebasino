"use client"

import { useEffect, type ReactNode } from "react"
import { TonConnectUIProvider } from "@tonconnect/ui-react"
import { UserProvider } from "@/components/user-provider"
import { BottomNav } from "@/components/bottom-nav"
import { LanguageProvider } from "@/components/language-provider"
import { PugIntro } from "@/components/pug-intro"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { requestAppFullscreen } from "@/lib/telegram-webapp"

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const immersive = pathname === "/deposit" || pathname === "/crash" || pathname.startsWith("/case/")
  const manifestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tonconnect-manifest.json` : "/tonconnect-manifest.json"

  useEffect(() => {
    const requestOnce = () => requestAppFullscreen()
    window.addEventListener("pointerdown", requestOnce, { once: true, passive: true })
    return () => window.removeEventListener("pointerdown", requestOnce)
  }, [])

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <LanguageProvider><UserProvider>
        <PugIntro />
        <div className={cn("app-shell flex min-h-[var(--tg-viewport-stable-height,100dvh)] w-full flex-col", immersive ? "pb-0" : "pb-24")}>{children}</div>
        <BottomNav />
      </UserProvider></LanguageProvider>
    </TonConnectUIProvider>
  )
}
