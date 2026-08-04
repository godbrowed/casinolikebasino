"use client"

import { useState } from "react"
import { CrashGame } from "@/components/crash-game"
import { GiftCrashGame } from "@/components/gift-crash-game"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

type Mode = "gram" | "gift"

export function CrashModes() {
  const [mode, setMode] = useState<Mode>("gram")

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-3xl border border-white/10 bg-[#282b32] p-1.5">
        {(["gram", "gift"] as Mode[]).map((m) => (
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
            {m === "gram" ? "GRAM crash" : "Gift crash"}
          </button>
        ))}
      </div>

      {mode === "gram" ? <CrashGame /> : <GiftCrashGame />}
    </div>
  )
}
