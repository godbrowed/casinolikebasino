import { getInventory, getHistory, getMe } from "@/app/actions/user"
import { AppHeader } from "@/components/app-header"
import { ProfileView } from "@/components/profile-view"
import { getFreeCaseClaimStatus } from "@/lib/free-case-referrals"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const me = await getMe().catch(() => null)
  const freeCaseClaim = me ? await getFreeCaseClaimStatus(me.id).catch(() => null) : null
  const [inventoryResult, historyResult] = await Promise.allSettled([getInventory(true), getHistory()])
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
            source: i.source,
            locked: i.locked,
          }))}
          history={history}
          freeCaseClaim={freeCaseClaim}
        />
      </main>
    </>
  )
}
