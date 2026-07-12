import { getCases } from "@/app/actions/cases"
import { getRecentBattles } from "@/app/actions/battles"
import { AppHeader } from "@/components/app-header"
import { BattlesLobby } from "@/components/battles-lobby"

export const dynamic = "force-dynamic"

export default async function BattlesPage() {
  const [cases, recent] = await Promise.all([getCases(), getRecentBattles()])

  return (
    <>
      <AppHeader title="Battles" />
      <main className="px-4 pt-4">
        <BattlesLobby cases={cases} recent={recent} />
      </main>
    </>
  )
}
