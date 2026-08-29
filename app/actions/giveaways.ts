"use server"

import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { giveawayChannels, giveawayEntries, giveawayRequiredChannels, giveaways, gifts, inventory, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { giveawayKeyboard, giveawayPostText, joinGiveawayFromCallback, resolveBotUsername, settleExpiredGiveaways, settleGiveaway, telegramCall, telegramCallMultipart } from "@/lib/giveaways"
import { assertFreeCaseGiftUnlocked, getFreeCaseClaimStatus } from "@/lib/free-case-referrals"
import { giftValueInStars } from "@/lib/pricing"

export type GiveawayDashboard = {
  botUsername: string
  addChannelUrl: string
  channels: Array<{
    id: number
    title: string
    username: string | null
    canPostMessages: boolean
    active: boolean
  }>
  availableGifts: Array<{
    inventoryId: number
    name: string
    imageUrl: string
    rarity: string
    value: number
  }>
  giveaways: Array<{
    id: number
    channelTitle: string
    title: string
    body: string
    prizeText: string
    prizeImageUrl: string | null
    ticketPrice: number
    winnerCount: number
    participantCount: number
    ticketCount: number
    pot: number
    status: string
    endsAt: string
    createdAt: string
    channelUsername: string | null
    channelUrl: string | null
    myTickets: number
    maxTicketsPerUser: number
    isOwner: boolean
    requiredChannels: Array<{ title: string; username: string | null; url: string | null }>
  }>
}

export async function getGiveawayDashboard(): Promise<GiveawayDashboard> {
  const userId = await requireUserId()
  await settleExpiredGiveaways()
  const claim = await getFreeCaseClaimStatus(userId, false)
  const channels = await db.select().from(giveawayChannels)
    .where(eq(giveawayChannels.ownerUserId, userId))
    .orderBy(desc(giveawayChannels.updatedAt))
  const rows = await db.select({
    giveaway: giveaways,
    channelTitle: giveawayChannels.title,
    channelUsername: giveawayChannels.username,
    myTickets: giveawayEntries.tickets,
    prizeImageUrl: gifts.imageUrl,
  })
    .from(giveaways)
    .innerJoin(giveawayChannels, eq(giveaways.channelId, giveawayChannels.id))
    .leftJoin(giveawayEntries, and(eq(giveawayEntries.giveawayId, giveaways.id), eq(giveawayEntries.userId, userId)))
    .leftJoin(inventory, eq(giveaways.inventoryId, inventory.id))
    .leftJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(or(eq(giveaways.status, "active"), eq(giveaways.ownerUserId, userId), isNotNull(giveawayEntries.id)))
    .orderBy(desc(giveaways.createdAt))
    .limit(100)
  const username = await resolveBotUsername()
  const giveawayIds = rows.map(({ giveaway }) => giveaway.id)
  const requiredRows = giveawayIds.length ? await db.select({
    giveawayId: giveawayRequiredChannels.giveawayId,
    title: giveawayChannels.title,
    username: giveawayChannels.username,
  }).from(giveawayRequiredChannels)
    .innerJoin(giveawayChannels, eq(giveawayRequiredChannels.channelId, giveawayChannels.id))
    .where(inArray(giveawayRequiredChannels.giveawayId, giveawayIds)) : []
  const availableRows = await db.select({
    inventoryId: inventory.id,
    name: gifts.name,
    imageUrl: gifts.imageUrl,
    rarity: gifts.rarity,
    value: inventory.value,
    floorTon: gifts.floorTon,
    source: inventory.source,
  }).from(inventory)
    .innerJoin(gifts, eq(inventory.giftId, gifts.id))
    .where(and(eq(inventory.userId, userId), eq(inventory.status, "owned")))
    .orderBy(desc(inventory.value))
  return {
    botUsername: username,
    addChannelUrl: `https://t.me/${username}?startchannel&admin=post_messages+edit_messages`,
    channels: channels.map((channel) => ({
      id: channel.id,
      title: channel.title,
      username: channel.username,
      canPostMessages: channel.canPostMessages,
      active: channel.active,
    })),
    availableGifts: availableRows
      .filter((gift) => claim.ready || gift.source !== "free-case")
      .map(({ floorTon, source: _source, ...gift }) => ({ ...gift, value: giftValueInStars(gift.value, floorTon) })),
    giveaways: rows.map(({ giveaway, channelTitle, channelUsername, myTickets, prizeImageUrl }) => ({
      id: giveaway.id,
      channelTitle,
      title: giveaway.title,
      body: giveaway.body,
      prizeText: giveaway.prizeText,
      prizeImageUrl,
      ticketPrice: Number(giveaway.ticketPrice),
      winnerCount: giveaway.winnerCount,
      participantCount: giveaway.participantCount,
      ticketCount: giveaway.ticketCount,
      pot: Number(giveaway.pot),
      status: giveaway.status,
      endsAt: giveaway.endsAt.toISOString(),
      createdAt: giveaway.createdAt.toISOString(),
      channelUsername,
      channelUrl: channelUsername && giveaway.postMessageId ? `https://t.me/${channelUsername}/${giveaway.postMessageId}` : null,
      myTickets: Number(myTickets ?? 0),
      maxTicketsPerUser: giveaway.maxTicketsPerUser,
      isOwner: giveaway.ownerUserId === userId,
      requiredChannels: requiredRows.filter((required) => required.giveawayId === giveaway.id).map((required) => ({
        title: required.title,
        username: required.username,
        url: required.username ? `https://t.me/${required.username}` : null,
      })),
    })),
  }
}

export async function joinGiveaway(giveawayId: number, ticketCount = 1) {
  const userId = await requireUserId()
  const telegramId = Number(userId)
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new Error("Telegram account is required")
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) throw new Error("User not found")
  const result = await joinGiveawayFromCallback({
    giveawayId: Number(giveawayId),
    ticketCount: Number(ticketCount),
    telegramUser: {
      id: telegramId,
      username: user.username ?? undefined,
      first_name: user.firstName || "Participant",
      photo_url: user.photoUrl ?? undefined,
    },
  })
  if (!result.ok) throw new Error(result.message)
  revalidatePath("/giveaways")
  return { message: result.message }
}

export async function createGiveaway(input: {
  channelUsername: string
  inventoryIds: number[]
  requiredChannelIds: number[]
  title: string
  body: string
  photoDataUrl?: string
  ticketPrice: number
  durationMinutes: number
  maxTicketsPerUser?: number
  winnerCount?: number
}) {
  const userId = await requireUserId()
  const channelUsername = input.channelUsername?.trim().replace(/^@+/, "").toLowerCase()
  const inventoryIds = [...new Set((input.inventoryIds || []).map(Number))]
  const requiredChannelIds = [...new Set((input.requiredChannelIds || []).map(Number))]
  const title = input.title?.trim()
  const body = input.body?.trim() ?? ""
  const photo = parseGiveawayPhoto(input.photoDataUrl)
  const ticketPrice = Number(input.ticketPrice)
  const durationMinutes = Number(input.durationMinutes)
  const maxTickets = ticketPrice > 0 ? Number(input.maxTicketsPerUser || 100_000) : 1
  const winnerCount = Number(input.winnerCount || 1)

  if (!/^[a-zA-Z0-9_]{5,32}$/.test(channelUsername)) throw new Error("Enter a valid public channel username")
  if (!inventoryIds.length || inventoryIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Choose one or several NFT gifts")
  if (requiredChannelIds.length > 10 || requiredChannelIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Choose valid required channels")
  if (!title || title.length > 80) throw new Error("Title must contain 1–80 characters")
  if (body.length > 1200) throw new Error("Text must contain up to 1,200 characters")
  if (photo && body.length > 500) throw new Error("With a photo, keep the description under 500 characters")
  if (!Number.isFinite(ticketPrice) || ticketPrice < 0 || ticketPrice > 100_000) throw new Error("Invalid ticket price")
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 43_200) throw new Error("Duration must be between 5 minutes and 30 days")
  if (!Number.isSafeInteger(maxTickets) || maxTickets < 1 || maxTickets > 100_000) throw new Error("Ticket limit must be between 1 and 100,000")
  if (!Number.isSafeInteger(winnerCount) || winnerCount < 1 || winnerCount > inventoryIds.length) throw new Error("Winners must be between 1 and the number of NFT prizes")

  const channel = (await db.select().from(giveawayChannels).where(and(
    sql`lower(${giveawayChannels.username}) = ${channelUsername}`,
    eq(giveawayChannels.ownerUserId, userId),
    eq(giveawayChannels.active, true),
    eq(giveawayChannels.canPostMessages, true),
  )).limit(1))[0]
  if (!channel) throw new Error("The channel is not connected or the bot cannot post")

  const requiredChannels = requiredChannelIds.length ? await db.select().from(giveawayChannels).where(and(
    eq(giveawayChannels.ownerUserId, userId),
    eq(giveawayChannels.active, true),
    eq(giveawayChannels.canPostMessages, true),
    inArray(giveawayChannels.id, requiredChannelIds),
  )) : []
  if (requiredChannels.length !== requiredChannelIds.length) throw new Error("One of the required channels is not connected")
  if (requiredChannels.some((requiredChannel) => !requiredChannel.username)) throw new Error("Required subscription channels must be public")

  const claim = await getFreeCaseClaimStatus(userId)
  const giveaway = await db.transaction(async (tx) => {
    const prizes = await tx.select({
      id: inventory.id,
      name: gifts.name,
      source: inventory.source,
    }).from(inventory)
      .innerJoin(gifts, eq(inventory.giftId, gifts.id))
      .where(and(inArray(inventory.id, inventoryIds), eq(inventory.userId, userId), eq(inventory.status, "owned")))
    if (prizes.length !== inventoryIds.length) throw new Error("One of these NFT gifts is no longer available")
    prizes.forEach((prize) => assertFreeCaseGiftUnlocked(prize.source, claim.ready))

    const locked = await tx.update(inventory).set({ status: "giveaway_locked" }).where(and(
      inArray(inventory.id, inventoryIds),
      eq(inventory.userId, userId),
      eq(inventory.status, "owned"),
    )).returning({ id: inventory.id })
    if (locked.length !== inventoryIds.length) throw new Error("One of these NFT gifts is already in use")

    const created = (await tx.insert(giveaways).values({
      ownerUserId: userId,
      channelId: channel.id,
      inventoryId: inventoryIds[0],
      inventoryIds,
      title,
      body,
      // Keep Telegram posts within their text limit even when the owner locks a
      // large inventory selection into one giveaway.
      prizeText: prizes.length === 1 ? prizes[0].name : `${prizes.length} NFT gifts`,
      ticketPrice: ticketPrice.toFixed(2),
      winnerCount,
      maxTicketsPerUser: maxTickets,
      status: "draft",
      endsAt: new Date(Date.now() + durationMinutes * 60_000),
    }).returning())[0]
    if (requiredChannelIds.length) {
      await tx.insert(giveawayRequiredChannels).values(requiredChannelIds.map((requiredChannelId) => ({
        giveawayId: created.id,
        channelId: requiredChannelId,
      })))
    }
    return created
  })
  const postText = giveawayPostText({ ...giveaway, status: "active", requiredChannels })
  const post = photo
    ? await sendGiveawayPhoto(channel.chatId, photo, postText, giveawayKeyboard({ ...giveaway, status: "active" }))
    : await telegramCall<TelegramPostedMessage>("sendMessage", {
        chat_id: channel.chatId, text: postText, parse_mode: "HTML",
        link_preview_options: { is_disabled: true }, reply_markup: giveawayKeyboard({ ...giveaway, status: "active" }),
      })
  if (!post.ok || !post.result?.message_id) {
    await db.transaction(async (tx) => {
      await tx.update(giveaways).set({ status: "failed" }).where(eq(giveaways.id, giveaway.id))
      await tx.update(inventory).set({ status: "owned" }).where(and(
        inArray(inventory.id, inventoryIds),
        eq(inventory.userId, userId),
        eq(inventory.status, "giveaway_locked"),
      ))
    })
    throw new Error(post.description || "Telegram could not publish the giveaway")
  }

  const photoFileId = post.result.photo?.at(-1)?.file_id ?? null
  await db.update(giveaways).set({ status: "active", postMessageId: post.result.message_id, photoFileId }).where(eq(giveaways.id, giveaway.id))
  revalidatePath("/giveaways")
  return { id: giveaway.id, channelUrl: channel.username ? `https://t.me/${channel.username}/${post.result.message_id}` : null }
}

type TelegramPostedMessage = { message_id: number; photo?: Array<{ file_id: string }> }

function parseGiveawayPhoto(dataUrl?: string) {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error("Choose a JPG, PNG or WebP image")
  const bytes = Buffer.from(match[2], "base64")
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new Error("Photo must be smaller than 3 MB")
  return { bytes, mime: match[1], extension: match[1].split("/")[1].replace("jpeg", "jpg") }
}

async function sendGiveawayPhoto(chatId: string, photo: NonNullable<ReturnType<typeof parseGiveawayPhoto>>, caption: string, keyboard: unknown) {
  const form = new FormData()
  form.set("chat_id", chatId)
  form.set("photo", new Blob([photo.bytes], { type: photo.mime }), `giveaway.${photo.extension}`)
  form.set("caption", caption)
  form.set("parse_mode", "HTML")
  form.set("reply_markup", JSON.stringify(keyboard))
  return telegramCallMultipart<TelegramPostedMessage>("sendPhoto", form)
}

export async function finishGiveaway(giveawayId: number) {
  const userId = await requireUserId()
  const giveaway = (await db.select().from(giveaways).where(and(eq(giveaways.id, giveawayId), eq(giveaways.ownerUserId, userId))).limit(1))[0]
  if (!giveaway || giveaway.status !== "active") throw new Error("Active giveaway not found")
  await settleGiveaway(giveaway.id)
  revalidatePath("/giveaways")
}

function publicError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

export async function getGiveawayDashboardSafe() {
  try { return { ok: true as const, data: await getGiveawayDashboard() } }
  catch (error) { return { ok: false as const, error: publicError(error) } }
}

export async function createGiveawaySafe(input: Parameters<typeof createGiveaway>[0]) {
  try { return { ok: true as const, data: await createGiveaway(input) } }
  catch (error) { return { ok: false as const, error: publicError(error) } }
}

export async function finishGiveawaySafe(giveawayId: number) {
  try { await finishGiveaway(giveawayId); return { ok: true as const } }
  catch (error) { return { ok: false as const, error: publicError(error) } }
}

export async function joinGiveawaySafe(giveawayId: number, ticketCount = 1) {
  try { return { ok: true as const, data: await joinGiveaway(giveawayId, ticketCount) } }
  catch (error) { return { ok: false as const, error: publicError(error) } }
}
