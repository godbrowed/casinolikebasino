"use client"

import Link from "next/link"
import type { CaseDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"

export function CaseCard({ c }: { c: CaseDTO }) {
  const featured = c.items.find((item) => item.rewardType !== "currency")

  return <Link href={`/case/${c.slug}`} onClick={() => haptic("light")} className="case-card group flex min-w-0 flex-col rounded-[24px] p-3 transition-colors active:scale-[.985] sm:p-4">
    <div className="relative flex aspect-[1.15] items-center justify-center overflow-hidden">
      <img src={featured?.imageUrl || "/images/menu/bunny-muffin.png"} alt="" className="h-[80%] w-[80%] object-contain" loading="lazy" />
    </div>
    <h2 className="mt-1 truncate text-center text-[17px] font-bold tracking-tight sm:text-[19px]">{c.isFree ? "Free case" : c.name}</h2>
    <span className={`mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[16px] font-semibold tabular-nums ${c.isFree ? "bg-[#2b6eff] text-white" : "bg-[#484b50] text-white group-hover:bg-[#2b6eff]"}`}>
      {!c.isFree && <Coin className="h-5 w-5" />}{c.isFree ? "Open free" : fmt(c.price)}
    </span>
  </Link>
}
