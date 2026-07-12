export function fmt(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n
  if (!isFinite(v)) return "0"
  if (Number.isInteger(v)) return v.toLocaleString("en-US")
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export const RARITY: Record<
  string,
  { label: string; text: string; ring: string; glow: string; bg: string; chip: string; bar: string }
> = {
  common: {
    label: "Common",
    text: "text-slate-300",
    ring: "ring-slate-500/40",
    glow: "shadow-[0_0_20px_-4px] shadow-slate-400/30",
    bg: "from-slate-500/15",
    chip: "bg-slate-500/15 text-slate-300",
    bar: "bg-slate-400",
  },
  rare: {
    label: "Rare",
    text: "text-cyan-300",
    ring: "ring-cyan-400/50",
    glow: "shadow-[0_0_24px_-2px] shadow-cyan-400/40",
    bg: "from-cyan-500/20",
    chip: "bg-cyan-500/15 text-cyan-300",
    bar: "bg-cyan-400",
  },
  epic: {
    label: "Epic",
    text: "text-fuchsia-300",
    ring: "ring-fuchsia-400/50",
    glow: "shadow-[0_0_24px_-2px] shadow-fuchsia-400/40",
    bg: "from-fuchsia-500/20",
    chip: "bg-fuchsia-500/15 text-fuchsia-300",
    bar: "bg-fuchsia-400",
  },
  legendary: {
    label: "Legendary",
    text: "text-amber-300",
    ring: "ring-amber-400/60",
    glow: "shadow-[0_0_28px_-2px] shadow-amber-400/50",
    bg: "from-amber-500/25",
    chip: "bg-amber-500/15 text-amber-300",
    bar: "bg-amber-400",
  },
  mythic: {
    label: "Mythic",
    text: "text-rose-300",
    ring: "ring-rose-400/60",
    glow: "shadow-[0_0_30px_0px] shadow-rose-500/50",
    bg: "from-rose-500/25",
    chip: "bg-rose-500/15 text-rose-300",
    bar: "bg-rose-400",
  },
}

export function rarityOf(key: string) {
  return RARITY[key] ?? RARITY.common
}
