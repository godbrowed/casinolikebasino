import { notFound } from "next/navigation"
import { getCaseBySlug } from "@/app/actions/cases"
import { CaseView } from "@/components/case-view"

export const dynamic = "force-dynamic"

export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await getCaseBySlug(slug)
  if (!c) notFound()
  return <CaseView c={c} />
}
