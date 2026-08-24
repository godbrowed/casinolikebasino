import { cn } from "@/lib/utils"

/** Giftlys in-game Stars balance used across every game surface. */
export function Coin({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn(
        "inline-block shrink-0",
        glow && "drop-shadow-[0_0_8px_rgba(255,184,43,0.75)]",
        className,
      )}
    >
      <path d="m12 2.5 2.8 5.68 6.27.91-4.54 4.43 1.07 6.25L12 16.82l-5.6 2.95 1.07-6.25-4.54-4.43 6.27-.91L12 2.5Z" fill="#FFBE3F" stroke="#FFF1A8" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="m12 5.7 1.55 3.15 3.48.5-2.52 2.46.6 3.46L12 13.64V5.7Z" fill="#FF8A23" opacity=".9" />
    </svg>
  )
}

export const Gram = Coin
