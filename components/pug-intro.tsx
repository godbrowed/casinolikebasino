"use client"

import { useEffect, useState } from "react"

export function PugIntro() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 760)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null

  return <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#090d16] transition-opacity">
    <div className="pug-loader relative h-24 w-24 rounded-[30px] bg-[#11182b] shadow-[0_0_0_8px_rgba(79,117,255,.08),0_24px_60px_rgba(0,0,0,.6)]">
      <img src="/images/puggift-mark-v3.svg" alt="" className="h-full w-full rounded-[30px] object-cover" />
    </div>
    <div className="mt-5 font-display text-xl font-black">Pug<span className="text-[#4d7bff]">Gift</span></div>
    <div className="mt-3 flex gap-1.5">{[0, 1, 2].map((index) => <i key={index} className="pug-loader-dot h-2 w-2 rounded-full bg-[#4d7bff]" style={{ animationDelay: `${index * .14}s` }} />)}</div>
  </div>
}
