"use client"

import { memo, useEffect, useRef, useState, type ReactNode } from "react"
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
  readMultiplier,
  children,
}: {
  phase: Phase
  multiplier: number
  payloadImage?: string | null
  collectImages?: string[]
  readMultiplier?: () => number
  children?: ReactNode
}) {
  const running = phase === "running"
  const crashed = phase === "crashed"
  const [showImpact, setShowImpact] = useState(false)
  const rocketRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const giftRefs = useRef<(HTMLImageElement | null)[]>([])
  const fallbackMultiplier = useRef(multiplier)
  fallbackMultiplier.current = multiplier

  useEffect(() => {
    if (!running) return
    let frame = 0
    const draw = () => {
      const current = readMultiplier?.() ?? fallbackMultiplier.current
      const progress = Math.min(1, Math.log(Math.max(1, current)) / Math.log(20))
      const node = rocketRef.current
      if (node) {
        // The layer has the stage's dimensions, so percentage translation
        // moves the rocket without a layout pass on every animation frame.
        node.style.transform = `translate3d(${progress * 15}%,${-progress * 31}%,0)`
      }
      if (spriteRef.current) spriteRef.current.style.transform = `translate3d(-50%,-50%,0) rotate(${-8 + progress * 5}deg)`
      giftRefs.current.forEach((gift, index) => {
        if (!gift) return
        const collected = current >= [1.35, 1.75, 2.4, 3.5, 5][index]
        gift.style.opacity = collected ? "0" : ".65"
        gift.style.transform = collected ? "scale(.3)" : "scale(1)"
      })
      frame = window.requestAnimationFrame(draw)
    }
    draw()
    return () => window.cancelAnimationFrame(frame)
  }, [readMultiplier, running])

  useEffect(() => {
    if (!crashed) {
      setShowImpact(false)
      return
    }
    setShowImpact(true)
    const id = window.setTimeout(() => setShowImpact(false), 460)
    return () => window.clearTimeout(id)
  }, [crashed])

  return <div className="crash-space-stage relative min-h-[350px] w-full overflow-hidden bg-transparent md:min-h-[420px] lg:min-h-[440px]">
    <Starfield moving={running} />

    {(running || phase === "cashed") && <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id="pug-trail" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="rgba(89,146,255,0)" /><stop offset="1" stopColor="rgba(126,179,255,.7)" /></linearGradient></defs>
        <path d="M 38 80 Q 44 61, 60 30" fill="none" stroke="url(#pug-trail)" strokeWidth=".65" strokeLinecap="round" />
      </svg>

      {collectImages.slice(0, 5).map((src, index) => {
        return <img
          key={`${src}-${index}`}
          ref={(node) => { giftRefs.current[index] = node }}
          src={src || "/images/nft-gift.png"}
          alt=""
          aria-hidden
          className="absolute h-8 w-8 object-contain transition-[transform,opacity] duration-200 md:h-10 md:w-10"
          style={{ left: `${18 + index * 16}%`, top: `${25 + (index % 2) * 30}%` }}
        />
      })}

      <div ref={rocketRef} className="pointer-events-none absolute inset-0 z-10 will-change-transform">
        <div ref={spriteRef} className="absolute left-[45%] top-[61%]" style={{ transform: "translate3d(-50%,-50%,0) rotate(-8deg)" }}>
          <img src="/images/puggift-rocket-v5.webp" alt="PugGift rocket" className="h-40 w-40 object-contain mix-blend-lighten md:h-56 md:w-56" />
          {payloadImage && <img src={payloadImage} alt="" aria-hidden className="absolute -bottom-1 -left-2 h-9 w-9 object-contain drop-shadow-lg md:h-11 md:w-11" />}
        </div>
      </div>
    </>}

    {crashed && showImpact && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center pt-16">
      <img
        src="/images/puggift-rocket-v5.webp"
        alt="PugGift crash impact"
        className="animate-pug-impact w-[min(58vw,260px)] object-contain mix-blend-lighten"
        style={{ animationDuration: "440ms" }}
      />
    </div>}

    <div className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex flex-col items-center px-4 text-center md:top-[10%]">{children}</div>
  </div>
}

const Starfield = memo(function Starfield({ moving }: { moving: boolean }) {
  return <div className={cn("crash-stars absolute -inset-y-[10%] inset-x-0 transition-transform duration-[2400ms] ease-linear", moving && "translate-y-[7%]")} aria-hidden />
})
