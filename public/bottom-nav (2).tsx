import { NextResponse } from "next/server"

const token = process.env.TELEGRAM_BOT_TOKEN

function baseUrl(): string {
  const explicit = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ""
}

async function tg(method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// One-time bot setup: registers the webhook, the /start command, and the
// persistent "Open app" menu button. Protect with ADMIN_SECRET.
// Call: GET /api/telegram/setup?secret=YOUR_ADMIN_SECRET
export async function GET(req: Request) {
  const secret = process.env.ADMIN_SECRET
  const provided = new URL(req.url).searchParams.get("secret")
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 400 })
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET is not set" }, { status: 400 })
  }
  const url = baseUrl()
  if (!url) {
    return NextResponse.json({ ok: false, error: "Could not resolve app URL" }, { status: 400 })
  }

  const bot = await tg("getMe", {})
  const webhook = await tg("setWebhook", {
    url: `${url}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "pre_checkout_query", "business_connection"],
  })
  const commands = await tg("setMyCommands", {
    commands: [{ command: "start", description: "Open Giftlys" }],
  })
  const menu = await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Open app", web_app: { url } },
  })

  const channel = await tg("getChat", { chat_id: "@giftlysnft" })

  return NextResponse.json({
    ok: Boolean(webhook?.ok && commands?.ok && menu?.ok && bot?.ok && channel?.ok),
    appUrl: url,
    bot: bot?.result ? { id: bot.result.id, username: bot.result.username } : bot,
    requiredBotUsernameEnv: bot?.result?.username || null,
    channel: channel?.result ? { id: channel.result.id, username: channel.result.username } : channel,
    webhook,
    commands,
    menu,
  })
}
