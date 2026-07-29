"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import useSWR from "swr"
import { getInitData, initWebApp } from "@/lib/telegram-webapp"
import { TelegramRequired } from "@/components/telegram-required"

export type Me = {
  id: string
  username: string | null
  firstName: string | null
  photoUrl: string | null
  balance: number
  isDemo: boolean
  isAdmin: boolean
}

type UserContextValue = {
  me: Me | null
  isLoading: boolean
  refresh: () => void
  setBalance: (n: number) => void
}

const UserContext = createContext<UserContextValue | null>(null)

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function UserProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<"loading" | "ready" | "telegram-required">("loading")
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const { data, isLoading, mutate } = useSWR<{ user: Me | null }>(authState === "ready" ? "/api/me" : null, fetcher, {
    refreshInterval: 0,
  })

  useEffect(() => {
    initWebApp()
    const initData = getInitData()
    fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || payload?.error === "TELEGRAM_REQUIRED") {
          setBotUsername(payload?.botUsername ?? null)
          setAuthState("telegram-required")
          return
        }
        setAuthState("ready")
      })
      .catch(() => setAuthState("telegram-required"))
  }, [])

  const value: UserContextValue = {
    me: data?.user ?? null,
    isLoading: authState === "loading" || isLoading,
    refresh: () => mutate(),
    setBalance: (n: number) =>
      mutate((prev) => (prev?.user ? { user: { ...prev.user, balance: n } } : prev), { revalidate: false }),
  }

  if (authState === "telegram-required") {
    return <TelegramRequired botUsername={botUsername} />
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used within UserProvider")
  return ctx
}
