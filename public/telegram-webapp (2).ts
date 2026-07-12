import "server-only"

// Thin wrapper around Telegram Bot API gift methods used by the NFT gift relayer.
// The relayer is the owner's Telegram account connected to the bot as a Business
// account. All calls are gated on env vars so the app runs fine before keys are
// added — the deposit/withdraw flows then fall back to manual admin confirmation.
//
// Required env for automated relaying:
//   TELEGRAM_BOT_TOKEN               – the bot token from @BotFather
//   TELEGRAM_BUSINESS_CONNECTION_ID  – business connection id linking the owner's
//                                      account to the bot (needed for gift ops)
// Optional:
//   RELAYER_USERNAME                 – @username shown to users for manual deposits

const API = "https://api.telegram.org"

export function relayerConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BUSINESS_CONNECTION_ID)
}

export function relayerUsername(): string | null {
  const username = process.env.RELAYER_USERNAME?.trim().replace(/^@+/, "")
  return username || null
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
