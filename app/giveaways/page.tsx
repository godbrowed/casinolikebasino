import { AppHeader } from "@/components/app-header"
import { GiveawaysView } from "@/components/giveaways-view"

export const dynamic = "force-dynamic"

export default function GiveawaysPage() {
  return (
    <>
      <AppHeader title="Giveaways" />
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-28 pt-4 md:px-6 md:pt-6">
        <GiveawaysView />
      </main>
    </>
  )
}
