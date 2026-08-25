import { getInventory, getHistory, getMe } from "@/app/actions/user"
import { AppHeader } from "@/components/app-header"
import { ProfileView } from "@/components/profile-view"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const [meResult, inventoryResult, historyResult] = await Promise.allSettled([getMe(), getInventory(), getHistory()])
  const me = meResult.status === "fulfilled" ? meResult.value : null
  const inventory = inventoryResult.status === "fulfilled" ? inventoryResult.value : []
  const history = historyResult.status === "fulfilled" ? historyResult.value : []
  return (
    <>
      <AppHeader title="Profile" />
      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-3 pt-5 md:px-4">
        <ProfileView
          me={me}
          inventory={inventory.map((i) => ({
            id: i.id,
            name: i.name,
            rarity: i.rarity,
            imageUrl: i.imageUrl,
            value: i.value,
          }))}
          history={history}
        />
      </main>
    </>
  )
}
