"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { LanguageSwitcher } from "@/components/language-switcher"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[.055] bg-[#1a1c20]/94 px-3 py-2 backdrop-blur-xl">
      <div className="relative mx-auto flex w-full max-w-[620px] flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pug-logo-mark relative flex h-8 w-8 items-center justify-center rounded-full border border-[#376fff] bg-[#071126] shadow-[0_0_16px_rgba(47,112,255,.45)]"><img src="/images/puggift-bot-avatar-web-v2.webp" alt="PugGift" className="h-full w-full rounded-full object-cover" /><i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" /></span>
          <div className="font-display text-base font-black tracking-tight">Pug<span className="text-[#4d7bff]">Gift</span></div>
        </div>

        <div className="absolute right-0 top-0"><LanguageSwitcher /></div>

        <Link href="/deposit" className="flex items-center gap-2 rounded-full bg-[#383b42] py-1.5 pl-3 pr-1.5 ring-1 ring-white/8 transition active:scale-95">
          <Coin className="h-5 w-5 text-[18px]" />
          <span className="font-mono text-sm font-black tabular-nums">{isLoading ? "…" : fmt(me?.balance ?? 0)}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f70ff] text-white"><Plus className="h-4 w-4" strokeWidth={3} /></span>
        </Link>

        {title && <div className="absolute left-0 top-1 text-[10px] font-black uppercase tracking-[.14em] text-white/35 md:hidden">{title}</div>}
      </div>
    </header>
  )
}
