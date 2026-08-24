"use client"

import Link from "next/link"
import useSWR from "swr"
import { Gift, Rocket, Swords, TrendingUp, Users } from "lucide-react"
import { getLiveDrops } from "@/app/actions/cases"
import { Coin } from "@/components/coin"

export function HomeLobby({ online }: { online: number }) {
  const { data: drops } = useSWR("home-live-drops", getLiveDrops, { refreshInterval: 12_000 })
  return <section className="flex flex-col gap-3 px-4">
    {drops && drops.length > 0 && <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#282b32] py-2.5">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3">
        <span className="flex shrink-0 items-center gap-2 pr-1 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#4ade80]" />Live drops</span>
        {drops.map((drop) => <div key={drop.id} className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/5 py-1 pl-1 pr-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drop.imageUrl} alt="" className="h-7 w-7 object-contain" />
          <span className="max-w-20 truncate text-[10px] font-bold">{drop.name}</span>
        </div>)}
      </div>
    </div>}
    <div className="flex items-center justify-between px-1"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#7392ff]">Giftlys arcade</div><h1 className="font-display text-2xl font-black">Choose a game</h1></div><div className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300"><Users className="h-3.5 w-3.5" />{online} online</div></div>

    <div className="grid grid-cols-2 gap-3">
      <Link href="/crash" className="lobby-card group row-span-2 flex min-h-64 flex-col justify-between overflow-hidden rounded-[30px] border border-blue-300/20 bg-[linear-gradient(160deg,#244fc5,#08142e)] p-4 shadow-[0_9px_0_-5px_rgba(0,0,0,.65)]">
        <div className="flex items-center justify-between"><span className="rounded-full bg-emerald-300 px-2 py-1 text-[9px] font-black text-emerald-950">LIVE</span><span className="text-xs text-white/50">15s rounds</span></div>
        <div className="relative flex flex-1 items-center justify-center"><span className="absolute h-28 w-28 rounded-full bg-blue-300/20 blur-2xl" /><Rocket className="lobby-float relative h-24 w-24 -rotate-12 fill-white/10 text-white drop-shadow-[0_16px_24px_rgba(0,0,0,.5)]" strokeWidth={1.5} /></div>
        <div><div className="font-display text-2xl font-black">Crash</div><div className="mt-1 text-xs text-white/60">One flight for everyone</div></div>
      </Link>
      <ModeCard href="/upgrade" title="Upgrade" subtitle="Improve a gift" icon={TrendingUp} tone="bg-[linear-gradient(145deg,#7027b8,#32134e)]" tag="NEW" />
      <ModeCard href="/battles" title="Battles" subtitle="Win the whole pot" icon={Swords} tone="bg-[linear-gradient(145deg,#b51a78,#521139)]" tag="PVP" />
      <Link href="#cases" className="lobby-card col-span-2 flex items-center gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(120deg,#265ee0,#192e76)] p-4 shadow-[0_8px_0_-5px_rgba(0,0,0,.65)]"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12"><Gift className="h-8 w-8" /></span><div className="flex-1"><div className="font-display text-xl font-black">Open cases</div><div className="text-xs text-white/60">Fresh Telegram gifts</div></div><span className="text-2xl text-white/60">›</span></Link>
    </div>
    <Link href="/deposit" className="flex items-center justify-between rounded-3xl border border-white/10 bg-[#30333d] px-4 py-3"><span className="flex items-center gap-2 text-sm font-bold"><Coin className="h-5 w-5" />Need more Stars?</span><span className="rounded-xl bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground">Top up</span></Link>
  </section>
}

function ModeCard({ href, title, subtitle, icon: Icon, tone, tag }: { href: string; title: string; subtitle: string; icon: typeof Rocket; tone: string; tag: string }) {
  return <Link href={href} className={`lobby-card relative flex min-h-[122px] flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 p-3 ${tone} shadow-[0_8px_0_-5px_rgba(0,0,0,.65)]`}><span className="absolute -right-3 -top-4 h-20 w-20 rounded-full bg-white/10 blur-xl" /><div className="relative flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20"><Icon className="h-5 w-5" /></span><span className="rounded-full bg-white/12 px-2 py-0.5 text-[8px] font-black">{tag}</span></div><div className="relative"><div className="font-display text-base font-black">{title}</div><div className="text-[10px] text-white/55">{subtitle}</div></div></Link>
}
