import { rarityOf } from "@/lib/format"
import { cn } from "@/lib/utils"

type Drop = { id: number; name: string; rarity: string; imageUrl: string; value: number }

export function LiveDrops({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) return null
  const loop = [...drops, ...drops]
  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-2 px-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-muted-foreground">Live drops</span>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        {loop.map((d, i) => {
          const r = rarityOf(d.rarity)
          return (
            <div
              key={`${d.id}-${i}`}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card/80 p-1.5 pr-3 ring-1",
                r.ring,
              )}
            >
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-secondary", r.glow)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.imageUrl || "/images/nft-gift.png"} alt="" className="h-7 w-7 object-contain" />
              </div>
              <div className="leading-tight">
                <div className={cn("text-[11px] font-semibold", r.text)}>{d.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{d.value.toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
