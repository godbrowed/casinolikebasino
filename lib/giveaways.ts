import "server-only"

import crypto from "node:crypto"
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { giveawayChannels, giveawayEntries, giveawayRequiredChannels, giveaways, inventory, transactions, users } from "@/lib/db/schema"
import { notifyUser } from "@/lib/telegram-gifts"

const token = process.env.TELEGRAM_BOT_TOKEN

export type TelegramApiResult<T = unknown> = { ok: boolean; result?: T; description?: string }

export async function telegramCall<T = unknown>(method: string, body: unknown): Promise<TelegramApiResult<T>> {
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not configured" }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  return response.json().catch(() => ({ ok: false, description: "Invalid Telegram response" }))
}

export async function telegramCallMultipart<T = unknown>(method: string, form: FormData): Promise<TelegramApiResult<T>> {
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not configured" }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form, cache: "no-store" })
  return response.json().catch(() => ({ ok: false, description: "Invalid Telegram response" }))
}

export function botUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || "mopsgift_bot").replace(/^@+/, "")
}

export async function resolveBotUsername() {
  const configured = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@+/, "")
  if (configured) return configured
  const bot = await telegramCall<{ username?: string }>("getMe", {})
  return bot.ok && bot.result?.username ? bot.result.username : botUsername()
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function formatStars(value: number) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export type GiveawayPost = {
  id: number
  title: string
  body: string
  prizeText: string
  ticketPrice: string | number
  winnerCount: number
  endsAt: Date
  participantCount: number
  ticketCount: number
  status: string
  requiredChannels?: Array<{ title: string; username: string | null }>
}

export function giveawayPostText(giveaway: GiveawayPost, winnerNames: { id: string; name: string }[] = []) {
  const paid = Number(giveaway.ticketPrice) > 0
  const deadline = Math.floor(giveaway.endsAt.getTime() / 1000)
  const lines = [
    `🎉 <b>${escapeHtml(giveaway.title)}</b>`,
    "",
    ...(giveaway.body.trim() ? [escapeHtml(giveaway.body), ""] : []),
    `🎁 <b>Prize:</b> ${escapeHtml(giveaway.prizeText)}`,
    `🏆 <b>Winners:</b> ${giveaway.winnerCount}`,
    ...(giveaway.requiredChannels?.length
      ? [`📣 <b>Required:</b> ${giveaway.requiredChannels.map((channel) => channel.username ? `@${escapeHtml(channel.username)}` : escapeHtml(channel.title)).join(", ")}`]
      : []),
    paid ? `🎟 <b>Ticket:</b> ⭐ ${formatStars(Number(giveaway.ticketPrice))}` : "🎟 <b>Entry:</b> Free",
    `⏳ <b>Ends:</b> ${new Date(deadline * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC`,
    "",
    `👥 <b>${giveaway.participantCount}</b> participants · <b>${giveaway.ticketCount}</b> tickets`,
  ]

  if (giveaway.status === "completed") {
    lines.push("", winnerNames.length
      ? `🏁 <b>Winner${winnerNames.length > 1 ? "s" : ""}:</b> ${winnerNames.map((winner) => `<a href=\"tg://user?id=${winner.id}\">${escapeHtml(winner.name)}</a>`).join(", ")}`
      : "🏁 <b>Finished without participants</b>")
  }
  return lines.join("\n")
}

export function giveawayKeyboard(giveaway: Pick<GiveawayPost, "id" | "ticketPrice" | "status">) {
  if (giveaway.status !== "active") return { inline_keyboard: [] }
  const price = Number(giveaway.ticketPrice)
  return {
    inline_keyboard: [[{
      text: price > 0 ? `🎟 Buy ticket · ⭐ ${formatStars(price)}` : "🎟 Participate for free",
      url: `https://t.me/${botUsername()}?startapp=giveaway_${giveaway.id}`,
    }]],
  }
}

export async function registerGiveawayChannel(update: any) {
  const membership = update?.my_chat_member
  const chat = membership?.chat
  const actor = membership?.from
  const member = membership?.new_chat_member
  if (!chat?.id || chat.type !== "channel" || !actor?.id || member?.user?.is_bot !== true) return false

  const active = member.status === "administrator" || member.status === "creator"
  const canPost = member.status === "creator" || member.can_post_messages === true
  const existing = await db.select().from(giveawayChannels).where(eq(giveawayChannels.chatId, String(chat.id))).limit(1)

  if (existing[0]) {
    await db.update(giveawayChannels).set({
      title: chat.title || existing[0].title,
      username: chat.username ?? null,
      botStatus: member.status || "left",
      canPostMessages: canPost,
      active: active && canPost,
      updatedAt: new Date(),
    }).where(eq(giveawayChannels.id, existing[0].id))
  } else if (active) {
    await db.insert(giveawayChannels).values({
      ownerUserId: String(actor.id),
      chatId: String(chat.id),
      username: chat.username ?? null,
      title: chat.title || "Telegram channel",
      botStatus: member.status,
      canPostMessages: canPost,
      active: active && canPost,
    })
  }
  return true
}

export type JoinGiveawayResult = { ok: boolean; message: string; showAlert?: boolean }

async function requiredChannelsForGiveaway(giveawayId: number) {
  return db.select({
    title: giveawayChannels.title,
    username: giveawayChannels.username,
    chatId: giveawayChannels.chatId,
  }).from(giveawayRequiredChannels)
    .innerJoin(giveawayChannels, eq(giveawayRequiredChannels.channelId, giveawayChannels.id))
    .where(eq(giveawayRequiredChannels.giveawayId, giveawayId))
}

async function missingRequiredSubscriptions(giveawayId: number, telegramUserId: number) {
  const required = await requiredChannelsForGiveaway(giveawayId)
  const checks = await Promise.all(required.map(async (channel) => {
    let member: TelegramApiResult<{ status?: string; is_member?: boolean }>
    try {
      member = await telegramCall<{ status?: string; is_member?: boolean }>("getChatMember", {
        chat_id: channel.chatId,
        user_id: telegramUserId,
      })
    } catch {
      member = { ok: false }
    }
    const status = member.result?.status || ""
    const subscribed = member.ok && (status === "member" || status === "administrator" || status === "creator" || (status === "restricted" && member.result?.is_member === true))
    return subscribed ? null : channel
  }))
  return checks.filter((channel): channel is NonNullable<typeof channel> => channel !== null)
}

export async function joinGiveawayFromCallback(input: {
  giveawayId: number
  ticketCount?: number
  telegramUser: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string }
}): Promise<JoinGiveawayResult> {
  const { giveawayId, telegramUser } = input
  const requestedTickets = Number(input.ticketCount ?? 1)
  if (!Number.isSafeInteger(giveawayId) || giveawayId <= 0) return { ok: false, message: "Giveaway not found", showAlert: true }
  if (!Number.isSafeInteger(requestedTickets) || requestedTickets < 1 || requestedTickets > 1000) return { ok: false, message: "Choose from 1 to 1,000 tickets", showAlert: true }

  const missingChannels = await missingRequiredSubscriptions(giveawayId, telegramUser.id)
  if (missingChannels.length) {
    return {
      ok: false,
      message: `Subscribe first: ${missingChannels.map((channel) => channel.username ? `@${channel.username}` : channel.title).join(", ")}`,
      showAlert: true,
    }
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(519411, ${giveawayId})`)
    const giveaway = (await tx.select().from(giveaways).where(eq(giveaways.id, giveawayId)).limit(1))[0]
    if (!giveaway || giveaway.status !== "active") return { ok: false, message: "This giveaway is no longer active", showAlert: true } as JoinGiveawayResult
    if (giveaway.endsAt.getTime() <= Date.now()) return { ok: false, message: "The entry period has ended", showAlert: true } as JoinGiveawayResult
    if (giveaway.ownerUserId === String(telegramUser.id)) return { ok: false, message: "The organizer cannot enter their own giveaway", showAlert: true } as JoinGiveawayResult

    await tx.insert(users).values({
      id: String(telegramUser.id),
      username: telegramUser.username ?? null,
      firstName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "Participant",
      photoUrl: telegramUser.photo_url ?? null,
      balance: "0",
      isDemo: false,
    }).onConflictDoUpdate({
      target: users.id,
      set: { username: telegramUser.username ?? null, firstName: telegramUser.first_name ?? "Participant", lastSeen: new Date() },
    })

    const userId = String(telegramUser.id)
    const price = Number(giveaway.ticketPrice)
    const ticketsToBuy = price > 0 ? requestedTickets : 1
    const totalPrice = Math.round(price * ticketsToBuy * 100) / 100
    const existing = (await tx.select().from(giveawayEntries).where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId))).limit(1))[0]
    if (price === 0 && existing) return { ok: false, message: "You are already participating 🎟", showAlert: false } as JoinGiveawayResult
    if ((existing?.tickets ?? 0) + ticketsToBuy > giveaway.maxTicketsPerUser) return { ok: false, message: `You can buy ${Math.max(0, giveaway.maxTicketsPerUser - (existing?.tickets ?? 0))} more tickets`, showAlert: true } as JoinGiveawayResult

    if (price > 0) {
      const charged = await tx.update(users)
        .set({ balance: sql`${users.balance} - ${totalPrice}` })
        .where(and(eq(users.id, userId), sql`${users.balance} >= ${totalPrice}`))
        .returning({ balance: users.balance })
      if (!charged[0]) return { ok: false, message: `Not enough Stars. You need ⭐ ${formatStars(totalPrice)}. Open PugGift to top up.`, showAlert: true } as JoinGiveawayResult
    }

    if (existing) {
      await tx.update(giveawayEntries).set({
        tickets: sql`${giveawayEntries.tickets} + ${ticketsToBuy}`,
        amount: sql`${giveawayEntries.amount} + ${totalPrice}`,
      }).where(eq(giveawayEntries.id, existing.id))
    } else {
      await tx.insert(giveawayEntries).values({ giveawayId, userId, tickets: ticketsToBuy, amount: String(totalPrice) })
    }
    await tx.update(giveaways).set({
      participantCount: existing ? giveaway.participantCount : giveaway.participantCount + 1,
      ticketCount: giveaway.ticketCount + ticketsToBuy,
      pot: sql`${giveaways.pot} + ${totalPrice}`,
    }).where(eq(giveaways.id, giveawayId))

    return { ok: true, message: price > 0 ? `${ticketsToBuy} ticket${ticketsToBuy === 1 ? "" : "s"} purchased! Good luck 🎟` : "You joined the giveaway! Good luck 🎉" } as JoinGiveawayResult
  })

  if (result.ok) await refreshGiveawayPost(giveawayId).catch(() => undefined)
  return result
}

export async function refreshGiveawayPost(giveawayId: number) {
  const rows = await db.select({ giveaway: giveaways, channel: giveawayChannels })
    .from(giveaways)
    .innerJoin(giveawayChannels, eq(giveaways.channelId, giveawayChannels.id))
    .where(eq(giveaways.id, giveawayId)).limit(1)
  const row = rows[0]
  if (!row?.giveaway.postMessageId) return
  const requiredChannels = await requiredChannelsForGiveaway(giveawayId)
  await telegramCall(row.giveaway.photoFileId ? "editMessageCaption" : "editMessageText", {
    chat_id: row.channel.chatId,
    message_id: row.giveaway.postMessageId,
    [row.giveaway.photoFileId ? "caption" : "text"]: giveawayPostText({ ...row.giveaway, requiredChannels }),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: giveawayKeyboard(row.giveaway),
  })
}

function pickWeightedWinners(entries: { userId: string; tickets: number }[], count: number) {
  const pool = entries.map((entry) => ({ ...entry }))
  const winners: string[] = []
  while (pool.length && winners.length < count) {
    const total = pool.reduce((sum, entry) => sum + entry.tickets, 0)
    let draw = crypto.randomInt(total)
    let index = 0
    for (; index < pool.length; index++) {
      draw -= pool[index].tickets
      if (draw < 0) break
    }
    winners.push(pool[Math.min(index, pool.length - 1)].userId)
    pool.splice(Math.min(index, pool.length - 1), 1)
  }
  return winners
}

export async function settleGiveaway(giveawayId: number) {
  const settled = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(519412, ${giveawayId})`)
    const giveaway = (await tx.select().from(giveaways).where(eq(giveaways.id, giveawayId)).limit(1))[0]
    if (!giveaway || giveaway.status !== "active") return null
    const entries = await tx.select({ userId: giveawayEntries.userId, tickets: giveawayEntries.tickets })
      .from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId)).orderBy(asc(giveawayEntries.joinedAt))
    const winnerIds = pickWeightedWinners(entries, giveaway.winnerCount)
    await tx.update(giveaways).set({ status: "completed", winnerUserIds: winnerIds, settledAt: new Date() }).where(eq(giveaways.id, giveawayId))

    const prizeIds = Array.isArray(giveaway.inventoryIds) ? giveaway.inventoryIds.map(Number).filter(Number.isSafeInteger) : giveaway.inventoryId ? [giveaway.inventoryId] : []
    if (prizeIds.length) {
      const winnerId = winnerIds[0]
      const movedPrize = await tx.update(inventory).set({
        userId: winnerId || giveaway.ownerUserId,
        status: "owned",
        source: winnerId ? "giveaway" : "giveaway-returned",
      }).where(and(
        inArray(inventory.id, prizeIds),
        eq(inventory.userId, giveaway.ownerUserId),
        eq(inventory.status, "giveaway_locked"),
      )).returning({ id: inventory.id })
      if (movedPrize.length !== prizeIds.length) throw new Error("Giveaway NFT prizes are not locked")
    }

    const pot = Number(giveaway.pot)
    if (pot > 0) {
      await tx.update(users).set({ balance: sql`${users.balance} + ${pot}` }).where(eq(users.id, giveaway.ownerUserId))
      await tx.insert(transactions).values({
        userId: giveaway.ownerUserId,
        type: "giveaway_revenue",
        currency: "stars",
        amount: String(pot),
        credited: String(pot),
        status: "completed",
        externalId: `giveaway:${giveaway.id}`,
        meta: { giveawayId: giveaway.id, tickets: giveaway.ticketCount },
      })
    }
    return { giveaway: { ...giveaway, status: "completed" }, winnerIds }
  })
  if (!settled) return null

  const row = (await db.select({ channel: giveawayChannels }).from(giveawayChannels).where(eq(giveawayChannels.id, settled.giveaway.channelId)).limit(1))[0]
  const winnerRows = settled.winnerIds.length
    ? await db.select({ id: users.id, firstName: users.firstName, username: users.username }).from(users).where(inArray(users.id, settled.winnerIds))
    : []
  const winnerNames = settled.winnerIds.map((id) => {
    const winner = winnerRows.find((item) => item.id === id)
    return { id, name: winner?.firstName || (winner?.username ? `@${winner.username}` : "Winner") }
  })
  if (row?.channel && settled.giveaway.postMessageId) {
    const requiredChannels = await requiredChannelsForGiveaway(giveawayId)
    await telegramCall(settled.giveaway.photoFileId ? "editMessageCaption" : "editMessageText", {
      chat_id: row.channel.chatId,
      message_id: settled.giveaway.postMessageId,
      [settled.giveaway.photoFileId ? "caption" : "text"]: giveawayPostText({ ...settled.giveaway, requiredChannels }, winnerNames),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: giveawayKeyboard(settled.giveaway),
    })
  }
  if (settled.winnerIds[0]) {
    await notifyUser(settled.winnerIds[0], `🎉 <b>You won ${escapeHtml(settled.giveaway.prizeText)}!</b>\n\nThe NFT gift is already in your PugGift profile.`)
  }
  return { winnerIds: settled.winnerIds }
}

export async function settleExpiredGiveaways(ownerUserId?: string) {
  const conditions = [eq(giveaways.status, "active"), lte(giveaways.endsAt, new Date())]
  if (ownerUserId) conditions.push(eq(giveaways.ownerUserId, ownerUserId))
  const due = await db.select({ id: giveaways.id }).from(giveaways).where(and(...conditions)).limit(25)
  for (const item of due) await settleGiveaway(item.id).catch((error) => console.error("Giveaway settlement failed", item.id, error))
}
