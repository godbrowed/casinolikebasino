import { notFound } from "next/navigation"
import { getCaseBySlug } from "@/app/actions/cases"
import { CaseView } from "@/components/case-view"
import { AppHeader } from "@/components/app-header"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let c = null
  try {
    c = await getCaseBySlug(slug)
  } catch {
    return <><AppHeader title="Case" /><main className="mx-auto flex min-h-[70dvh] w-full max-w-[620px] items-center px-4"><section className="app-panel w-full rounded-[30px] p-6 text-center"><img src="/images/puggift-mark-v3.svg" alt="" className="mx-auto h-20 w-20 rounded-[24px] object-cover" /><h1 className="mt-4 font-display text-2xl font-black">Case is reconnecting</h1><p className="mt-2 text-sm text-white/45">The gift catalog is temporarily unavailable. Your balance was not charged.</p><Link href={`/case/${slug}`} className="app-cta mt-5 inline-flex rounded-[18px] px-5 py-3 text-sm font-black">Try again</Link></section></main></>
  }
  if (!c) notFound()
  return <CaseView c={c} />
}
