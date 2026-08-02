import { getCases } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { BattlesLobby } from "@/components/battles-lobby"

export const dynamic = "force-dynamic"

export default async function BattlesPage() {
  const cases = await getCases()

  return (
    <>
      <AppHeader title="Battles" />
      <main className="px-4 pt-4">
        <BattlesLobby cases={cases} />
      </main>
    </>
  )
}
