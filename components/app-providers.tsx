"use client"

import type { ReactNode } from "react"
import { TonConnectUIProvider } from "@tonconnect/ui-react"
import { UserProvider } from "@/components/user-provider"
import { BottomNav } from "@/components/bottom-nav"
import { LanguageProvider } from "@/components/language-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  const manifestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tonconnect-manifest.json` : "/tonconnect-manifest.json"

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <LanguageProvider><UserProvider>
        <div className="app-shell flex min-h-dvh w-full flex-col pb-24">{children}</div>
        <BottomNav />
      </UserProvider></LanguageProvider>
    </TonConnectUIProvider>
  )
}
