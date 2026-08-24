import { cn } from "@/lib/utils"

/** Giftlys in-game Stars balance used across every game surface. */
export function Coin({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none [font-family:'Apple_Color_Emoji','Segoe_UI_Emoji',sans-serif]",
        glow && "drop-shadow-[0_0_8px_rgba(255,184,43,0.75)]",
        className,
      )}
    >
      ⭐
    </span>
  )
}

export const Gram = Coin
