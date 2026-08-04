import Link from "next/link"
import { CirclePlay, Gift, Rocket, Swords, TrendingUp, Users } from "lucide-react"
import { Coin } from "@/components/coin"

const GAMES = [
  { href: "/crash", title: "Crash", subtitle: "Shared live launch", icon: Rocket, tone: "from-[#101d41] to-[#071124]", tag: "LIVE" },
  { href: "/battles", title: "Case battles", subtitle: "Fight for the whole pot", icon: Swords, tone: "from-[#7024a6] to-[#361255]", tag: "PVP" },
  { href: "/upgrade", title: "Upgrade", subtitle: "Turn one gift into more", icon: TrendingUp, tone: "from-[#46227f] to-[#241444]", tag: "NEW" },
  { href: "#cases", title: "Open cases", subtitle: "Choose your surprise", icon: Gift, tone: "from-[#2054c9] to-[#182e77]", tag: "DROPS" },
]

export function HomeLobby({ online }: { online: number }) {
  return <section className="flex flex-col gap-3 px-4">
    <div className="flex items-center gap-3 overflow-hidden rounded-3xl border border-white/10 bg-[#282b32] px-4 py-3">
      <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.9)]" />
      <span className="text-sm font-black uppercase tracking-widest">Live</span>
      <div className="flex gap-3 text-2xl opacity-90"><span>🎁</span><span>💎</span><span>🎲</span><span>🚀</span><span>👑</span><span>🧸</span><span>🍀</span></div>
    </div>
    <div className="rounded-[28px] border border-[#4a74ff] bg-[#2f5bff] p-4 shadow-[0_8px_0_#1938a8]">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#2f5bff]"><CirclePlay className="h-6 w-6 fill-current" /></span><div><div className="font-display text-lg font-black">Start playing in seconds</div><div className="text-xs font-medium text-white/70">Open a case or join a live game</div></div></div>
    </div>
    <div className="mt-2 flex items-center justify-between px-1"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Giftlys arcade</div><h1 className="font-display text-2xl font-black">Pick your game</h1></div><div className="flex items-center gap-1 text-xs font-bold text-emerald-300"><Users className="h-3.5 w-3.5" />{online} online</div></div>
    <div className="flex flex-col gap-3">{GAMES.map((game) => { const Icon = game.icon; return <Link key={game.title} href={game.href} className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-r ${game.tone} p-4 shadow-[0_8px_0_-4px_rgba(0,0,0,.55)] active:translate-y-0.5`}><div className="absolute -right-4 -top-5 text-8xl opacity-10">{game.title === "Crash" ? "🚀" : game.title === "Upgrade" ? "🎁" : "🎲"}</div><div className="relative flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/20 text-white"><Icon className="h-7 w-7" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-display text-xl font-black">{game.title}</span><span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-black">{game.tag}</span></div><div className="mt-0.5 text-xs font-medium text-white/65">{game.subtitle}</div></div><span className="text-2xl text-white/70">›</span></div></Link> })}</div>
    <Link href="/deposit" className="flex items-center justify-between rounded-3xl border border-white/10 bg-[#30333d] px-4 py-3"><span className="flex items-center gap-2 text-sm font-bold"><Coin className="h-5 w-5" />Need more GRAM?</span><span className="rounded-xl bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground">Top up</span></Link>
  </section>
}
