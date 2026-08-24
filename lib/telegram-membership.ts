import "server-only"

const ACTIVE_STATUSES = new Set(["member", "administrator", "creator"])

export function normalizeTelegramUsername(value: string | undefined, fallback = ""): string {
  return (value || fallback).trim().replace(/^@+/, "")
}

export async function isDailyChannelMember(telegramUserId: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const channel = normalizeTelegramUsername(process.env.DAILY_CHANNEL_USERNAME)
  if (!token || !channel) throw new Error("SUBSCRIPTION_CHECK_NOT_CONFIGURED")

  const url = new URL(`https://api.telegram.org/bot${token}/getChatMember`)
  url.searchParams.set("chat_id", `@${channel}`)
  url.searchParams.set("user_id", telegramUserId)
  const response = await fetch(url, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { status?: string } }
    | null

  if (!response.ok || !payload?.ok) return false
  return ACTIVE_STATUSES.has(payload.result?.status || "")
}

export function dailyChannelUsername(): string {
  return normalizeTelegramUsername(process.env.DAILY_CHANNEL_USERNAME)
}
