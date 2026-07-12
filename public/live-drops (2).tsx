import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { AppProviders } from "@/components/app-providers"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" })

export const metadata: Metadata = {
  title: "Giftlys — Telegram Gifts",
  description: "Open cases, collect Telegram gifts, and play with friends in Giftlys.",
  icons: { icon: "/images/ton-diamond.png", apple: "/images/ton-diamond.png" },
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
      <body className={`${geist.variable} ${geistMono.variable} ${display.variable} font-sans antialiased`}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
