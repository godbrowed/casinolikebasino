import { getInventory, getHistory, getMe } from "@/app/actions/user"
import { AppHeader } from "@/components/app-header"
import { ProfileView } from "@/components/profile-view"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const [me, inventory, history] = await Promise.all([getMe(), getInventory(), getHistory()])
  return (
    <>
      <AppHeader title="Profile" />
      <main className="flex flex-col gap-4 px-4 pt-4">
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
