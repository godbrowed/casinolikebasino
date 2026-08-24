import { getInventory } from "@/app/actions/user"
import { getUpgradeTargets } from "@/app/actions/upgrade"
import { AppHeader } from "@/components/app-header"
import { UpgradeGame } from "@/components/upgrade-game"

export const dynamic = "force-dynamic"

export default async function UpgradePage() {
  const [inventory, targets] = await Promise.all([getInventory(), getUpgradeTargets()])
  return (
    <>
      <AppHeader title="Upgrade" />
      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-3 pt-5 md:px-4">
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
