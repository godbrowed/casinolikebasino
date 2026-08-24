import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AppProviders } from "@/components/app-providers"

export const metadata: Metadata = {
  title: "PugGift — Telegram Gifts",
  description: "Open cases, collect Telegram gifts, and play live games with the PugGift mascot.",
  icons: { icon: "/images/puggift-bot-avatar-v2.png", apple: "/images/puggift-bot-avatar-v2.png" },
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0e17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
