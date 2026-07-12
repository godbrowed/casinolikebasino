"use client"

type WebApp = {
  initData: string
  version?: string
  isVersionAtLeast?: (version: string) => boolean
  ready: () => void
  expand: () => void
  disableVerticalSwipes?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
  }
  openInvoice?: (url: string, callback: (status: string) => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp }
  }
}

export function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null
  return window.Telegram?.WebApp ?? null
}

export function initWebApp() {
  const wa = getWebApp()
  if (!wa) return
  try {
    wa.ready()
    wa.expand()
    wa.disableVerticalSwipes?.()
    wa.setHeaderColor?.("#0b0e17")
    wa.setBackgroundColor?.("#0b0e17")
  } catch {
    // ignore
  }
}

export function getInitData(): string {
  return getWebApp()?.initData ?? ""
}

function hapticSupported(wa: WebApp | null): wa is WebApp {
  // HapticFeedback requires Telegram WebApp 6.1+. The preview stub reports 6.0.
  return !!wa && (wa.isVersionAtLeast?.("6.1") ?? false)
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  const wa = getWebApp()
  if (!hapticSupported(wa)) return
  try {
    wa.HapticFeedback?.impactOccurred(style)
  } catch {
    // ignore unsupported haptics
  }
}

export function hapticNotify(type: "error" | "success" | "warning") {
  const wa = getWebApp()
  if (!hapticSupported(wa)) return
  try {
    wa.HapticFeedback?.notificationOccurred(type)
  } catch {
    // ignore unsupported haptics
  }
}
