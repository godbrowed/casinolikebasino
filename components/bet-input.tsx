"use client"

import { Coin } from "@/components/coin"
import { cn } from "@/lib/utils"

type Props = {
  value: number
  onChange: (n: number) => void
  max: number
  disabled?: boolean
}

export function BetInput({ value, onChange, max, disabled }: Props) {
  function set(n: number) {
    onChange(Math.max(0, Math.min(Math.round(n), Math.floor(max))))
  }
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-3", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Bet amount</span>
        <span className="text-[11px] text-muted-foreground">
          Max <span className="font-mono">{Math.floor(max).toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Coin className="h-5 w-5" />
        <input
          type="number"
          inputMode="numeric"
          value={value || ""}
          disabled={disabled}
          onChange={(e) => set(Number(e.target.value))}
          placeholder="0"
          className="w-full bg-transparent font-mono text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={() => set(value / 2)}
          disabled={disabled}
          className="rounded-lg bg-secondary py-2 text-xs font-bold transition-colors hover:bg-secondary/70"
        >
          ½
        </button>
        <button
          onClick={() => set(value * 2)}
          disabled={disabled}
          className="rounded-lg bg-secondary py-2 text-xs font-bold transition-colors hover:bg-secondary/70"
        >
          2×
        </button>
        <button
          onClick={() => set(value + 100)}
          disabled={disabled}
          className="rounded-lg bg-secondary py-2 text-xs font-bold transition-colors hover:bg-secondary/70"
        >
          +100
        </button>
        <button
          onClick={() => set(max)}
          disabled={disabled}
          className="rounded-lg bg-secondary py-2 text-xs font-bold transition-colors hover:bg-secondary/70"
        >
          Max
        </button>
      </div>
    </div>
  )
}
