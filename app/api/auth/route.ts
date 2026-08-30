import { NextResponse } from "next/server"
import { validateInitData, DEMO_USER } from "@/lib/telegram"
import { createSession, getCurrentUser } from "@/lib/session"

async function getBotUsername(): Promise<string | null> {
  const configured = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@+/, "")
  if (configured) return configured

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      next: { revalidate: 86_400 },
    })
    const payload = await response.json()
    return payload?.ok ? payload.result?.username ?? null : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  let initData = ""
  try {
    const body = await req.json()
    initData = body?.initData ?? ""
  } catch {
    // ignore
  }

  const telegramUser = validateInitData(initData)
  const demoEnabled = process.env.ENABLE_DEMO_AUTH === "true" && process.env.NODE_ENV !== "production"
  const tgUser = telegramUser ?? (demoEnabled ? DEMO_USER : null)

  if (!tgUser) {
    return NextResponse.json(
      {
        user: null,
        error: "TELEGRAM_REQUIRED",
        botUsername: await getBotUsername(),
      },
      { status: 401 },
    )
  }

  const session = await createSession(tgUser)
  if (session.blocked) {
    return NextResponse.json({ user: null, error: "ACCOUNT_BLOCKED" }, { status: 403 })
  }
  const user = await getCurrentUser()

  return NextResponse.json({ user })
}
