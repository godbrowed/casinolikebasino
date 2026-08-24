"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Gift, Rocket, Swords, TrendingUp, Users } from "lucide-react"
import { getLiveDrops } from "@/app/actions/cases"
import { Coin } from "@/components/coin"

export function HomeLobby({ online }: { online: number }) {
  const { data: drops } = useSWR("home-live-drops", getLiveDrops, { refreshInterval: 12_000 })

  return <section className="mx-auto flex w-full max-w-[620px] flex-col gap-3 px-3 md:px-4">
    {drops && drops.length > 0 && <div className="overflow-hidden rounded-[24px] bg-[#34373e] py-2.5 ring-1 ring-white/10">
      <div className="no-scrollbar flex items-center gap-3 overflow-x-auto px-3">
        <span className="flex shrink-0 items-center gap-2 pr-1 text-[11px] font-black uppercase tracking-[.12em]"><i className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#4ade80]" />LIVE</span>
        {drops.map((drop) => <div key={drop.id} className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drop.imageUrl} alt={drop.name} className="h-9 w-9 object-contain drop-shadow-[0_5px_7px_rgba(0,0,0,.45)] transition-transform group-hover:scale-110" />
        </div>)}
      </div>
    </div>}

    <div className="flex items-end justify-between px-1 pb-1 pt-2">
      <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#6f8dff]">Giftlys arcade</div><h1 className="font-display text-2xl font-black">Choose a game</h1></div>
      <div className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300"><Users className="h-3.5 w-3.5" />{online} online</div>
    </div>

    <div className="flex flex-col gap-3">
      <GameRow href="/crash" title="Crash" subtitle="One live flight for every player" icon={Rocket} tone="from-[#071532] via-[#0c2353] to-[#153a87]" badge="ONLINE" iconTone="bg-[#3068ff]" />
      <GameRow href="/battles" title="PvP" subtitle="Join a stake session and take the bank" icon={Swords} tone="from-[#6e125f] via-[#9e176f] to-[#d42883]" badge="LIVE" iconTone="bg-[#fa3c96]" />
      <GameRow href="/upgrade" title="Upgrade" subtitle="Turn your gift into something bigger" icon={TrendingUp} tone="from-[#32125b] via-[#6122a7] to-[#8a36d4]" badge="NEW" iconTone="bg-[#8c3be5]" />
      <GameRow href="#cases" title="Cases" subtitle="Open fresh Telegram gift drops" icon={Gift} tone="from-[#153b91] via-[#205dcc] to-[#3475ef]" badge="18 CASES" iconTone="bg-[#3579ff]" />
    </div>

    <Link href="/deposit" className="group flex items-center justify-between rounded-[24px] bg-[#393c43] px-4 py-3 ring-1 ring-white/10 transition hover:bg-[#41454e]">
      <span className="flex items-center gap-2 text-sm font-bold"><Coin className="h-6 w-6 text-[22px]" glow />Need more Stars?</span>
      <span className="flex items-center gap-1 rounded-xl bg-[#2f70ff] px-3 py-2 text-xs font-black">Deposit <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  </section>
}

function GameRow({ href, title, subtitle, icon: Icon, tone, badge, iconTone }: { href: string; title: string; subtitle: string; icon: typeof Rocket; tone: string; badge: string; iconTone: string }) {
  return <Link href={href} className={`lobby-card group relative flex min-h-[104px] items-center gap-4 overflow-hidden rounded-[30px] bg-gradient-to-r ${tone} px-4 py-3 shadow-[0_8px_0_-5px_rgba(0,0,0,.7)] ring-1 ring-white/10 md:min-h-[112px] md:px-5`}>
    <span className="absolute -right-6 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
    <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] ${iconTone} shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_24px_rgba(0,0,0,.25)]`}><Icon className="h-9 w-9 drop-shadow-lg" strokeWidth={1.8} /></span>
    <span className="relative min-w-0 flex-1"><span className="font-display text-xl font-black md:text-2xl">{title}</span><span className="mt-1 block truncate text-xs text-white/65 md:text-sm">{subtitle}</span></span>
    <span className="relative flex flex-col items-end gap-3"><span className="rounded-full bg-white/15 px-2 py-1 text-[8px] font-black tracking-wide">{badge}</span><ArrowRight className="h-5 w-5 text-white/60 transition-transform group-hover:translate-x-1" /></span>
  </Link>
}
