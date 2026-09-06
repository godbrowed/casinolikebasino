"use client"

import Link from "next/link"
import type { CaseDTO } from "@/app/actions/cases"
import { Coin } from "@/components/coin"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"

export function CaseCard({ c }: { c: CaseDTO }) {
  const gifts = c.items.filter((item) => item.rewardType !== "currency").slice(0, 3)
  const [featured, left, right] = gifts

  return <Link href={`/case/${c.slug}`} onClick={() => haptic("light")} className="case-card group flex min-w-0 flex-col rounded-[28px] p-3 transition-colors active:scale-[.985] sm:p-4">
    <div className="relative flex aspect-[1.15] items-center justify-center overflow-hidden">
      {c.isFree ? <img src="/images/menu/gift.svg" alt="" className="h-[66%] w-[66%] object-contain transition-transform duration-200 group-hover:-rotate-3" /> : <>
        {left && <img src={left.imageUrl} alt="" className="absolute bottom-[9%] left-0 h-[43%] w-[43%] -rotate-12 object-contain" loading="lazy" />}
        {right && <img src={right.imageUrl} alt="" className="absolute bottom-[9%] right-0 h-[43%] w-[43%] rotate-12 object-contain" loading="lazy" />}
        <img src={featured?.imageUrl || "/images/menu/gift.svg"} alt="" className="relative z-10 h-[80%] w-[80%] object-contain transition-transform duration-200 group-hover:-translate-y-1" loading="lazy" />
      </>}
    </div>
    <h2 className="mt-1 truncate text-center text-[18px] font-extrabold tracking-tight sm:text-[20px]">{c.isFree ? "Free case" : c.name}</h2>
    <span className={`mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-[18px] px-3 text-[16px] font-bold tabular-nums ${c.isFree ? "bg-[#2b6eff] text-white" : "bg-[#484b50] text-white group-hover:bg-[#2b6eff]"}`}>
      {!c.isFree && <Coin className="h-5 w-5" />}{c.isFree ? "Open free" : fmt(c.price)}
    </span>
  </Link>
}
