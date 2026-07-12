import { cn } from "@/lib/utils"

/** Giftlys in-game balance — the TON diamond used across every game surface. */
export function Coin({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/giftlys-coin-v2.png"
      alt=""
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 object-contain",
        glow && "drop-shadow-[0_0_8px_rgba(34,158,217,0.7)]",
        className,
      )}
    />
  )
}

export const Gram = Coin
