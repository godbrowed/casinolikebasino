import { getCases } from "@/app/actions/cases"
import { AppHeader } from "@/components/app-header"
import { CaseCard } from "@/components/case-card"
import { Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CasesPage() {
  const result = await Promise.allSettled([getCases()])
  const cases = result[0].status === "fulfilled" ? result[0].value : []

  return <>
    <AppHeader title="Cases" />
    <main className="mx-auto w-full max-w-[980px] px-3 pb-8 pt-5 md:px-5">
      <div className="app-panel relative mb-5 overflow-hidden rounded-[28px] px-5 py-5 md:px-6 md:py-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#4f75ff]/16 blur-3xl" />
        <img src="/images/puggift-cases-card-v2.webp" alt="" className="absolute -bottom-8 -right-4 h-40 w-40 object-cover opacity-55 [mask-image:linear-gradient(to_right,transparent,black_38%)] md:h-52 md:w-52" />
        <div className="relative max-w-[70%]"><div className="app-kicker flex items-center gap-1.5"><Sparkles className="h-3 w-3" />PugGift drops</div><h1 className="app-title mt-1 text-3xl md:text-4xl">Choose your case</h1><p className="mt-2 text-xs font-semibold leading-relaxed text-white/42">Open one or several reels and keep the gifts you like.</p></div>
      </div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="app-kicker">Available now</div>
          <h2 className="app-title mt-0.5 text-xl">Cases</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{cases.map((c) => <CaseCard key={c.id} c={c} />)}</div>
      {cases.length === 0 && <div className="surface-panel rounded-3xl px-5 py-10 text-center"><Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" /><h2 className="font-display font-bold">Cases are syncing</h2><p className="mt-1 text-xs text-muted-foreground">Fresh gifts will appear here shortly.</p></div>}
    </main>
  </>
}
