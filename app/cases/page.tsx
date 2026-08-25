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
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><Sparkles className="h-3 w-3" />Gift drops</div>
          <h1 className="font-display text-2xl font-black tracking-tight">Choose your case</h1>
          <p className="mt-1 text-xs text-muted-foreground">Pick a case and open several at once.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{cases.map((c) => <CaseCard key={c.id} c={c} />)}</div>
      {cases.length === 0 && <div className="surface-panel rounded-3xl px-5 py-10 text-center"><Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" /><h2 className="font-display font-bold">Cases are syncing</h2><p className="mt-1 text-xs text-muted-foreground">Fresh gifts will appear here shortly.</p></div>}
    </main>
  </>
}
