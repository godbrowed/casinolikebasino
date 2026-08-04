import { AppHeader } from "@/components/app-header"
import { CrashModes } from "@/components/crash-modes"
import { GamePageHero } from "@/components/game-page-hero"
import { Rocket } from "lucide-react"

export const dynamic = "force-dynamic"

export default function CrashPage() {
  return (
    <>
      <AppHeader title="Crash" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <GamePageHero eyebrow="Live arena" title="Crash arena" description="Join the shared launch. Every player takes off together." icon={Rocket} tone="pink" />
        <CrashModes />
      </main>
    </>
  )
}
