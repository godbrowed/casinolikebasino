"use client"

import { useEffect, useState } from "react"

export function PugIntro() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1450)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null

  return <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#191b1f] transition-opacity">
    <div className="pug-loader relative h-28 w-28 rounded-full bg-[#0e2c83] shadow-[0_0_0_10px_rgba(47,112,255,.1),0_24px_60px_rgba(0,0,0,.6)]">
      <img src="/images/puggift-bot-avatar-web-v2.webp" alt="" className="h-full w-full rounded-full object-cover" />
      <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#191b1f] bg-[#2f70ff] text-lg">🎁</span>
    </div>
    <div className="mt-5 font-display text-xl font-black">Pug<span className="text-[#4d7bff]">Gift</span></div>
    <div className="mt-3 flex gap-1.5">{[0, 1, 2].map((index) => <i key={index} className="pug-loader-dot h-2 w-2 rounded-full bg-[#4d7bff]" style={{ animationDelay: `${index * .14}s` }} />)}</div>
  </div>
}
