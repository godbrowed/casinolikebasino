"use client"

import { useState } from "react"
import { CrashGame } from "@/components/crash-game"
import { GiftCrashGame } from "@/components/gift-crash-game"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Mode = "stars" | "gift"

export function CrashModes() {
  const [mode, setMode] = useState<Mode>("stars")

  return (
    <div className="flex w-full flex-col bg-[#071126]">
      <div className="mx-auto my-2 grid w-[260px] grid-cols-2 gap-1 rounded-full bg-white/[.08] p-1 ring-1 ring-white/[.07]">
        {(["stars", "gift"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              haptic("light")
              setMode(m)
            }}
            className={cn(
              "rounded-full py-2 font-display text-xs font-bold transition-all",
              mode === m ? "bg-[#2f70ff] text-white" : "text-white/45",
            )}
          >
            {m === "stars" ? "Stars" : "Gifts"}
          </button>
        ))}
      </div>

      {mode === "stars" ? <CrashGame /> : <GiftCrashGame />}
    </div>
  )
}
