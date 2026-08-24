"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Phase = "idle" | "running" | "cashed" | "crashed"

/**
 * Animated crash stage: a rocket climbs as the multiplier grows, trailing an
 * optional NFT gift and scooping up floating gifts along the way. Explodes on
 * crash. Pure presentational — parent owns game state.
 */
export function CrashRocket({
  phase,
  multiplier,
  payloadImage,
  collectImages = [],
  children,
}: {
  phase: Phase
  multiplier: number
  /** Gift that rides with the rocket (gift crash mode). */
  payloadImage?: string | null
  /** Floating gifts the rocket collects as it climbs. */
  collectImages?: string[]
  /** Center overlay (multiplier readout etc.). */
  children?: React.ReactNode
}) {
  const running = phase === "running"
  const crashed = phase === "crashed"

  // Time-based liftoff so the rocket visibly launches on every round (even the
  // low crash points) instead of staying glued to the pad.
  const [liftoff, setLiftoff] = useState(false)
  useEffect(() => {
    if (!running) {
      setLiftoff(false)
      return
    }
    const id = window.setTimeout(() => setLiftoff(true), 60)
    return () => window.clearTimeout(id)
  }, [running])

  // Rocket position: climbs from bottom-left toward top-right. Blend a small
  // time-based liftoff with the multiplier-based climb so it always leaves the pad.
  const multClimb = Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(15))
  // Keep the rocket at the actual end point after a crash. Resetting it to
  // the launch pad made a finished shared round look as if it was still flying.
  const climb = running ? Math.max(liftoff ? 0.08 : 0, multClimb) : (phase === "cashed" || phase === "crashed") ? multClimb : 0
  const x = 12 + climb * 62 // %
  const y = 82 - climb * 64 // % (from top)
  const angle = -3 - climb * 4

  // Which floating gifts have been "collected" (multiplier thresholds).
  const thresholds = [1.5, 2.5, 4, 7, 11]

  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] min-h-[420px] w-full flex-col items-center justify-center overflow-hidden rounded-[30px] border bg-[#071126] md:aspect-auto md:min-h-[540px] md:rounded-none md:border-x-0 lg:min-h-[620px]",
        crashed ? "border-rose-500/50" : running ? "border-primary/40" : "border-border",
      )}
    >
      {/* Deep-space board: deliberately transform-only animation, so phones do not reflow it every frame. */}
      <Starfield running={running} />
      <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_15%,rgba(96,165,250,.32),transparent_18%),radial-gradient(circle_at_85%_72%,rgba(168,85,247,.22),transparent_24%)]" />
      <MeteorField running={running} />
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          crashed
            ? "bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,113,133,0.35),transparent_60%)] opacity-100"
            : running
              ? "bg-[radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.28),transparent_60%)] opacity-100"
              : "opacity-0",
        )}
      />

      {/* trajectory trail */}
      {(running || phase === "cashed" || crashed) && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trail" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(34,211,238,0)" />
              <stop offset="1" stopColor="rgba(34,211,238,0.7)" />
            </linearGradient>
          </defs>
          <path
            d={`M 12 82 Q ${(12 + x) / 2} ${82}, ${x} ${y}`}
            fill="none"
            stroke="url(#trail)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* floating collectible gifts */}
      {(running || phase === "cashed" || phase === "idle") &&
        collectImages.slice(0, 5).map((img, i) => {
          const gx = 26 + i * 15
          const gy = 20 + ((i % 3) * 16)
          const collected = (running || phase === "cashed") && multiplier >= thresholds[i]
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={img || "/images/nft-gift.png"}
              alt=""
              aria-hidden
              className={cn(
                "absolute h-8 w-8 object-contain transition-all duration-500",
                collected ? "scale-0 opacity-0" : "animate-float opacity-90",
              )}
              style={{ left: `${gx}%`, top: `${gy}%`, animationDelay: `${i * 0.4}s` }}
            />
          )
        })}

      {/* rocket + payload */}
      {(running || phase === "cashed" || crashed) && (
        <div
          className="absolute z-10 transition-all duration-200 ease-out"
          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${angle}deg)` }}
        >
          <div className="relative">
            <Rocket />
            {/* payload gift trailing behind */}
            {payloadImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={payloadImage || "/images/nft-gift.png"}
                alt=""
                aria-hidden
                className="absolute -left-6 top-1 h-7 w-7 object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* explosion */}
      {crashed && (
        <div
          className="absolute z-10"
          style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}
        >
          <div className="h-16 w-16 animate-pop-in rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.9),rgba(251,113,133,0.5),transparent_70%)] blur-[2px]" />
        </div>
      )}

      {/* center overlay */}
      <div className="relative z-20 flex flex-col items-center text-center">{children}</div>
    </div>
  )
}

function Rocket() {
  return (
    // The dark background is deliberately identical to the stage, allowing a
    // detailed raster mascot without an expensive per-frame alpha effect.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/puggift-rocket-web-v1.webp" alt="" aria-hidden className="h-28 w-28 rounded-[28%] object-contain md:h-48 md:w-48" />
  )
}

function Starfield({ running }: { running: boolean }) {
  // Generate on the client only to avoid SSR hydration mismatch from Math.random.
  const [stars, setStars] = useState<{ left: number; top: number; size: number; delay: number }[]>([])
  useEffect(() => {
    setStars(
      Array.from({ length: 12 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 1.6 + 0.6,
        delay: Math.random() * 3,
      })),
    )
  }, [])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.style.transform = running ? "translateY(6%)" : "translateY(0)"
  }, [running])
  return (
    <div ref={ref} className="absolute inset-0 transition-transform duration-1000">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/70"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle 2.5s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function MeteorField({ running }: { running: boolean }) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
    {[12, 31, 54, 76].map((top, index) => <span key={top} className={cn("absolute h-px w-24 -rotate-45 bg-gradient-to-r from-transparent via-blue-100 to-transparent", running && "animate-pulse")} style={{ top: `${top}%`, left: `${(index * 29) - 12}%`, animationDelay: `${index * .25}s` }} />)}
  </div>
}
