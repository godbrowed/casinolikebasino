"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowUpRight, Bomb, Dices, Gift, Rocket, Sparkles, Swords, Users } from "lucide-react"
import { Coin } from "@/components/coin"
import { fetchLiveDrops } from "@/lib/client-game-api"

export function HomeLobby({ online }: { online: number }) {
  const { data: drops } = useSWR("home-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  const liveDrops = drops?.length ? drops.slice(0, 18) : []

  return <section className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-3 md:px-5">
    {liveDrops.length > 0 && <div className="app-panel no-scrollbar flex min-h-16 items-center gap-3 overflow-x-auto rounded-[22px] px-3 py-2">
      <span className="sticky left-0 z-10 flex shrink-0 items-center gap-2 rounded-xl bg-[#171c29]/95 px-2.5 py-2 text-[9px] font-black uppercase tracking-[.14em] text-white/65 backdrop-blur-xl">
        <i className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />Live drops
      </span>
      {liveDrops.map((drop) => <div key={drop.id} className="group relative flex h-11 w-11 shrink-0 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={drop.imageUrl} alt={drop.name} className="h-10 w-10 object-contain drop-shadow-[0_8px_9px_rgba(0,0,0,.5)] transition-transform duration-200 group-hover:scale-110" />
      </div>)}
    </div>}

    <Link href="/cases" className="group relative min-h-[190px] overflow-hidden rounded-[32px] border border-white/[.09] bg-[#121a2b] shadow-[0_28px_80px_-48px_rgba(68,103,255,.85)] md:min-h-[230px]">
      <img src="/images/puggift-hero-v3.svg" alt="PugGift arcade" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.015]" />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,18,.94),rgba(5,9,18,.64)_46%,rgba(5,9,18,.12))]" />
      <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#070b13]/70 to-transparent" />
      <div className="relative flex h-full min-h-[190px] max-w-[60%] flex-col justify-between p-5 md:min-h-[230px] md:p-7">
        <span className="flex w-fit items-center gap-2 rounded-full bg-emerald-400/12 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-emerald-300 ring-1 ring-emerald-300/15"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{online} online</span>
        <div>
          <div className="app-kicker">PugGift arcade</div>
          <h1 className="app-title mt-1 text-[30px] leading-[.96] text-white md:text-[44px]">Open. Play.<br /><span className="text-[#7f98ff]">Collect.</span></h1>
          <span className="app-cta mt-4 inline-flex items-center gap-2 rounded-[15px] px-4 py-3 text-xs font-black">Choose a case <ArrowUpRight className="h-4 w-4" /></span>
        </div>
      </div>
    </Link>

    <div className="flex items-end justify-between px-1 pt-1">
      <div><div className="app-kicker">Playground</div><h2 className="app-title mt-0.5 text-2xl">Choose a mode</h2></div>
      <span className="app-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black"><Users className="h-3.5 w-3.5" />Shared rooms</span>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ModeCard href="/cases" title="Cases" subtitle="Animated gift drops" icon={<Gift className="h-4 w-4" />} accent="blue" className="col-span-2 min-h-[176px] md:min-h-[205px]" />
      <ModeCard href="/upgrade" title="Upgrade" subtitle="Reach a better gift" icon={<Sparkles className="h-4 w-4" />} accent="violet" className="min-h-[176px] md:min-h-[205px]" />
      <ModeCard href="/crash" title="Crash" subtitle="One global flight" icon={<Rocket className="h-4 w-4" />} accent="indigo" className="min-h-[176px] md:min-h-[205px]" live />
      <ModeCard href="/mines" title="Mines" subtitle="Find every safe bone" icon={<Bomb className="h-4 w-4" />} accent="green" className="min-h-[132px]" />
      <ModeCard href="/dice" title="Pug Dice" subtitle="Pick your risk" icon={<Dices className="h-4 w-4" />} accent="orange" className="min-h-[132px]" />
      <ModeCard href="/battles" title="PvP" subtitle="Stake-weighted wheel" icon={<Swords className="h-4 w-4" />} accent="gold" className="min-h-[132px]" live />
      <ModeCard href="/giveaways" title="Giveaways" subtitle="Channel NFT drops" icon={<Gift className="h-4 w-4" />} accent="pink" className="min-h-[132px]" />
    </div>

    <Link href="/deposit" className="app-panel group mb-2 flex items-center justify-between rounded-[22px] px-4 py-3.5 transition hover:border-white/15">
      <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-300/10 ring-1 ring-amber-300/15"><Coin className="h-6 w-6" /></span><span><b className="block text-sm">Need more Stars?</b><small className="text-[10px] font-semibold text-white/38">TON, Telegram Stars or gifts</small></span></span>
      <span className="app-cta flex items-center gap-1 rounded-[13px] px-3 py-2 text-[10px] font-black">Deposit <ArrowUpRight className="h-3.5 w-3.5" /></span>
    </Link>
  </section>
}

const accents = {
  blue: "from-[#305fef]/32 via-[#1d45a8]/18 to-transparent",
  violet: "from-[#8a52f5]/32 via-[#542493]/16 to-transparent",
  indigo: "from-[#3455cf]/32 via-[#162f76]/16 to-transparent",
  green: "from-[#27b47a]/25 via-[#14513b]/14 to-transparent",
  orange: "from-[#f28a45]/27 via-[#873f19]/14 to-transparent",
  gold: "from-[#efa83b]/28 via-[#81521a]/14 to-transparent",
  pink: "from-[#db5aa8]/26 via-[#7a285c]/14 to-transparent",
} as const

function ModeCard({ href, title, subtitle, icon, accent, className, live }: { href: string; title: string; subtitle: string; icon: React.ReactNode; accent: keyof typeof accents; className: string; live?: boolean }) {
  return <Link href={href} className={`app-panel lobby-card group relative flex overflow-hidden rounded-[27px] p-4 ${className}`}>
    <span className={`absolute inset-0 bg-gradient-to-br ${accents[accent]}`} />
    <span className="absolute -bottom-5 -right-4 flex h-32 w-32 rotate-[-8deg] items-center justify-center rounded-[38px] border border-white/[.08] bg-black/15 text-white/[.14] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-3deg] [&_svg]:!h-16 [&_svg]:!w-16">
      {icon}
      <i className="absolute -left-3 top-4 h-3 w-3 rounded-full border border-white/15 bg-white/[.07]" />
      <i className="absolute bottom-5 right-4 h-5 w-5 rotate-12 rounded-[7px] border border-white/10 bg-white/[.05]" />
    </span>
    <div className="relative z-10 flex w-full flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/[.08] text-white/80 ring-1 ring-white/[.08]">{icon}</span>
        {live && <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live</span>}
      </div>
      <div className="max-w-[68%]"><h3 className="app-title text-xl md:text-2xl">{title}</h3><p className="mt-1 text-[10px] font-semibold text-white/43 md:text-[11px]">{subtitle}</p></div>
    </div>
    <span className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-[12px] bg-white/[.08] text-white/55 ring-1 ring-white/[.07]"><ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
  </Link>
}
