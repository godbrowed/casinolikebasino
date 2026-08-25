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
            <div key={`${d.id}-${i}`} className="flex h-11 w-11 shrink-0 items-center justify-center">
              <div className={cn("flex h-11 w-11 items-center justify-center", r.glow)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.imageUrl || "/images/nft-gift.png"} alt="" className="h-11 w-11 object-contain" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
