import Image from "next/image"
import { Users } from "lucide-react"
import { Coin } from "@/components/coin"

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function HeroBanner({ online, wonToday }: { online: number; wonToday: number }) {
  return (
    <section className="flex flex-col gap-3 px-4" aria-label="Giftlys welcome">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-background/70">
        <Image
          src="/images/giftlys-welcome.png"
          alt="Giftlys NFT casino bot with a Telegram gift ring and collectible cards"
          width={1774}
          height={887}
          priority
          sizes="(max-width: 768px) calc(100vw - 2rem), 736px"
          className="h-auto w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Users aria-hidden="true" />}
          label="Online"
          value={online.toLocaleString("en-US")}
          live
        />
        <Stat
          icon={<Coin className="size-4" />}
          label="Won today"
          value={compactNumber.format(wonToday)}
        />
      </div>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  live = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  live?: boolean
}) {
  return (
    <div className="card-premium flex min-w-0 items-center gap-3 rounded-xl border border-border px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {live && <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />}
          {label}
        </span>
        <span className="truncate font-display text-base font-bold tabular-nums text-foreground">{value}</span>
      </span>
    </div>
  )
}
