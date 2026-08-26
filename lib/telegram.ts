import crypto from "crypto"

export type TelegramUser = {
  id: string
  username: string | null
  firstName: string | null
  photoUrl: string | null
  isDemo: boolean
  isPremium: boolean
  referrerId: string | null
  referrerProgram: "free-case" | "commission" | null
}

/**
 * Validates Telegram WebApp initData using the bot token.
 * Returns the authenticated user, or null if validation fails / no token.
 * See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string): TelegramUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !initData) return null

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")
    if (!hash) return null
    params.delete("hash")

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n")

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest()
    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex")

    if (
      computed.length !== hash.length ||
      !crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"))
    ) return null

    // Telegram initData is short-lived. Require auth_date, reject stale data and
    // timestamps more than 5 minutes in the future (clock-skew allowance).
    const authDate = Number(params.get("auth_date"))
    const now = Math.floor(Date.now() / 1000)
    if (!Number.isSafeInteger(authDate) || authDate <= 0) return null
    if (now - authDate > 60 * 60 * 24 || authDate - now > 60 * 5) return null

    const userRaw = params.get("user")
    if (!userRaw) return null
    const u = JSON.parse(userRaw)

    return {
      id: String(u.id),
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      photoUrl: u.photo_url ?? null,
      isDemo: false,
      isPremium: u.is_premium === true,
      referrerId: /^(?:ref|refer)_[0-9]{1,20}$/.test(params.get("start_param") || "")
        ? (params.get("start_param") || "").split("_")[1] || null
        : null,
      referrerProgram: /^refer_[0-9]{1,20}$/.test(params.get("start_param") || "")
        ? "commission"
        : /^ref_[0-9]{1,20}$/.test(params.get("start_param") || "")
          ? "free-case"
          : null,
    }
  } catch {
    return null
  }
}

/** Demo user used in preview / when Telegram context is unavailable. */
export const DEMO_USER: TelegramUser = {
  id: "demo",
  username: "demo_player",
  firstName: "Demo",
  photoUrl: null,
  isDemo: true,
  isPremium: false,
  referrerId: null,
  referrerProgram: null,
}
