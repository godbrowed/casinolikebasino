import { redirect } from "next/navigation"
import { isAdminId } from "@/lib/admin"
import { getCurrentUserId } from "@/lib/session"
import { AdminPanel } from "@/components/admin-panel"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const userId = await getCurrentUserId()
  if (!isAdminId(userId)) redirect("/")
  return <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-6"><AdminPanel /></main>
}
