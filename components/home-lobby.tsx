"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Bomb, ChevronRight, Dices, Gift, Rocket, Sparkles, Swords, Ticket } from "lucide-react"
import { Coin } from "@/components/coin"
import { fetchLiveDrops } from "@/lib/client-game-api"
import type { LucideIcon } from "lucide-react"

type FeaturedGift = { imageUrl: string; name: string }

export function HomeLobby({ online, featuredGifts = [] }: { online: number; featuredGifts?: FeaturedGift[] }) {
  const { data: drops } = useSWR("home-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  const liveDrops = drops?.length ? drops.slice(0, 24) : []
  const artwork = featuredGifts.length ? featuredGifts : liveDrops

  return <section className="flex w-full flex-col gap-5">
    {liveDrops.length > 0 && <div className="no-scrollbar mx-3 flex h-[68px] items-center gap-4 overflow-x-auto rounded-[22px] bg-[#33363b] pr-4 md:mx-5">
      <span className="sticky left-0 z-10 flex h-full shrink-0 items-center bg-[#33363b] px-4 text-[22px] font-bold tracking-tight text-white">LIVE</span>
      {liveDrops.map((drop) => <div key={drop.id} className="flex h-12 w-12 shrink-0 items-center justify-center" title={drop.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={drop.imageUrl} alt={drop.name} className="h-12 w-12 object-contain" loading="lazy" />
      </div>)}
    </div>}

    <div className="mx-auto flex w-full max-w-[584px] flex-col gap-3 px-3">
      <div className="mb-1 flex items-center justify-between px-1 pt-1">
        <h1 className="text-[23px] font-bold tracking-tight text-white">Games</h1>
        {online > 0 && <span className="flex items-center gap-2 text-[12px] font-medium text-white/50"><i className="h-1.5 w-1.5 rounded-full bg-[#59ca8c]" />{online.toLocaleString("en-US")} online</span>}
      </div>

      <div className="flex flex-col gap-2.5">
        <ModeRow href="/cases" title="Cases" subtitle="Find your next collectible" icon={Gift} color="#2059c7" image={artwork[0]} />
        <ModeRow href="/upgrade" title="Upgrade" subtitle="Turn your gifts into something new" icon={Sparkles} color="#6330a5" image={artwork[1]} />
        <ModeRow href="/crash" title="Crash" subtitle="Join the live flight" icon={Rocket} color="#101a2c" />
        <ModeRow href="/battles" title="PvP" subtitle="One wheel. Everyone plays." icon={Swords} color="#ae6d32" />
        <ModeRow href="/mines" title="Mines" subtitle="Choose your next move" icon={Bomb} color="#b33447" />
        <ModeRow href="/dice" title="Dice" subtitle="Your number. Your roll." icon={Dices} color="#248165" />
        <ModeRow href="/giveaways" title="Giveaways" subtitle="Explore community giveaways" icon={Ticket} color="#8c319d" image={artwork[2]} />
      </div>

      <Link href="/deposit" className="mt-2 flex min-h-[62px] items-center justify-between gap-3 rounded-[22px] bg-[#33363b] px-4 py-3 transition-colors hover:bg-[#3a3d43]">
        <span className="flex items-center gap-2.5"><Coin className="h-6 w-6" /><span className="text-[14px] font-semibold">Need more Stars?</span></span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#2b6eff] px-3 py-2 text-[12px] font-semibold text-white">Deposit <ArrowRight className="h-3.5 w-3.5" /></span>
      </Link>
    </div>
  </section>
}

function ModeRow({ href, title, subtitle, icon: Icon, color, image }: { href: string; title: string; subtitle: string; icon: LucideIcon; color: string; image?: FeaturedGift }) {
  return <Link href={href} className="lobby-mode-row group flex min-h-[88px] items-center gap-4 rounded-[27px] py-2.5 pl-4 pr-5 text-white sm:min-h-[96px] sm:gap-5 sm:pl-5" style={{ backgroundColor: color }}>
    <span className="flex h-16 w-16 shrink-0 items-center justify-center" aria-hidden="true">
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image.imageUrl} alt="" className="h-[68px] w-[68px] object-contain" loading="lazy" />
        : <Icon className="h-11 w-11 text-white/95" strokeWidth={1.8} />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[23px] font-bold leading-tight tracking-[-.025em] sm:text-[25px]">{title}</span>
      <span className="mt-1 block text-[13px] font-medium leading-snug text-white/60 sm:text-[14px]">{subtitle}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
  </Link>
}
