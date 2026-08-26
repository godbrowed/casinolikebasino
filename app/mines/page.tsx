import { AppHeader } from "@/components/app-header"
import { MinesGame } from "@/components/mines-game"

export const dynamic = "force-dynamic"

export default function MinesPage() {
  return <><AppHeader title="Mines" /><MinesGame /></>
}
