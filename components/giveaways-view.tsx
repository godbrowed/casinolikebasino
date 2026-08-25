"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import type { ReactNode } from "react"
import { CalendarClock, Check, ChevronRight, CircleDollarSign, Gift, LoaderCircle, Megaphone, Plus, Radio, RefreshCw, Send, Sparkles, Ticket, Trophy, Users } from "lucide-react"
import { createGiveawaySafe, finishGiveawaySafe, getGiveawayDashboardSafe, type GiveawayDashboard } from "@/app/actions/giveaways"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/telegram-webapp"

const EMPTY: GiveawayDashboard = { botUsername: "PugGift", addChannelUrl: "", channels: [], giveaways: [] }

export function GiveawaysView() {
  const { me, isLoading: userLoading } = useUser()
  const [dashboard, setDashboard] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [mode, setMode] = useState<"free" | "paid">("free")
  const [channelId, setChannelId] = useState("")
  const [title, setTitle] = useState("")
  const [prize, setPrize] = useState("")
  const [body, setBody] = useState("")
  const [price, setPrice] = useState("50")
  const [duration, setDuration] = useState("1440")
  const [winners, setWinners] = useState("1")

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const result = await getGiveawayDashboardSafe()
      if (!result.ok) throw new Error(result.error)
      const data = result.data
      setDashboard(data)
      setChannelId((current) => current || String(data.channels.find((item) => item.active)?.id || ""))
      setError("")
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => { if (me) void refresh() }, [me, refresh])
  useEffect(() => {
    if (!me) return
    const timer = window.setInterval(() => void refresh(true), 8_000)
    return () => window.clearInterval(timer)
  }, [me, refresh])

  const activeChannel = dashboard.channels.find((channel) => String(channel.id) === channelId)
  const previewEnds = useMemo(() => new Date(Date.now() + Number(duration) * 60_000), [duration])

  function publish() {
    setError("")
    setSuccess("")
    haptic("medium")
    startTransition(async () => {
      try {
        const result = await createGiveawaySafe({
          channelId: Number(channelId), title, body, prizeText: prize,
          ticketPrice: mode === "paid" ? Number(price) : 0,
          winnerCount: Number(winners), durationMinutes: Number(duration),
          maxTicketsPerUser: mode === "paid" ? 100 : 1,
        })
        if (!result.ok) throw new Error(result.error)
        setSuccess("Giveaway published in the channel")
        setTitle(""); setPrize(""); setBody("")
        await refresh(true)
        if (result.data.channelUrl) window.open(result.data.channelUrl, "_blank", "noopener,noreferrer")
      } catch (cause) { setError(messageOf(cause)) }
    })
  }

  function drawNow(id: number) {
    setError("")
    startTransition(async () => {
      try { const result = await finishGiveawaySafe(id); if (!result.ok) throw new Error(result.error); await refresh(true); setSuccess("Winner selected and the channel post updated") }
      catch (cause) { setError(messageOf(cause)) }
    })
  }

  const active = dashboard.giveaways.filter((item) => item.status === "active")
  const history = dashboard.giveaways.filter((item) => item.status !== "active" && item.status !== "draft")

  return <div className="space-y-5">
    <section className="giveaway-hero relative overflow-hidden rounded-[32px] p-5 md:p-8">
      <div className="absolute -right-12 -top-14 h-52 w-52 rounded-full bg-[#8b5cf6]/25 blur-3xl" />
      <div className="absolute bottom-0 right-2 hidden h-[185px] w-[240px] md:block">
        <img src="/images/puggift-mascot-share-v1.png" alt="PugGift mascot" className="h-full w-full object-contain object-bottom drop-shadow-[0_18px_22px_rgba(0,0,0,.5)]" />
      </div>
      <div className="relative z-10 max-w-[680px]">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-violet-200 ring-1 ring-white/10"><Sparkles className="h-3.5 w-3.5" />Creator studio</span>
        <h1 className="font-display text-3xl font-black leading-[1.05] md:text-5xl">Giveaways that live<br /><span className="text-[#9e7bff]">inside your channel</span></h1>
        <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-white/60 md:text-base">Connect your channel, add your own prize and text, then publish a free giveaway or sell tickets for Stars. Participation happens directly under the channel post.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={dashboard.addChannelUrl || "#"} aria-disabled={!dashboard.addChannelUrl} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 rounded-2xl bg-[#3674ff] px-4 py-3 text-sm font-black shadow-[0_10px_30px_rgba(54,116,255,.3)] transition active:scale-95", !dashboard.addChannelUrl && "pointer-events-none opacity-40")}><Plus className="h-4 w-4" strokeWidth={3} />Add bot to channel</a>
          <button disabled={userLoading || !me} onClick={() => refresh()} className="flex items-center gap-2 rounded-2xl bg-white/[.08] px-4 py-3 text-sm font-bold ring-1 ring-white/10 transition active:scale-95 disabled:opacity-40"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />Refresh channels</button>
        </div>
      </div>
    </section>

    {error && <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</div>}
    {success && <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"><Check className="h-4 w-4" />{success}</div>}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
      <section className="surface-panel rounded-[30px] p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#7897ff]">New campaign</div><h2 className="mt-1 font-display text-2xl font-black">Create giveaway</h2></div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-300/15"><Gift className="h-5 w-5" /></span>
        </div>

        <Field label="Channel">
          <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="giveaway-input">
            <option value="">Choose a connected channel</option>
            {dashboard.channels.filter((channel) => channel.active).map((channel) => <option key={channel.id} value={channel.id}>{channel.title}{channel.username ? ` · @${channel.username}` : ""}</option>)}
          </select>
        </Field>
        {!loading && dashboard.channels.length === 0 && <a href={dashboard.addChannelUrl} target="_blank" rel="noreferrer" className="mb-4 flex items-center justify-between rounded-2xl border border-dashed border-[#4e7cff]/40 bg-[#315eff]/10 px-4 py-3 text-xs font-bold text-[#9ab1ff]"><span><b className="block text-sm text-white">No channels connected yet</b>Add @{dashboard.botUsername} as an administrator with posting access.</span><ChevronRight className="h-5 w-5" /></a>}

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-black/20 p-1 ring-1 ring-white/[.06]">
          <ModeButton active={mode === "free"} onClick={() => setMode("free")} icon={Gift} title="Free" subtitle="One entry each" />
          <ModeButton active={mode === "paid"} onClick={() => setMode("paid")} icon={CircleDollarSign} title="Paid tickets" subtitle="Charge per entry" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giveaway title"><input className="giveaway-input" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Summer Pug Drop" /></Field>
          <Field label="Prize"><input className="giveaway-input" value={prize} maxLength={160} onChange={(event) => setPrize(event.target.value)} placeholder="Telegram Plush Pepe" /></Field>
        </div>
        <Field label="Your text"><textarea className="giveaway-input min-h-[130px] resize-y py-3" value={body} maxLength={1200} onChange={(event) => setBody(event.target.value)} placeholder="Write the rules, requirements and anything your audience needs to know…" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {mode === "paid" && <Field label="Price per ticket"><div className="relative"><Coin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" /><input inputMode="decimal" className="giveaway-input pl-10" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ""))} /></div></Field>}
          <Field label="Duration"><select className="giveaway-input" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="5">5 minutes</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option><option value="4320">3 days</option><option value="10080">7 days</option><option value="43200">30 days</option></select></Field>
          <Field label="Winners"><select className="giveaway-input" value={winners} onChange={(event) => setWinners(event.target.value)}>{[1,2,3,5,10].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
        </div>

        <button disabled={pending || !activeChannel || !title.trim() || !body.trim() || !prize.trim()} onClick={publish} className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#3674ff] px-5 text-sm font-black shadow-[0_8px_0_#193e9d,0_18px_34px_-14px_rgba(54,116,255,.7)] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
          {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}Publish in channel
        </button>
      </section>

      <aside className="lg:sticky lg:top-[78px]">
        <div className="mb-3 flex items-center justify-between px-1"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Live preview</div><h2 className="font-display text-xl font-black">Channel post</h2></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-300"><Radio className="h-3 w-3" />Inline</span></div>
        <article className="overflow-hidden rounded-[28px] bg-[#22252b] shadow-[0_24px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10">
          <div className="flex items-center gap-3 border-b border-white/[.07] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600"><Megaphone className="h-5 w-5" /></span><div><div className="text-sm font-black">{activeChannel?.title || "Your channel"}</div><div className="text-[10px] text-white/35">sponsored giveaway</div></div></div>
          <div className="p-5"><div className="text-xl">🎉</div><h3 className="mt-2 text-xl font-black">{title || "Your giveaway title"}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/65">{body || "Your custom message will appear here exactly as your audience sees it."}</p>
            <div className="mt-4 space-y-2 rounded-2xl bg-black/20 p-3 text-xs text-white/70"><PreviewLine icon={Gift} label="Prize" value={prize || "Your prize"} /><PreviewLine icon={Trophy} label="Winners" value={winners} /><PreviewLine icon={CalendarClock} label="Ends" value={previewEnds.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} /><PreviewLine icon={Users} label="Participants" value="0 · 0 tickets" /></div>
          </div>
          <div className="px-3 pb-3"><div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#3674ff] text-sm font-black"><Ticket className="h-4 w-4" />{mode === "paid" ? `Buy ticket · ⭐ ${price || 0}` : "Participate for free"}</div></div>
        </article>
        <p className="mt-3 px-2 text-center text-[10px] leading-relaxed text-white/35">The button is posted by @{dashboard.botUsername}. Paid ticket proceeds are credited to the organizer after the draw.</p>
      </aside>
    </div>

    <section>
      <div className="mb-3 flex items-end justify-between px-1"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#7897ff]">Campaigns</div><h2 className="mt-1 font-display text-2xl font-black">Your giveaways</h2></div><span className="text-xs font-bold text-white/35">{active.length} active</span></div>
      {active.length === 0 && history.length === 0 ? <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[.025] p-6 text-center"><Gift className="mb-3 h-8 w-8 text-white/25" /><b>No giveaways yet</b><span className="mt-1 text-xs text-white/35">Connect a channel and publish the first one.</span></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[...active, ...history].map((item) => <CampaignCard key={item.id} item={item} pending={pending} onDraw={() => drawNow(item.id)} />)}</div>}
    </section>
  </div>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-4 block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.12em] text-white/42">{label}</span>{children}</label> }
function ModeButton({ active, onClick, icon: Icon, title, subtitle }: { active: boolean; onClick: () => void; icon: typeof Gift; title: string; subtitle: string }) { return <button type="button" onClick={onClick} className={cn("flex items-center gap-3 rounded-[14px] px-3 py-3 text-left transition", active ? "bg-[#3674ff] text-white shadow-lg" : "text-white/45")}><Icon className="h-5 w-5 shrink-0" /><span><b className="block text-xs">{title}</b><span className="text-[9px] opacity-65">{subtitle}</span></span></button> }
function PreviewLine({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-[#8fa9ff]" /><span className="text-white/38">{label}</span><b className="ml-auto max-w-[60%] truncate text-white/80">{value}</b></div> }
function CampaignCard({ item, pending, onDraw }: { item: GiveawayDashboard["giveaways"][number]; pending: boolean; onDraw: () => void }) { const active = item.status === "active"; return <article className="surface-panel rounded-[24px] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={cn("inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider", active ? "bg-emerald-500/12 text-emerald-300" : item.status === "completed" ? "bg-violet-500/12 text-violet-300" : "bg-red-500/12 text-red-300")}>{item.status}</span><h3 className="mt-2 truncate font-black">{item.title}</h3><p className="mt-0.5 truncate text-[10px] text-white/38">{item.channelTitle}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[.06]">🎉</span></div><div className="mt-4 grid grid-cols-3 gap-2"><Stat value={String(item.participantCount)} label="people" /><Stat value={String(item.ticketCount)} label="tickets" /><Stat value={`⭐ ${item.pot}`} label="bank" /></div><div className="mt-3 flex items-center justify-between text-[10px] text-white/35"><span>{new Date(item.endsAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>{active && <button disabled={pending} onClick={onDraw} className="flex items-center gap-1 rounded-lg bg-white/[.07] px-2.5 py-1.5 font-bold text-white/65"><Trophy className="h-3 w-3" />Draw now</button>}</div></article> }
function Stat({ value, label }: { value: string; label: string }) { return <div className="rounded-xl bg-black/20 px-2 py-2 text-center"><b className="block truncate text-xs">{value}</b><span className="text-[8px] uppercase tracking-wider text-white/30">{label}</span></div> }
function messageOf(error: unknown) { return error instanceof Error ? error.message.replace(/^Error:\s*/, "") : "Something went wrong" }
