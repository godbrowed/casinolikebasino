import { AppHeader } from "@/components/app-header"
import { DepositView } from "@/components/deposit-view"
import { STAR_PACKS, TON_PACKS, TON_TO_GRAM } from "@/lib/deposit-shared"
import { getDepositGiftCatalog, getRelayerInfo } from "@/app/actions/gifts-transfer"

export const dynamic = "force-dynamic"

export default async function DepositPage() {
  const [giftCatalog, relayer] = await Promise.all([getDepositGiftCatalog(), getRelayerInfo()])

  return (
    <>
      <AppHeader title="Deposit" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <DepositView
          starPacks={STAR_PACKS}
          tonPacks={TON_PACKS}
          tonRate={TON_TO_GRAM}
          giftCatalog={giftCatalog}
          relayer={relayer}
        />
      </main>
    </>
  )
}
