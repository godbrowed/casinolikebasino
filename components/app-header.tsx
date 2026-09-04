"use client"

import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { usePathname } from "next/navigation"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()
  const pathname = usePathname()
  const backHref = pathname.startsWith("/case/") ? "/cases" : "/"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[.055] bg-[#0d111a]/88 px-3 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-[64px] w-full max-w-[1180px] items-center justify-between">
        <div className="flex min-w-[48px] items-center gap-2">
          {pathname !== "/" && <Link href={backHref} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-white/[.055] text-white/70 ring-1 ring-white/[.07] transition hover:bg-white/[.08] active:scale-90"><ArrowLeft className="h-5 w-5" strokeWidth={2.5} /></Link>}
          {title && <span className="hidden max-w-36 truncate text-[9px] font-black uppercase tracking-[.16em] text-white/30 lg:block">{title}</span>}
        </div>

        <Link href="/" aria-label="PugGift home" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pug-logo-mark relative flex h-9 w-9 items-center justify-center rounded-[14px] border border-[#617fff]/45 bg-[#11182b] shadow-[0_0_22px_rgba(74,105,255,.28)]"><img src="/images/puggift-bot-avatar-web-v2.webp" alt="PugGift" className="h-full w-full rounded-[13px] object-cover" /><i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" /></span>
          <div className="font-display text-[17px] font-black tracking-[-.04em]">Pug<span className="text-[#6f8cff]">Gift</span></div>
        </Link>

        <Link href="/deposit" className="ml-auto flex items-center gap-1.5 rounded-[16px] bg-white/[.055] py-1.5 pl-2.5 pr-1.5 ring-1 ring-white/[.075] transition hover:bg-white/[.08] active:scale-95">
          <Coin className="h-[18px] w-[18px]" />
          <span className="max-w-[84px] truncate font-mono text-[13px] font-black tabular-nums text-white md:max-w-none md:text-[15px]">{isLoading ? "…" : fmt(me?.balance ?? 0)}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-[11px] bg-[#4f75ff] text-white shadow-[0_4px_12px_rgba(66,101,241,.25)]"><Plus className="h-4 w-4" strokeWidth={3} /></span>
        </Link>
      </div>
    </header>
  )
}
