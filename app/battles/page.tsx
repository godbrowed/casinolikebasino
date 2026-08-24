import { AppHeader } from "@/components/app-header"
import { BattlesLobby } from "@/components/battles-lobby"

export const dynamic = "force-dynamic"

export default function BattlesPage() {
  return (
    <>
      <AppHeader title="Battles" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <BattlesLobby />
      </main>
    </>
  )
}
