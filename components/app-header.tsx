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
    <header className="sticky top-0 z-40 w-full bg-[#202225] px-3">
      <div className="relative mx-auto flex h-[64px] w-full max-w-[1180px] items-center gap-2.5">
        {pathname !== "/" && <Link href={backHref} aria-label="Back" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191b1e] text-white/80 transition-colors hover:bg-[#35383d]"><ArrowLeft className="h-5 w-5" strokeWidth={2.2} /></Link>}

        <Link href="/" aria-label="PugGift home" className="flex shrink-0 items-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/puggift-mark-v4.svg" alt="" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-[17px] font-bold tracking-[-.025em]">PugGift</span>
        </Link>

        {title && <span className="hidden truncate text-[13px] font-medium text-white/45 lg:block">{title}</span>}

        <Link href="/deposit" aria-label="Balance and deposit" className="ml-auto flex min-w-0 items-center gap-1.5 rounded-full bg-[#34363b] py-1.5 pl-2.5 pr-1.5 transition-colors hover:bg-[#3d4046]">
          <Coin className="h-[18px] w-[18px]" />
          <span className="max-w-[84px] truncate text-[13px] font-semibold tabular-nums text-white md:max-w-none md:text-[15px]">{isLoading ? "…" : fmt(me?.balance ?? 0)}</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2b6eff] text-white"><Plus className="h-4 w-4" strokeWidth={2.5} /></span>
        </Link>
      </div>
    </header>
  )
}
