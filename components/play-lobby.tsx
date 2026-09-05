import Link from "next/link"
import { Play, Sparkles } from "lucide-react"

export function PlayLobby() {
  return <section className="px-4"><div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(75,114,251,.2),rgba(50,65,112,.14),rgba(15,19,31,.24))] p-4"><img src="/images/puggift-mark-v4.svg" alt="" className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-[36px] object-cover opacity-25" /><div className="relative"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> PugGift arcade</div><h1 className="font-display text-2xl font-black tracking-tight">What do you want<br />to play today?</h1><p className="mt-1 max-w-[230px] text-xs leading-relaxed text-foreground/70">Choose a game, collect gifts, and climb the daily board.</p><Link href="/crash" className="app-cta mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black"><Play className="h-4 w-4 fill-current" /> I want to play</Link></div></div></section>
}
