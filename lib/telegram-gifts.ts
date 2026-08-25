import "server-only"

// Thin wrapper around Telegram Bot API gift methods used by the gift relayer.
// Deposits can be detected from a normal public Telegram account through
// getUserGifts. A Business connection is only needed for automatic withdrawals.
//
// Required env for automated relaying:
//   TELEGRAM_BOT_TOKEN               – the bot token from @BotFather
//   TELEGRAM_BUSINESS_CONNECTION_ID  – business connection id linking the owner's
//                                      account to the bot (needed for gift ops)
// Optional:
//   RELAYER_USERNAME                 – @username shown to users for manual deposits

const API = "https://api.telegram.org"

export function businessRelayerConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BUSINESS_CONNECTION_ID)
}

export function relayerBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

export function relayerUsername(): string | null {
  const username = process.env.RELAYER_USERNAME?.trim().replace(/^@+/, "")
  return username || "pugsrelayer"
}

export function configuredRelayerUserId(): number | null {
  const value = Number(process.env.RELAYER_USER_ID)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set")
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.description || `${method} failed`)
  return data.result as T
}

export type TgOwnedGift = {
  ownedGiftId: string
  type: string
  name: string | null
  transferStarCount: number
  canBeTransferred: boolean
}

export type RelayerDepositEvent = {
  fingerprint: string
  senderUserId: string | null
  sendDate: number
  type: string
  giftId: string | null
  giftSlug: string | null
  giftName: string | null
}

/**
 * Read gifts hosted by a normal Telegram relayer profile. This does not need a
 * Business connection. sender_user is intentionally required by the matching
 * layer, so anonymous/private transfers are never credited to the wrong user.
 */
export async function getRelayerDepositEvents(userId: number): Promise<RelayerDepositEvent[]> {
  const result = await call<{ gifts: any[] }>("getUserGifts", {
    user_id: userId,
    sort_by_price: false,
    offset: "",
    limit: 100,
  })

  return (result.gifts ?? []).map((owned) => {
    const gift = owned.gift ?? {}
    const senderUserId = owned.sender_user?.id == null ? null : String(owned.sender_user.id)
    const sendDate = Number(owned.send_date ?? 0)
    const giftId = gift.id == null ? null : String(gift.id)
    const giftSlug = typeof gift.slug === "string" ? gift.slug : null
    const giftName = gift.base_name ?? gift.name ?? gift.title ?? null
    const fingerprint = giftSlug
      ? `unique:${giftSlug}`
      : `${owned.type ?? "gift"}:${senderUserId ?? "private"}:${sendDate}:${giftId ?? "unknown"}`
    return {
      fingerprint,
      senderUserId,
      sendDate,
      type: owned.type ?? "gift",
      giftId,
      giftSlug,
      giftName: typeof giftName === "string" ? giftName : null,
    }
  })
}

/** List unique gifts currently owned by the connected business account (the relayer). */
export async function getRelayerGifts(): Promise<TgOwnedGift[]> {
  const connId = process.env.TELEGRAM_BUSINESS_CONNECTION_ID
  if (!connId) throw new Error("TELEGRAM_BUSINESS_CONNECTION_ID not set")
  const result = await call<{ gifts: any[] }>("getBusinessAccountGifts", {
    business_connection_id: connId,
    exclude_unsaved: false,
  })
  return (result.gifts ?? []).map((g) => ({
    ownedGiftId: g.owned_gift_id,
    type: g.type,
    name: g.gift?.base_name ?? g.gift?.name ?? null,
    transferStarCount: g.transfer_star_count ?? 0,
    canBeTransferred: Boolean(g.can_be_transferred),
  }))
}

/** Transfer an owned unique gift from the relayer to a user (withdrawal fulfillment). */
export async function transferGiftToUser(ownedGiftId: string, newOwnerChatId: string | number, starCount = 0): Promise<void> {
  const connId = process.env.TELEGRAM_BUSINESS_CONNECTION_ID
  if (!connId) throw new Error("TELEGRAM_BUSINESS_CONNECTION_ID not set")
  await call("transferGift", {
    business_connection_id: connId,
    owned_gift_id: ownedGiftId,
    new_owner_chat_id: newOwnerChatId,
    star_count: starCount,
  })
}

/** Send a simple notification message to a user (e.g. deposit received / payout sent). */
export async function notifyUser(chatId: string | number, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return
  try {
    await call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" })
  } catch {
    // best-effort
  }
}
