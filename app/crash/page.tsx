import { AppHeader } from "@/components/app-header"
import { CrashModes } from "@/components/crash-modes"

export const dynamic = "force-dynamic"

export default function CrashPage() {
  return (
    <>
      <AppHeader title="Crash" />
      <main className="game-surface game-surface--crash flex w-full flex-1"><CrashModes /></main>
    </>
  )
}
