import { cn } from "@/lib/utils"

/** PugGift in-game Stars balance used across every game surface. */
export function Coin({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/puggift-star.svg"
      alt=""
      aria-hidden
      className={cn(
        "inline-block shrink-0 object-contain",
        glow && "drop-shadow-[0_0_8px_rgba(255,184,43,0.75)]",
        className,
      )}
    />
  )
}

export const Gram = Coin
