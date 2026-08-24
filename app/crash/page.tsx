import { AppHeader } from "@/components/app-header"
import { CrashModes } from "@/components/crash-modes"

export const dynamic = "force-dynamic"

export default function CrashPage() {
  return (
    <>
      <AppHeader title="Crash" />
      <main className="flex w-full flex-1 flex-col bg-[#071126]">
        <CrashModes />
      </main>
    </>
  )
}
