"use server"

import { and, desc, eq, isNotNull, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { giveawayChannels, giveawayEntries, giveaways, gifts, inventory, users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { giveawayKeyboard, giveawayPostText, joinGiveawayFromCallback, resolveBotUsername, settleExpiredGiveaways, settleGiveaway, telegramCall } from "@/lib/giveaways"
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
    isOwner: boolean
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
      isOwner: giveaway.ownerUserId === userId,
    })),
  }
}

export async function joinGiveaway(giveawayId: number) {
  const userId = await requireUserId()
  const telegramId = Number(userId)
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new Error("Telegram account is required")
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) throw new Error("User not found")
  const result = await joinGiveawayFromCallback({
    giveawayId: Number(giveawayId),
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
  channelId: number
  inventoryId: number
  title: string
  body: string
  ticketPrice: number
  durationMinutes: number
  maxTicketsPerUser?: number
}) {
  const userId = await requireUserId()
  const channelId = Number(input.channelId)
  const inventoryId = Number(input.inventoryId)
  const title = input.title?.trim()
  const body = input.body?.trim()
  const ticketPrice = Number(input.ticketPrice)
  const durationMinutes = Number(input.durationMinutes)
  const maxTickets = ticketPrice > 0 ? Number(input.maxTicketsPerUser || 100) : 1

  if (!Number.isSafeInteger(channelId) || channelId <= 0) throw new Error("Choose a channel")
  if (!Number.isSafeInteger(inventoryId) || inventoryId <= 0) throw new Error("Choose an NFT gift from your profile")
  if (!title || title.length > 80) throw new Error("Title must contain 1–80 characters")
  if (!body || body.length > 1200) throw new Error("Text must contain 1–1,200 characters")
  if (!Number.isFinite(ticketPrice) || ticketPrice < 0 || ticketPrice > 100_000) throw new Error("Invalid ticket price")
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 43_200) throw new Error("Duration must be between 5 minutes and 30 days")
  if (!Number.isSafeInteger(maxTickets) || maxTickets < 1 || maxTickets > 1000) throw new Error("Invalid ticket limit")

  const channel = (await db.select().from(giveawayChannels).where(and(
    eq(giveawayChannels.id, channelId),
    eq(giveawayChannels.ownerUserId, userId),
    eq(giveawayChannels.active, true),
    eq(giveawayChannels.canPostMessages, true),
  )).limit(1))[0]
  if (!channel) throw new Error("The channel is not connected or the bot cannot post")

  const claim = await getFreeCaseClaimStatus(userId)
  const giveaway = await db.transaction(async (tx) => {
    const prize = (await tx.select({
      id: inventory.id,
      name: gifts.name,
      source: inventory.source,
    }).from(inventory)
      .innerJoin(gifts, eq(inventory.giftId, gifts.id))
      .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId), eq(inventory.status, "owned")))
      .limit(1))[0]
    if (!prize) throw new Error("This NFT gift is no longer available")
    assertFreeCaseGiftUnlocked(prize.source, claim.ready)

    const locked = await tx.update(inventory).set({ status: "giveaway_locked" }).where(and(
      eq(inventory.id, inventoryId),
      eq(inventory.userId, userId),
      eq(inventory.status, "owned"),
    )).returning({ id: inventory.id })
    if (!locked[0]) throw new Error("This NFT gift is already in use")

    return (await tx.insert(giveaways).values({
      ownerUserId: userId,
      channelId,
      inventoryId,
      title,
      body,
      prizeText: prize.name,
      ticketPrice: ticketPrice.toFixed(2),
      winnerCount: 1,
      maxTicketsPerUser: maxTickets,
      status: "draft",
      endsAt: new Date(Date.now() + durationMinutes * 60_000),
    }).returning())[0]
  })
  const post = await telegramCall<{ message_id: number }>("sendMessage", {
    chat_id: channel.chatId,
    text: giveawayPostText({ ...giveaway, status: "active" }),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: giveawayKeyboard({ ...giveaway, status: "active" }),
  })
  if (!post.ok || !post.result?.message_id) {
    await db.transaction(async (tx) => {
      await tx.update(giveaways).set({ status: "failed" }).where(eq(giveaways.id, giveaway.id))
      await tx.update(inventory).set({ status: "owned" }).where(and(
        eq(inventory.id, inventoryId),
        eq(inventory.userId, userId),
        eq(inventory.status, "giveaway_locked"),
      ))
    })
    throw new Error(post.description || "Telegram could not publish the giveaway")
  }

  await db.update(giveaways).set({ status: "active", postMessageId: post.result.message_id }).where(eq(giveaways.id, giveaway.id))
  revalidatePath("/giveaways")
  return { id: giveaway.id, channelUrl: channel.username ? `https://t.me/${channel.username}/${post.result.message_id}` : null }
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

export async function joinGiveawaySafe(giveawayId: number) {
  try { return { ok: true as const, data: await joinGiveaway(giveawayId) } }
  catch (error) { return { ok: false as const, error: publicError(error) } }
}
