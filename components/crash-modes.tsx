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
    <div className="flex w-full flex-col gap-4">
      <div className="mx-auto grid w-[calc(100%-1.5rem)] max-w-[560px] grid-cols-2 gap-1 rounded-3xl border border-white/10 bg-[#282b32] p-1.5">
        {(["stars", "gift"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              haptic("light")
              setMode(m)
            }}
            className={cn(
              "rounded-2xl py-3 font-display text-sm font-bold transition-all",
              mode === m ? "bg-primary text-primary-foreground shadow-[0_5px_0_#1938a8]" : "text-muted-foreground",
            )}
          >
            {m === "stars" ? "Stars crash" : "Gift crash"}
          </button>
        ))}
      </div>

      {mode === "stars" ? <CrashGame /> : <GiftCrashGame />}
    </div>
  )
}
