"use client"

import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { usePathname } from "next/navigation"
import { useUser } from "@/components/user-provider"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { cn } from "@/lib/utils"

export function AppHeader({ title }: { title?: string }) {
  const { me, isLoading } = useUser()
  const pathname = usePathname()
  const backHref = pathname.startsWith("/case/") ? "/cases" : "/"
  const routeColor = pathname === "/upgrade"
    ? "bg-[#2558b8]"
    : pathname === "/giveaways"
      ? "bg-[#1a1722]"
    : pathname === "/crash"
      ? "bg-[#071126]"
      : pathname.startsWith("/case/")
        ? "bg-[#173c82]"
        : "bg-[#1c1e20]"

  return (
    <header className={cn("sticky top-0 z-40 w-full px-3", routeColor)}>
      <div className="relative mx-auto flex h-[58px] w-full max-w-[1180px] items-center justify-between">
        <div className="flex min-w-[72px] items-center gap-2">
          {pathname !== "/" && <Link href={backHref} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 text-white/75 ring-1 ring-white/10 transition active:scale-90"><ArrowLeft className="h-5 w-5" strokeWidth={2.7} /></Link>}
          {title && <span className="hidden max-w-32 truncate text-[10px] font-black uppercase tracking-[.12em] text-white/38 lg:block">{title}</span>}
        </div>

        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pug-logo-mark relative flex h-8 w-8 items-center justify-center rounded-full border border-[#376fff] bg-[#071126] shadow-[0_0_16px_rgba(47,112,255,.45)]"><img src="/images/puggift-bot-avatar-web-v2.webp" alt="PugGift" className="h-full w-full rounded-full object-cover" /><i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" /></span>
          <div className="hidden font-display text-base font-black tracking-tight md:block">Pug<span className="text-[#4d7bff]">Gift</span></div>
        </div>

        <Link href="/deposit" className="ml-auto flex items-center gap-2 rounded-full bg-black/20 py-1.5 pl-3 pr-1.5 ring-1 ring-white/10 transition active:scale-95">
          <Coin className="h-5 w-5 text-[18px]" />
          <span className="font-mono text-[15px] font-black tracking-[.01em] tabular-nums md:text-base">{isLoading ? "…" : fmt(me?.balance ?? 0)}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f70ff] text-white"><Plus className="h-4 w-4" strokeWidth={3} /></span>
        </Link>
      </div>
    </header>
  )
}
