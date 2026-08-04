import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function GamePageHero({ eyebrow, title, description, icon: Icon, tone = "violet" }: { eyebrow: string; title: string; description: string; icon: LucideIcon; tone?: "violet" | "pink" | "cyan" | "gold" | "green" }) {
  const tones = {
    violet: "from-[#6d28b7] to-[#33155b] text-violet-100",
    pink: "from-[#b5197f] to-[#59133f] text-pink-100",
    cyan: "from-[#2858d5] to-[#152b71] text-blue-100",
    gold: "from-[#b86a19] to-[#5b2d12] text-amber-100",
    green: "from-[#178b73] to-[#124d4a] text-emerald-100",
  }
  return <section className={cn("relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br p-5 shadow-[0_9px_0_-5px_rgba(0,0,0,.45)]", tones[tone])}>
    <div className="absolute -right-5 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
    <div className="relative flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/20"><Icon className="h-7 w-7" /></div><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">{eyebrow}</div><h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white">{title}</h1><p className="mt-1 text-xs leading-relaxed text-white/75">{description}</p></div></div>
  </section>
}
