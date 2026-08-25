import { AppHeader } from "@/components/app-header"
import { BattlesLobby } from "@/components/battles-lobby"

export const dynamic = "force-dynamic"

export default function BattlesPage() {
  return (
    <>
      <AppHeader title="Battles" />
      <main className="mx-auto flex w-full max-w-[760px] flex-col px-3 pt-4 md:px-4">
        <BattlesLobby />
      </main>
    </>
  )
}
