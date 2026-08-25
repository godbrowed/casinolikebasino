import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

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

async function setBotAvatar() {
  const image = await readFile(path.join(process.cwd(), "public", "images", "puggift-bot-avatar-v2.png"))
  const form = new FormData()
  form.set("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }))
  form.set("avatar", new Blob([new Uint8Array(image)], { type: "image/png" }), "puggift-avatar-v2.png")
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: "POST", body: form })
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
    allowed_updates: ["message", "pre_checkout_query", "callback_query", "my_chat_member"],
  })
  const commands = await tg("setMyCommands", {
    commands: [{ command: "start", description: "Open PugGift" }],
  })
  const menu = await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "🎮 Play PugGift", web_app: { url } },
  })
  const channelAdminRights = await tg("setMyDefaultAdministratorRights", {
    for_channels: true,
    rights: {
      can_manage_chat: true,
      can_post_messages: true,
      can_edit_messages: true,
      can_delete_messages: false,
      can_invite_users: false,
      can_manage_video_chats: false,
      can_promote_members: false,
      is_anonymous: false,
    },
  })
  const name = await tg("setMyName", { name: "PugGift" })
  const shortDescription = await tg("setMyShortDescription", { short_description: "Telegram gifts, live Crash and real-player PvP with the black pug." })
  const description = await tg("setMyDescription", { description: "Open Telegram gifts, upgrade your collection, fly in synchronized Crash rounds and challenge real players in PvP. Enter the PugGift arcade below." })
  const avatar = await setBotAvatar().catch((error) => ({ ok: false, description: error instanceof Error ? error.message : "Avatar upload failed" }))

  const channelUsername = process.env.DAILY_CHANNEL_USERNAME?.trim().replace(/^@+/, "")
  const channel = channelUsername ? await tg("getChat", { chat_id: `@${channelUsername}` }) : { ok: true, result: null }

  return NextResponse.json({
    ok: Boolean(webhook?.ok && commands?.ok && menu?.ok && channelAdminRights?.ok && bot?.ok && channel?.ok && name?.ok && shortDescription?.ok && description?.ok && avatar?.ok),
    appUrl: url,
    bot: bot?.result ? { id: bot.result.id, username: bot.result.username } : bot,
    requiredBotUsernameEnv: bot?.result?.username || null,
    channel: channel?.result ? { id: channel.result.id, username: channel.result.username } : null,
    webhook,
    commands,
    menu,
    channelAdminRights,
    profile: { name, shortDescription, description, avatar },
  })
}
