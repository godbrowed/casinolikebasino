import { getHomeStats } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { HomeLobby } from "@/components/home-lobby"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  // Do not take down the entire mini app if Neon is temporarily unavailable
  // or the production database schema has not been migrated yet.
  const statsResult = await Promise.allSettled([getHomeStats()])
  const stats = statsResult[0].status === "fulfilled"
    ? statsResult[0].value
    : { online: 0, wonToday: 0 }

  return (
    <>
      <AppHeader />
      <main className="flex flex-col pb-5 pt-3">
        <HomeLobby online={stats.online} />
      </main>
    </>
  )
}
