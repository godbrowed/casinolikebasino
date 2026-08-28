import { AppHeader } from "@/components/app-header"
import { DiceGame } from "@/components/dice-game"

export const dynamic = "force-dynamic"

export default function DicePage() {
  return <><AppHeader title="Pug Dice" /><DiceGame /></>
}
