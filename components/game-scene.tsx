"use client"

import { useEffect, useRef } from "react"

type Scene = "crash" | "pvp" | "mines" | "dice" | "free"

/** Decorative only. Never reads or predicts a game's outcome. */
export function GameScene({ kind }: { kind: Scene }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    let visible = true
    const sync = () => node.setAttribute("data-paused", String(!visible || document.hidden))
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(node)
    document.addEventListener("visibilitychange", sync)
    sync()
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync) }
  }, [])

  return <span ref={ref} className={`game-scene game-scene--${kind}`} aria-hidden="true">
    {kind === "crash" ? <img className="scene-rocket" src="/images/puggift-rocket-v7.webp" alt="" />
      : kind === "pvp" ? <>
        <img className="scene-sword scene-sword--left" src="/images/menu/sword-left.svg" alt="" />
        <img className="scene-sword scene-sword--right" src="/images/menu/sword-right.svg" alt="" />
      </>
      : kind === "mines" ? <img className="scene-mine" src="/images/menu/bomb-telegram.webp" alt="" />
      : kind === "dice" ? <img className="scene-dice" src="/images/menu/dice-telegram.png" alt="" />
      : <><img className="scene-pug" src="/images/puggift-mark-v7.webp" alt="" /><img className="scene-pug-gift" src="/images/menu/bunny-muffin.png" alt="" /></>}
  </span>
}
