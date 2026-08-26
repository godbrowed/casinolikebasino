"use client"

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarClock, Check, ChevronRight, CircleDollarSign, ExternalLink, Gift, LoaderCircle, Megaphone, Plus, RefreshCw, Send, Sparkles, Ticket, Trophy, Users } from "lucide-react"
import { createGiveawaySafe, finishGiveawaySafe, getGiveawayDashboardSafe, joinGiveawaySafe, type GiveawayDashboard } from "@/app/actions/giveaways"
import { Coin } from "@/components/coin"
import { useUser } from "@/components/user-provider"
import { fmt } from "@/lib/format"
import { haptic } from "@/lib/telegram-webapp"
import { cn } from "@/lib/utils"

const EMPTY: GiveawayDashboard = { botUsername: "mopsgift_bot", addChannelUrl: "", channels: [], availableGifts: [], giveaways: [] }
type Tab = "free" | "paid" | "joined" | "mine"

export function GiveawaysView() {
  const searchParams = useSearchParams()
  const focusedGiveawayId = Number(searchParams.get("giveaway") || 0)
  const focusedOnce = useRef(false)
  const { me, refresh: refreshUser } = useUser()
  const [dashboard, setDashboard] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [screen, setScreen] = useState<"catalog" | "create">("catalog")
  const [tab, setTab] = useState<Tab>("free")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const result = await getGiveawayDashboardSafe()
      if (!result.ok) throw new Error(result.error)
      setDashboard(result.data); setError("")
    } catch (cause) { setError(messageOf(cause)) }
    finally { if (!quiet) setLoading(false) }
  }, [])

  useEffect(() => { if (me) void refresh() }, [me, refresh])
  useEffect(() => {
    if (!me) return
    const timer = window.setInterval(() => void refresh(true), 8_000)
    return () => window.clearInterval(timer)
  }, [me, refresh])
  useEffect(() => {
    if (!focusedGiveawayId || loading || focusedOnce.current) return
    const focused = dashboard.giveaways.find((item) => item.id === focusedGiveawayId)
    if (!focused) return
    focusedOnce.current = true
    setTab(focused.isOwner ? "mine" : focused.myTickets > 0 ? "joined" : focused.ticketPrice > 0 ? "paid" : "free")
    window.setTimeout(() => document.getElementById(`giveaway-${focusedGiveawayId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80)
  }, [dashboard.giveaways, focusedGiveawayId, loading])

  function join(id: number) {
    setError(""); setSuccess(""); haptic("medium")
    startTransition(async () => {
      const result = await joinGiveawaySafe(id)
      if (!result.ok) { setError(result.error); return }
      setSuccess(result.data.message)
      await Promise.all([refresh(true), refreshUser()])
    })
  }

  function draw(id: number) {
    setError(""); setSuccess("")
    startTransition(async () => {
      const result = await finishGiveawaySafe(id)
      if (!result.ok) { setError(result.error); return }
      setSuccess("Winner selected and the channel post updated")
      await refresh(true)
    })
  }

  if (screen === "create") return <Creator dashboard={dashboard} pending={pending} error={error} success={success} onBack={() => { setScreen("catalog"); setError(""); setSuccess(""); void refresh(true) }} onRefresh={() => refresh()} setError={setError} setSuccess={setSuccess} startTransition={startTransition} />

  const filtered = dashboard.giveaways.filter((item) => {
    if (tab === "free") return item.status === "active" && item.ticketPrice === 0 && !item.isOwner
    if (tab === "paid") return item.status === "active" && item.ticketPrice > 0 && !item.isOwner
    if (tab === "joined") return item.myTickets > 0
    return item.isOwner
  })
  const counts = {
    free: dashboard.giveaways.filter((item) => item.status === "active" && item.ticketPrice === 0 && !item.isOwner).length,
    paid: dashboard.giveaways.filter((item) => item.status === "active" && item.ticketPrice > 0 && !item.isOwner).length,
    joined: dashboard.giveaways.filter((item) => item.myTickets > 0).length,
    mine: dashboard.giveaways.filter((item) => item.isOwner).length,
  }

  return <div className="mx-auto w-full max-w-[860px] space-y-4">
    <section className="giveaway-hero relative overflow-hidden rounded-[28px] px-4 py-5 sm:px-6 sm:py-7">
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" />
      <img src="/images/puggift-mascot-share-v1.png" alt="" className="absolute -bottom-4 -right-5 h-36 w-36 object-contain opacity-90 sm:h-44 sm:w-44" />
      <div className="relative z-10 max-w-[70%] sm:max-w-[560px]"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.13em] text-violet-200"><Sparkles className="h-3 w-3" />Live drops</span><h1 className="mt-3 font-display text-2xl font-black leading-tight sm:text-4xl">Win gifts in channel giveaways</h1><p className="mt-2 text-xs leading-relaxed text-white/55 sm:text-sm">Choose a free draw or buy weighted tickets with Stars. Everything you joined stays in one place.</p></div>
      <button onClick={() => { setScreen("create"); setError(""); setSuccess("") }} className="relative z-10 mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-[#3674ff] px-4 text-xs font-black shadow-[0_10px_26px_rgba(54,116,255,.32)] active:scale-95"><Plus className="h-4 w-4" strokeWidth={3} />Create giveaway</button>
    </section>

    {error && <Notice tone="error">{error}</Notice>}
    {success && <Notice tone="success"><Check className="h-4 w-4" />{success}</Notice>}

    <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">{([
        ["free", "Free", Gift], ["paid", "Paid", Ticket], ["joined", "Joined", Check], ["mine", "My giveaways", Megaphone],
      ] as const).map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={cn("flex min-h-11 items-center gap-2 rounded-2xl px-3.5 text-xs font-black ring-1 transition", tab === key ? "bg-[#3674ff] text-white ring-[#6c99ff]/60" : "bg-[#292c32] text-white/48 ring-white/[.07]")}><Icon className="h-4 w-4" /><span>{label}</span><span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", tab === key ? "bg-white/15" : "bg-black/20")}>{counts[key]}</span></button>)}</div>
    </div>

    <div className="flex items-center justify-between px-1"><div><div className="text-[9px] font-black uppercase tracking-[.15em] text-[#7897ff]">Giveaway feed</div><h2 className="font-display text-xl font-black">{tab === "free" ? "Free giveaways" : tab === "paid" ? "Paid tickets" : tab === "joined" ? "Your entries" : "Created by you"}</h2></div><button onClick={() => refresh()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[.06] text-white/45"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button></div>

    {loading ? <div className="flex min-h-52 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#7897ff]" /></div> : filtered.length ? <div className="grid gap-3 sm:grid-cols-2">{filtered.map((item) => <GiveawayCard key={item.id} item={item} pending={pending} onJoin={() => join(item.id)} onDraw={() => draw(item.id)} />)}</div> : <Empty tab={tab} onCreate={() => setScreen("create")} />}
  </div>
}

function GiveawayCard({ item, pending, onJoin, onDraw }: { item: GiveawayDashboard["giveaways"][number]; pending: boolean; onJoin: () => void; onDraw: () => void }) {
  const active = item.status === "active"
  const paid = item.ticketPrice > 0
  const ends = new Date(item.endsAt)
  return <article id={`giveaway-${item.id}`} className="overflow-hidden rounded-[25px] bg-[#292c32] ring-1 ring-white/[.08]">
    <div className="relative bg-[radial-gradient(circle_at_85%_0%,rgba(120,92,255,.26),transparent_45%)] p-4 pb-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className={cn("rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider", active ? "bg-emerald-500/12 text-emerald-300" : "bg-white/[.07] text-white/40")}>{item.status}</span><span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase", paid ? "bg-amber-400/12 text-amber-300" : "bg-blue-400/12 text-blue-300")}>{paid ? <><Coin className="h-3 w-3" />{fmt(item.ticketPrice)} / ticket</> : "Free entry"}</span>{item.myTickets > 0 && <span className="rounded-full bg-violet-400/12 px-2 py-1 text-[8px] font-black text-violet-200">YOU · {item.myTickets} 🎟</span>}</div><h3 className="mt-3 line-clamp-2 font-display text-lg font-black leading-tight">{item.title}</h3><p className="mt-1 truncate text-[10px] text-white/38">{item.channelTitle}</p></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/20 text-xl ring-1 ring-white/10">🎉</span></div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-black/20 p-3">{item.prizeImageUrl ? <img src={item.prizeImageUrl} alt={item.prizeText} className="h-16 w-16 shrink-0 object-contain" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center text-3xl">🎁</span>}<div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">NFT prize</div><div className="mt-1 truncate text-sm font-black text-white/90">{item.prizeText}</div><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/43">{item.body}</p></div></div>
      {item.requiredChannels.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.requiredChannels.map((channel) => channel.url ? <a key={`${channel.title}-${channel.username}`} href={channel.url} target="_blank" rel="noreferrer" className="rounded-full bg-[#3674ff]/15 px-2.5 py-1 text-[9px] font-black text-[#9eb6ff]">@{channel.username}</a> : <span key={channel.title} className="rounded-full bg-white/[.06] px-2.5 py-1 text-[9px] font-black text-white/45">{channel.title}</span>)}</div>}
    </div>
    <div className="grid grid-cols-3 gap-px bg-white/[.055]"><CardStat value={String(item.participantCount)} label="players" /><CardStat value={String(item.ticketCount)} label="tickets" /><CardStat value={paid ? fmt(item.pot) : String(item.winnerCount)} label={paid ? "bank" : "winners"} coin={paid} /></div>
    <div className="p-3"><div className="mb-3 flex items-center justify-between gap-2 text-[10px] text-white/38"><span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{active ? `Ends ${relativeTime(ends)}` : ends.toLocaleDateString()}</span>{item.channelUrl && <a href={item.channelUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-[#8da9ff]">Channel <ExternalLink className="h-3 w-3" /></a>}</div>
      {item.isOwner ? active ? <button disabled={pending} onClick={onDraw} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[.08] text-xs font-black text-white/70"><Trophy className="h-4 w-4" />Draw winner now</button> : <div className="flex min-h-12 items-center justify-center rounded-2xl bg-white/[.04] text-xs font-bold text-white/35">Giveaway finished</div> : active ? <button disabled={pending || (!paid && item.myTickets > 0)} onClick={onJoin} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#3674ff] text-xs font-black shadow-[0_7px_18px_rgba(54,116,255,.28)] disabled:bg-white/[.06] disabled:text-white/30 disabled:shadow-none"><Ticket className="h-4 w-4" />{!paid && item.myTickets > 0 ? "Already participating" : paid ? `Buy ticket · ${fmt(item.ticketPrice)} Stars` : "Participate for free"}</button> : <div className="flex min-h-12 items-center justify-center rounded-2xl bg-white/[.04] text-xs font-bold text-white/35">Entry closed · {item.myTickets} tickets</div>}
    </div>
  </article>
}

function Creator({ dashboard, pending, error, success, onBack, onRefresh, setError, setSuccess, startTransition }: { dashboard: GiveawayDashboard; pending: boolean; error: string; success: string; onBack: () => void; onRefresh: () => void; setError: (value: string) => void; setSuccess: (value: string) => void; startTransition: (callback: () => Promise<void>) => void }) {
  const [mode, setMode] = useState<"free" | "paid">("free")
  const [channelId, setChannelId] = useState(String(dashboard.channels.find((channel) => channel.active)?.id ?? ""))
  const defaultRequiredChannel = dashboard.channels.find((channel) => channel.active && channel.username)
  const [requiredChannelIds, setRequiredChannelIds] = useState<number[]>(defaultRequiredChannel ? [defaultRequiredChannel.id] : [])
  const [inventoryId, setInventoryId] = useState(String(dashboard.availableGifts[0]?.inventoryId ?? ""))
  const [title, setTitle] = useState(""); const [body, setBody] = useState("")
  const [price, setPrice] = useState("50"); const [duration, setDuration] = useState("1440")
  const activeChannel = dashboard.channels.find((channel) => String(channel.id) === channelId)
  useEffect(() => {
    if (!channelId) setChannelId(String(dashboard.channels.find((channel) => channel.active)?.id ?? ""))
  }, [channelId, dashboard.channels])

  function publish() {
    setError(""); setSuccess(""); haptic("medium")
    startTransition(async () => {
      const result = await createGiveawaySafe({ channelId: Number(channelId), inventoryId: Number(inventoryId), requiredChannelIds, title, body,
        ticketPrice: mode === "paid" ? Number(price) : 0, durationMinutes: Number(duration), maxTicketsPerUser: mode === "paid" ? 100 : 1 })
      if (!result.ok) { setError(result.error); return }
      setSuccess("Giveaway published in the channel")
      if (result.data.channelUrl) window.open(result.data.channelUrl, "_blank", "noopener,noreferrer")
      onBack()
    })
  }

  return <div className="mx-auto w-full max-w-[760px] space-y-4">
    <header className="flex items-center justify-between"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#15171c] text-white/65"><ArrowLeft className="h-5 w-5" /></button><div className="text-center"><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#7897ff]">Creator</div><h1 className="font-display text-xl font-black">New giveaway</h1></div><button onClick={onRefresh} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#15171c] text-white/45"><RefreshCw className="h-4 w-4" /></button></header>
    {error && <Notice tone="error">{error}</Notice>}{success && <Notice tone="success">{success}</Notice>}
    <section className="rounded-[27px] bg-[#292c32] p-4 ring-1 ring-white/[.08] sm:p-5">
      <div className="mb-4 flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Publishing channel</div><h2 className="mt-1 font-display text-lg font-black">Choose where to post</h2></div><a href={dashboard.addChannelUrl || "#"} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#3674ff] px-3 text-[10px] font-black"><Plus className="h-3.5 w-3.5" />Add channel</a></div>
      <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="giveaway-input"><option value="">Choose a connected channel</option>{dashboard.channels.filter((channel) => channel.active).map((channel) => <option key={channel.id} value={channel.id}>{channel.title}{channel.username ? ` · @${channel.username}` : ""}</option>)}</select>
      {dashboard.channels.some((channel) => channel.active && channel.username) && <div className="mt-4"><div className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-white/35">Required subscriptions</div><div className="grid gap-2 sm:grid-cols-2">{dashboard.channels.filter((channel) => channel.active && channel.username).map((channel) => { const selected = requiredChannelIds.includes(channel.id); return <button type="button" key={channel.id} onClick={() => setRequiredChannelIds((current) => selected ? current.filter((id) => id !== channel.id) : [...current, channel.id])} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left ring-1", selected ? "bg-[#3674ff]/15 ring-[#5d8bff]/50" : "bg-black/15 ring-white/[.06]")}><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", selected ? "bg-[#3674ff]" : "bg-white/[.07]")}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0"><b className="block truncate text-xs">{channel.title}</b><small className="text-[9px] text-white/38">@{channel.username}</small></span></button> })}</div><p className="mt-2 text-[10px] leading-relaxed text-white/35">Participants must subscribe to every selected channel before entry is accepted.</p></div>}
      {!dashboard.channels.some((channel) => channel.active) && <a href={dashboard.addChannelUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-[#4e7cff]/40 bg-[#315eff]/10 px-4 py-3 text-xs font-bold text-[#9ab1ff]"><span><b className="block text-sm text-white">Connect your first channel</b>Add @{dashboard.botUsername} as admin with post access.</span><ChevronRight className="h-5 w-5" /></a>}
    </section>
    <section className="rounded-[27px] bg-[#292c32] p-4 ring-1 ring-white/[.08] sm:p-5">
      <div className="mb-4 grid grid-cols-2 rounded-2xl bg-black/20 p-1"><Mode active={mode === "free"} icon={Gift} label="Free" onClick={() => setMode("free")} /><Mode active={mode === "paid"} icon={CircleDollarSign} label="Paid tickets" onClick={() => setMode("paid")} /></div>
      <Field label="Giveaway title"><input className="giveaway-input" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Summer Pug Drop" /></Field>
      <Field label="NFT prize from your profile"><div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">{dashboard.availableGifts.map((gift) => <button type="button" key={gift.inventoryId} onClick={() => setInventoryId(String(gift.inventoryId))} className={cn("relative flex min-w-0 flex-col items-center rounded-2xl bg-black/20 p-2.5 text-center ring-2 transition", inventoryId === String(gift.inventoryId) ? "ring-[#5c8cff]" : "ring-transparent")}><img src={gift.imageUrl} alt={gift.name} className="h-20 w-20 object-contain" /><b className="mt-1 w-full truncate text-[11px]">{gift.name}</b><span className="mt-1 flex items-center gap-1 text-[9px] text-white/42"><Coin className="h-3 w-3" />{fmt(gift.value)}</span>{inventoryId === String(gift.inventoryId) && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#3674ff]"><Check className="h-3 w-3" /></span>}</button>)}</div>{dashboard.availableGifts.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs text-white/40">No available NFT gifts. Open a case or deposit a gift first.</div>}</Field>
      <Field label="Your post text"><textarea className="giveaway-input min-h-28 resize-none py-3" value={body} maxLength={1200} onChange={(event) => setBody(event.target.value)} placeholder="Rules, requirements and details…" /></Field>
      <div className="grid grid-cols-2 gap-3">{mode === "paid" && <Field label="Ticket price"><div className="relative"><Coin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" /><input inputMode="decimal" className="giveaway-input pl-10" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ""))} /></div></Field>}<Field label="Duration"><select className="giveaway-input" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="5">5 min</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option><option value="4320">3 days</option><option value="10080">7 days</option><option value="43200">30 days</option></select></Field></div>
      <button disabled={pending || !activeChannel || !inventoryId || !title.trim() || !body.trim()} onClick={publish} className="mt-1 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#3674ff] text-sm font-black shadow-[0_8px_0_#193e9d] active:translate-y-1 active:shadow-none disabled:opacity-35">{pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}Lock NFT & publish</button>
    </section>
  </div>
}

function Mode({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Gift; label: string; onClick: () => void }) { return <button onClick={onClick} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-xs font-black", active ? "bg-[#3674ff]" : "text-white/40")}><Icon className="h-4 w-4" />{label}</button> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-4 block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.12em] text-white/38">{label}</span>{children}</label> }
function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) { return <div className={cn("flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold", tone === "error" ? "border-red-400/25 bg-red-500/10 text-red-200" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200")}>{children}</div> }
function CardStat({ value, label, coin }: { value: string; label: string; coin?: boolean }) { return <div className="bg-[#202228] px-2 py-2.5 text-center"><b className="flex items-center justify-center gap-1 truncate text-xs">{coin && <Coin className="h-3 w-3" />}{value}</b><span className="text-[8px] uppercase tracking-wider text-white/28">{label}</span></div> }
function Empty({ tab, onCreate }: { tab: Tab; onCreate: () => void }) { return <div className="flex min-h-52 flex-col items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/[.02] p-6 text-center"><Gift className="h-8 w-8 text-white/20" /><b className="mt-3">{tab === "joined" ? "You have not joined yet" : tab === "mine" ? "No giveaways created" : "Nothing live in this category"}</b><span className="mt-1 max-w-xs text-xs leading-relaxed text-white/35">{tab === "mine" ? "Create a giveaway and publish it to your Telegram channel." : "New channel giveaways will appear here automatically."}</span>{tab === "mine" && <button onClick={onCreate} className="mt-4 rounded-2xl bg-[#3674ff] px-4 py-3 text-xs font-black">Create giveaway</button>}</div> }
function relativeTime(date: Date) { const ms = date.getTime() - Date.now(); if (ms <= 0) return "now"; const minutes = Math.ceil(ms / 60_000); if (minutes < 60) return `in ${minutes}m`; const hours = Math.ceil(minutes / 60); if (hours < 24) return `in ${hours}h`; return `in ${Math.ceil(hours / 24)}d` }
function messageOf(error: unknown) { return error instanceof Error ? error.message.replace(/^Error:\s*/, "") : "Something went wrong" }
