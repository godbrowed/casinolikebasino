import { AppHeader } from "@/components/app-header"
import { CrashModes } from "@/components/crash-modes"

export const dynamic = "force-dynamic"

export default function CrashPage() {
  return (
    <>
      <AppHeader title="Crash" />
      <main className="flex flex-col gap-4 px-4 pt-4">
        <CrashModes />
      </main>
    </>
  )
}
