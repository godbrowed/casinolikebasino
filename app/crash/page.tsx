import Link from "next/link"
import { ArrowLeft, Clock3, Wrench } from "lucide-react"
import { AppHeader } from "@/components/app-header"

export const dynamic = "force-dynamic"

export default function CrashPage() {
  return (
    <>
      <AppHeader title="Crash" />
      <main className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-[#071126] px-4 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(47,112,255,.22),transparent_38%),radial-gradient(circle_at_18%_76%,rgba(139,76,255,.12),transparent_30%)]" />
        <section className="relative w-full max-w-[520px] overflow-hidden rounded-[36px] bg-[#111d33] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,.4)] ring-1 ring-white/10 md:p-9">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] bg-[#2f70ff]/15 text-[#78a0ff] ring-1 ring-[#6f96ff]/25 shadow-[0_0_50px_rgba(47,112,255,.22)]">
            <Wrench className="h-11 w-11" strokeWidth={2.4} />
          </div>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-amber-200 ring-1 ring-amber-200/15"><Clock3 className="h-3.5 w-3.5" />Maintenance</span>
          <h1 className="mt-4 font-display text-3xl font-black text-white md:text-4xl">Crash на техроботах</h1>
          <p className="mx-auto mt-3 max-w-[390px] text-sm font-semibold leading-relaxed text-white/50">Ми тимчасово закрили режим і перевіряємо математику та стабільність раундів. Нові ставки зараз не приймаються.</p>
          <Link href="/" className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f70ff] py-4 font-display text-base font-black text-white shadow-[0_12px_30px_rgba(47,112,255,.28)] transition active:scale-[.98]"><ArrowLeft className="h-5 w-5" />Повернутися до ігор</Link>
        </section>
      </main>
    </>
  )
}
