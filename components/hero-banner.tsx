import { Users, Flame } from "lucide-react"
import { Coin } from "@/components/coin"

export function HeroBanner({ online, wonToday }: { online: number; wonToday: number }) {
  return (
    <section className="px-4">
      <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-[linear-gradient(135deg,#673c91,#aa67cb_52%,#f18dbe)] shadow-[0_10px_0_-5px_rgba(30,12,58,.8)]">
        <div className="relative overflow-hidden">
          {/* ambient glows */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

          {/* premium welcome artwork */}
          <div className="relative flex min-h-40 items-center px-5 py-5">
            <div className="relative z-10"><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#ffe477]">Today in Giftlys</div><h2 className="mt-1 font-display text-3xl font-black leading-none tracking-tight">Play. Win.<br />Collect gifts.</h2><p className="mt-3 max-w-48 text-xs font-bold leading-relaxed text-white/80">A tiny arcade full of gifts, luck and live games.</p></div>
            <div className="absolute right-2 top-2 text-8xl rotate-12 drop-shadow-[0_7px_0_rgba(81,42,111,.45)]">🎲</div>
            <div className="absolute bottom-2 right-20 text-5xl -rotate-12">✨</div>
          </div>

          <div className="relative flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center gap-2">
              <Stat icon={<Users className="h-3.5 w-3.5 text-cyan-300" />} label="Online" value={online.toLocaleString()} />
              <Stat
                icon={<Coin className="h-3.5 w-3.5" />}
                label="Won today"
                value={wonToday.toLocaleString()}
                accent
              />
              <Stat icon={<Flame className="h-3.5 w-3.5 text-amber-300" />} label="Hot" value="Mega" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="card-premium flex flex-1 flex-col gap-0.5 rounded-xl px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`font-display text-sm font-black tabular-nums ${accent ? "text-cyan-300" : ""}`}>{value}</div>
    </div>
  )
}
