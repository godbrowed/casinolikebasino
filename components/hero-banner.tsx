import { Users, Flame } from "lucide-react"
import { Coin } from "@/components/coin"
import Image from "next/image"

export function HeroBanner({ online, wonToday }: { online: number; wonToday: number }) {
  return (
    <section className="px-4">
      <div className="grad-border relative overflow-hidden rounded-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-card">
          {/* ambient glows */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

          {/* premium welcome artwork */}
          <div className="relative aspect-[2/1] w-full">
            <Image
              src="/images/giftlys-welcome.png"
              alt=""
              fill
              className="object-cover object-center"
              priority
            />
          </div>

          <div className="relative -mt-7 flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center gap-2">
              <Stat icon={<Users className="h-3.5 w-3.5 text-cyan-300" />} label="Online" value={online.toLocaleString()} />
              <Stat
                icon={<Coin className="h-3.5 w-3.5" />}
                label="Won today"
                value={wonToday.toLocaleString()}
                accent
              />
              <Stat icon={<Flame className="h-3.5 w-3.5 text-amber-300" />} label="Hot" value="Mega" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="card-premium flex flex-1 flex-col gap-0.5 rounded-xl px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`font-display text-sm font-black tabular-nums ${accent ? "text-cyan-300" : ""}`}>{value}</div>
    </div>
  )
}
