import { getCases, getHomeStats } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { CaseCard } from "@/components/case-card"
import { HeroBanner } from "@/components/hero-banner"
import { GameModes } from "@/components/game-modes"
import { DailyReward } from "@/components/daily-reward"

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
      <main className="flex flex-col gap-5 pt-4">
        <HeroBanner online={stats.online} wonToday={stats.wonToday} />
        <DailyReward />
        <GameModes />
        <section className="px-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Cases</h2>
            <span className="text-xs text-muted-foreground">{cases.length} available</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
