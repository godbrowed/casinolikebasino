import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function GamePageHero({ eyebrow, title, description, icon: Icon, tone = "violet" }: { eyebrow: string; title: string; description: string; icon: LucideIcon; tone?: "violet" | "pink" | "cyan" | "gold" | "green" }) {
  const tones = {
    violet: "from-violet-500/35 via-fuchsia-500/18 to-transparent text-violet-200",
    pink: "from-rose-500/35 via-fuchsia-500/18 to-transparent text-rose-200",
    cyan: "from-cyan-500/35 via-blue-500/18 to-transparent text-cyan-200",
    gold: "from-amber-400/35 via-orange-500/18 to-transparent text-amber-100",
    green: "from-emerald-400/35 via-cyan-500/18 to-transparent text-emerald-100",
  }
  return <section className={cn("relative overflow-hidden rounded-[30px] border border-white/15 bg-gradient-to-br p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_12px_0_-7px_rgba(30,12,58,.85)]", tones[tone])}>
    <div className="absolute -right-5 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
    <div className="relative flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/20 shadow-[0_5px_0_rgba(30,12,58,.5)]"><Icon className="h-7 w-7" /></div><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">{eyebrow}</div><h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white">{title}</h1><p className="mt-1 text-xs leading-relaxed text-white/75">{description}</p></div></div>
  </section>
}
