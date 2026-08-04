import { getCases } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { BattlesLobby } from "@/components/battles-lobby"
import { GamePageHero } from "@/components/game-page-hero"
import { Swords } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BattlesPage() {
  const cases = await getCases()

  return (
    <>
      <AppHeader title="Battles" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <GamePageHero eyebrow="PvP arena" title="Case battles" description="Choose a case, fill the room and take the whole pot." icon={Swords} tone="violet" />
        <BattlesLobby cases={cases} />
      </main>
    </>
  )
}
