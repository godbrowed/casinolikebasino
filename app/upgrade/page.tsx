import { getInventory } from "@/app/actions/user"
import { getUpgradeTargets } from "@/app/actions/upgrade"
import { AppHeader } from "@/components/app-header"
import { UpgradeGame } from "@/components/upgrade-game"
import { GamePageHero } from "@/components/game-page-hero"
import { TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function UpgradePage() {
  const [inventory, targets] = await Promise.all([getInventory(), getUpgradeTargets()])
  return (
    <>
      <AppHeader title="Upgrade" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <GamePageHero eyebrow="Risk room" title="Gift upgrade" description="Send one gift into the machine and aim for a higher tier." icon={TrendingUp} tone="cyan" />
        <UpgradeGame
          inventory={inventory.map((i) => ({
            id: i.id,
            name: i.name,
            rarity: i.rarity,
            imageUrl: i.imageUrl,
            value: i.value,
          }))}
          targets={targets}
        />
      </main>
    </>
  )
}
