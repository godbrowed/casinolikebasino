"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight } from "lucide-react"
import { Coin } from "@/components/coin"
import { GameScene } from "@/components/game-scene"
import { fetchLiveDrops } from "@/lib/client-game-api"
import type { ReactNode } from "react"

export function HomeLobby({ online, freeCaseSlug, paidCaseCount = 0 }: { online: number; freeCaseSlug?: string; paidCaseCount?: number }) {
  const { data: drops } = useSWR("home-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  const liveDrops = drops?.length ? drops.slice(0, 24) : []

  return <section className="flex w-full flex-col gap-6">
    {liveDrops.length > 0 && <div aria-label="Recent real drops" className="no-scrollbar mx-3 flex h-[72px] items-center gap-4 overflow-x-auto rounded-[26px] bg-[#35373b] pr-4 md:mx-5 md:h-20">
      <span className="sticky left-0 z-10 flex h-full shrink-0 items-center bg-[#35373b] px-5 text-[25px] font-extrabold tracking-tight text-white">LIVE</span>
      {liveDrops.map((drop) => <div key={drop.id} className="flex h-12 w-12 shrink-0 items-center justify-center" title={drop.name}>
        <img src={drop.imageUrl} alt={drop.name} className="h-12 w-12 object-contain" loading="lazy" />
      </div>)}
    </div>}

    <div className="mx-auto flex w-full max-w-[584px] flex-col gap-3 px-3">
      <h1 className="sr-only">PugGift games</h1>
      <div className="flex flex-col gap-3">
        {freeCaseSlug && <ModeRow href={`/case/${freeCaseSlug}`} title="Free" subtitle="Free case" color="#343946" art={<GameScene kind="free" />} />}
        <ModeRow href="/cases" title="Cases" subtitle={paidCaseCount ? `${paidCaseCount} cases` : "Collect Telegram gifts"} color="#2054bd" art={<CaseStack />} />
        <ModeRow href="/upgrade" title="Upgrade" subtitle="Improve your gifts" color="#552393" image="/images/menu/plush-pepe.webp" />
        <ModeRow href="/crash" title="Crash" subtitle="Live rounds" color="#081122" art={<GameScene kind="crash" />} />
        <ModeRow href="/battles" title="PvP" subtitle="Play together" color="#ae713a" art={<GameScene kind="pvp" />} />
        <ModeRow href="/mines" title="Mines" subtitle="Find the safe cells" color="#b71d37" art={<GameScene kind="mines" />} />
        <ModeRow href="/dice" title="Dice" subtitle="Choose your number" color="#138256" art={<GameScene kind="dice" />} />
        <ModeRow href="/giveaways" title="Giveaways" subtitle="Gifts from the community" color="#a51ac0" image="/images/menu/heart-locket.webp" />
      </div>

      <Link href="/deposit" className="mt-2 flex min-h-[64px] items-center justify-between gap-3 rounded-[24px] bg-[#35373b] px-4 py-3 transition-colors hover:bg-[#404247]">
        <span className="flex items-center gap-2.5"><Coin className="h-6 w-6" /><span className="text-[14px] font-bold">Need more Stars?</span></span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#2b6eff] px-3 py-2 text-[13px] font-bold text-white">Deposit <ArrowRight className="h-4 w-4" /></span>
      </Link>
      {online > 0 && <p className="flex items-center justify-center gap-2 py-2 text-[13px] text-white/45"><i className="h-1.5 w-1.5 rounded-full bg-[#61ce94]" />{online.toLocaleString("en-US")} online</p>}
    </div>
  </section>
}

function ModeRow({ href, title, subtitle, color, image, art }: { href: string; title: string; subtitle?: string; color: string; image?: string; art?: ReactNode }) {
  return <Link href={href} className="lobby-mode-row group flex min-h-[96px] items-center gap-4 overflow-hidden rounded-[30px] py-3 pl-4 pr-5 text-white sm:min-h-[108px] sm:gap-5 sm:rounded-[38px] sm:pl-5" style={{ backgroundColor: color }}>
    <span className="relative flex h-[70px] w-[70px] shrink-0 items-center justify-center" aria-hidden="true">
      {art ?? <img src={image} alt="" className="h-[58px] w-[58px] object-contain sm:h-16 sm:w-16" loading="lazy" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[24px] font-bold leading-tight tracking-[-.025em] sm:text-[26px]">{title}</span>
      {subtitle && <span className="mt-1 block text-[14px] font-semibold leading-snug text-white/55 sm:text-[16px]">{subtitle}</span>}
    </span>
  </Link>
}

function CaseStack() {
  return <span className="relative block h-[74px] w-[66px]">
    <span className="absolute -left-2 -top-10 h-[68px] w-[62px] -rotate-6 rounded-[23px] border border-white/15 bg-[#2ba8c1]" />
    <span className="absolute -bottom-11 left-2 h-[68px] w-[62px] rotate-6 rounded-[23px] border border-white/15 bg-[#be38bb]" />
    <span className="absolute inset-0 flex items-center justify-center rounded-[24px] border border-white/10 bg-[#442690]"><Coin className="h-10 w-10" /></span>
  </span>
}
