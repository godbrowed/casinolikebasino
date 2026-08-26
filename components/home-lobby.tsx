"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Play, Users } from "lucide-react"
import { Coin } from "@/components/coin"
import { fetchLiveDrops } from "@/lib/client-game-api"

export function HomeLobby({ online }: { online: number }) {
  const { data: drops } = useSWR("home-live-drops", fetchLiveDrops, { refreshInterval: 12_000 })
  const liveDrops = drops?.length ? [...drops, ...drops] : []

  return <section className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 md:px-4">
    {liveDrops.length > 0 && <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#34373e] py-2.5 ring-1 ring-white/10">
      <div className="no-scrollbar flex items-center gap-4 overflow-x-auto px-3">
        <span className="flex shrink-0 items-center gap-2 pr-1 text-[11px] font-black uppercase tracking-[.12em]"><i className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#4ade80]" />LIVE</span>
        {liveDrops.map((drop, index) => <div key={`${drop.id}-${index}`} className="group relative flex h-11 w-11 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drop.imageUrl} alt={drop.name} className="h-11 w-11 object-contain drop-shadow-[0_6px_7px_rgba(0,0,0,.48)] transition-transform group-hover:scale-110" />
        </div>)}
      </div>
    </div>}

    <Link href="/crash" className="group relative mt-1 aspect-[2.45/1] min-h-[150px] overflow-hidden rounded-[30px] bg-[#091327] ring-1 ring-white/10">
      <img src="/images/puggift-start-banner-v2.webp" alt="PugGift" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,19,.88),rgba(3,8,19,.22)_48%,rgba(3,8,19,.08))]" />
      <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-emerald-300 backdrop-blur-md"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />{online} online</span>
      <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-[#2f70ff] px-4 py-2.5 text-xs font-black shadow-[0_8px_24px_rgba(47,112,255,.4)]"><Play className="h-4 w-4 fill-current" />Play live</span>
    </Link>

    <div className="flex items-end justify-between px-1 pb-1 pt-2">
      <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#6f8dff]">PugGift arcade</div><h1 className="font-display text-2xl font-black">Choose a game</h1></div>
      <div className="flex items-center gap-1 rounded-full bg-white/[.06] px-2.5 py-1.5 text-[10px] font-bold text-white/55"><Users className="h-3.5 w-3.5" />Live rooms</div>
    </div>

    <div className="flex flex-col gap-3">
      <GameRow href="/cases" title="Cases" subtitle="Open animated Telegram gift drops" art="/images/puggift-cases-card-v2.webp" tone="from-[#184fc2] via-[#246be3] to-[#193b8e]" badge="OPEN" />
      <GameRow href="/upgrade" title="Upgrade" subtitle="Charge the gauge and level up a gift" art="/images/puggift-upgrade-card-v2.webp" tone="from-[#43206d] via-[#7131a6] to-[#291743]" badge="NEW" />
      <GameRow href="/crash" title="Crash" subtitle="One shared flight for every player" art="/images/puggift-crash-card-v2.webp" tone="from-[#061738] via-[#0d3477] to-[#071127]" badge="ONLINE" />
      <GameRow href="/mines" title="Mines" subtitle="Find bones before the grumpy pugs" art="/images/puggift-bot-avatar-web-v2.webp" tone="from-[#123d22] via-[#1d6b38] to-[#0b2515]" badge="NEW" />
      <GameRow href="/battles" title="PvP" subtitle="Two real stakes. One winner." art="/images/puggift-pvp-card-v2.webp" tone="from-[#6b3512] via-[#bd6a16] to-[#39200d]" badge="LIVE" />
      <GameRow href="/giveaways" title="Giveaways" subtitle="Create a channel drop with inline entry" art="/images/puggift-mascot-share-v1.png" tone="from-[#4b238a] via-[#7541c7] to-[#28143f]" badge="CREATOR" />
    </div>

    <Link href="/deposit" className="group flex items-center justify-between rounded-[24px] bg-[#393c43] px-4 py-3 ring-1 ring-white/10 transition hover:bg-[#41454e]">
      <span className="flex items-center gap-2 text-sm font-bold"><Coin className="h-6 w-6 text-[22px]" glow />Need more Stars?</span>
      <span className="flex items-center gap-1 rounded-xl bg-[#2f70ff] px-3 py-2 text-xs font-black">Deposit <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  </section>
}

function GameRow({ href, title, subtitle, art, tone, badge }: { href: string; title: string; subtitle: string; art: string; tone: string; badge: string }) {
  return <Link href={href} className={`lobby-card group relative flex min-h-[126px] items-center overflow-hidden rounded-[30px] bg-gradient-to-r ${tone} px-5 py-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] ring-1 ring-white/10`}>
    <img src={art} alt="" className="absolute right-0 top-0 h-full w-[54%] object-cover transition duration-500 [mask-image:linear-gradient(to_right,transparent_0%,black_34%)] group-hover:scale-105" />
    <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,6,14,.18),transparent_65%)]" />
    <span className="relative z-10 w-[64%] min-w-0"><span className="mb-2 inline-flex rounded-full bg-black/20 px-2 py-1 text-[8px] font-black tracking-[.12em] text-white/75 backdrop-blur-sm">{badge}</span><span className="block font-display text-2xl font-black md:text-[27px]">{title}</span><span className="mt-1 block text-[11px] leading-snug text-white/65 md:text-xs">{subtitle}</span></span>
    <span className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-md"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
  </Link>
}
