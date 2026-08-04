import { getCases, getHomeStats } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { CaseCard } from "@/components/case-card"
import { DailyReward } from "@/components/daily-reward"
import { HomeLobby } from "@/components/home-lobby"
import { ShieldCheck, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  // Do not take down the entire mini app if Neon is temporarily unavailable
  // or the production database schema has not been migrated yet.
  const [casesResult, statsResult] = await Promise.allSettled([getCases(), getHomeStats()])
  const cases = casesResult.status === "fulfilled" ? casesResult.value : []
  const stats = statsResult.status === "fulfilled"
    ? statsResult.value
    : { online: 0, wonToday: 0 }

  return (
    <>
      <AppHeader />
      <main className="flex flex-col gap-6 pt-4">
        <HomeLobby online={stats.online} />
        <DailyReward />
        <section id="cases" className="px-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" /> Curated drops
              </div>
              <h2 className="font-display text-xl font-black tracking-tight">Choose your case</h2>
              <p className="mt-1 text-xs text-muted-foreground">Real Telegram gifts. Transparent odds.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> 90% RTP
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
          {cases.length === 0 && (
            <div className="surface-panel rounded-3xl px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold">Cases are syncing</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Fresh market prices and rewards will appear here shortly.</p>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
