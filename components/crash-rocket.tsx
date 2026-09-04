"use client"

import { memo, useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Phase = "idle" | "running" | "cashed" | "crashed"

/** Lightweight, full-bleed crash scene. Game state stays in the parent; this
 * component only animates transforms and opacity so it remains smooth on
 * Telegram's mobile webview. */
export function CrashRocket({
  phase,
  multiplier,
  payloadImage,
  collectImages = [],
  children,
}: {
  phase: Phase
  multiplier: number
  payloadImage?: string | null
  collectImages?: string[]
  children?: ReactNode
}) {
  const running = phase === "running"
  const crashed = phase === "crashed"
  const [liftoff, setLiftoff] = useState(false)

  useEffect(() => {
    if (!running) {
      setLiftoff(false)
      return
    }
    const id = window.setTimeout(() => setLiftoff(true), 40)
    return () => window.clearTimeout(id)
  }, [running])

  const climbByMultiplier = Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(20))
  const climb = running ? Math.max(liftoff ? 0.035 : 0, climbByMultiplier) : phase === "cashed" ? climbByMultiplier : 0
  const x = 45 + climb * 15
  const y = 61 - climb * 31
  const thresholds = [1.35, 1.75, 2.4, 3.5, 5]

  return <div className="crash-space-stage relative min-h-[350px] w-full overflow-hidden bg-transparent md:min-h-[420px] lg:min-h-[440px]">
    <Starfield moving={running} />

    {(running || phase === "cashed") && <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id="pug-trail" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="rgba(89,146,255,0)" /><stop offset="1" stopColor="rgba(126,179,255,.7)" /></linearGradient></defs>
        <path d={`M 38 80 Q 43 66, ${x} ${y}`} fill="none" stroke="url(#pug-trail)" strokeWidth=".65" strokeLinecap="round" />
      </svg>

      {collectImages.slice(0, 5).map((src, index) => {
        const collected = multiplier >= thresholds[index]
        return <img
          key={`${src}-${index}`}
          src={src || "/images/nft-gift.png"}
          alt=""
          aria-hidden
          className={cn("absolute h-8 w-8 object-contain transition duration-300 md:h-10 md:w-10", collected ? "scale-0 opacity-0" : "animate-float opacity-80")}
          style={{ left: `${18 + index * 16}%`, top: `${25 + (index % 2) * 30}%`, animationDelay: `${index * .35}s` }}
        />
      })}

      <div className="absolute z-10 transition-[left,top,transform] duration-200 ease-out" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${-8 + climb * 5}deg)` }}>
        <div className="relative">
          <img src="/images/puggift-rocket-web-v1.webp" alt="PugGift rocket" className="h-36 w-36 object-contain md:h-52 md:w-52" style={{ WebkitMaskImage: "radial-gradient(ellipse 55% 55% at center, #000 64%, transparent 100%)", maskImage: "radial-gradient(ellipse 55% 55% at center, #000 64%, transparent 100%)" }} />
          {payloadImage && <img src={payloadImage} alt="" aria-hidden className="absolute -bottom-1 -left-2 h-9 w-9 object-contain drop-shadow-lg md:h-11 md:w-11" />}
        </div>
      </div>
    </>}

    {crashed && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center pt-16">
      <span className="absolute h-40 w-40 animate-ping rounded-full border border-rose-300/15" />
      <img
        src="/images/puggift-falling-web-v1.webp"
        alt="Pug falling after the crash"
        className="animate-pug-fall w-[min(82vw,430px)] object-contain"
        style={{ WebkitMaskImage: "radial-gradient(ellipse 58% 64% at center, #000 58%, transparent 100%)", maskImage: "radial-gradient(ellipse 58% 64% at center, #000 58%, transparent 100%)" }}
      />
    </div>}

    <div className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex flex-col items-center px-4 text-center md:top-[10%]">{children}</div>
  </div>
}

const STARS = Array.from({ length: 46 }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    top: (index * 61 + 7) % 100,
    size: index % 8 === 0 ? 3 : index % 3 === 0 ? 2 : 1,
    delay: (index % 9) * .23,
  }))

const Starfield = memo(function Starfield({ moving }: { moving: boolean }) {
  return <div className={cn("absolute -inset-y-[10%] inset-x-0 transition-transform duration-[1800ms] ease-linear", moving && "translate-y-[8%]")} aria-hidden>
    {STARS.map((star, index) => <span key={index} className="absolute bg-white/75" style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, animation: `twinkle 2.8s ease-in-out ${star.delay}s infinite` }} />)}
  </div>
})
