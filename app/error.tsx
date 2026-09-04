"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const key = `puggift-recovered:${error.digest || "route"}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    const timer = window.setTimeout(() => window.location.reload(), 250)
    return () => window.clearTimeout(timer)
  }, [error.digest])

  return <main className="flex min-h-[var(--tg-viewport-stable-height,100dvh)] items-center justify-center bg-[#17191d] p-6 text-center">
    <section className="w-full max-w-sm rounded-[30px] bg-[#30343b] p-6 ring-1 ring-white/10">
      <img src="/images/puggift-mark-v3.svg" alt="" className="mx-auto h-20 w-20 rounded-[24px] border border-[#6685ff]/45 object-cover" />
      <h1 className="mt-4 font-display text-2xl font-black">Reconnecting the game</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/45">PugGift was updated while the Mini App was open. Refresh once to attach to the current live session.</p>
      <button onClick={() => { reset(); window.location.reload() }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#2f70ff] py-3.5 text-sm font-black text-white">
        <RefreshCw className="h-4 w-4" />Refresh game
      </button>
    </section>
  </main>
}
