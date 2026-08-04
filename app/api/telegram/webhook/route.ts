import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, transactions } from "@/lib/db/schema"
import { starsToGram } from "@/lib/deposit-shared"

const token = process.env.TELEGRAM_BOT_TOKEN

async function tg(method: string, body: unknown) {
  if (!token) return
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return response.json().catch(() => null)
}

/** Resolve the public HTTPS URL of the Web App for the "Open app" button. */
function webAppUrl(): string {
  const explicit = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://t.me"
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 })
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  if (!update) return NextResponse.json({ ok: true })

  // Greet on /start (and any plain text) with an "Open app" Web App button.
  const message = update.message
  const text: string | undefined = message?.text
  if (message?.chat?.id && text && !message.successful_payment) {
    const firstName: string = message.from?.first_name || "there"
    const isStart = text.startsWith("/start")
    const url = webAppUrl()
    if (isStart) {
      const photo = await tg("sendPhoto", {
        chat_id: message.chat.id,
        // New filename prevents Telegram from serving a previously cached banner.
        photo: `${url}/images/giftlys-welcome.png`,
        caption: `✨ Welcome to Giftlys, ${firstName}!\n\nChoose a game, collect rare gifts and make every round count.`,
        reply_markup: {
          inline_keyboard: [[{ text: "🎮 Play Giftlys", web_app: { url } }]],
        },
      })
      if (photo?.ok) return NextResponse.json({ ok: true })
    }
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: isStart
        ? `✨ Welcome to Giftlys, ${firstName}!\n\nYour gift arcade is ready: choose a game, open surprises and play live rounds with everyone.\n\nPress Play to enter.`
        : `🎮 Your Giftlys arcade is waiting — tap Play to continue.`,
      reply_markup: {
        inline_keyboard: [[{ text: "🎮 Play Giftlys", web_app: { url } }]],
      },
    })
    return NextResponse.json({ ok: true })
  }

  // Telegram requires a pre-checkout response within 10 seconds. Approve only
  // an existing pending intent belonging to the paying Telegram account.
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query
    const pending = await db
      .select({ userId: transactions.userId })
      .from(transactions)
      .where(
        and(
          eq(transactions.externalId, query.invoice_payload),
          eq(transactions.currency, "stars"),
          eq(transactions.status, "pending"),
          eq(transactions.amount, String(query.total_amount)),
        ),
      )
      .limit(1)
    const valid = query.currency === "XTR" && pending[0]?.userId === String(query.from?.id)
    await tg("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id,
      ok: valid,
      error_message: valid ? undefined : "This payment session is invalid or expired. Please create a new one.",
    })
    return NextResponse.json({ ok: true })
  }

  const payment = update.message?.successful_payment
  if (payment) {
    const stars = Number(payment.total_amount)
    if (Number.isSafeInteger(stars) && stars > 0 && payment.currency === "XTR") {
      const credited = starsToGram(stars)
      await db.transaction(async (t) => {
        // Claim the pending intent first. Replayed Telegram updates cannot claim it twice.
        const claimed = await t
          .update(transactions)
          .set({
            status: "completed",
            credited: String(credited),
            meta: {
              telegramPaymentChargeId: payment.telegram_payment_charge_id,
              providerPaymentChargeId: payment.provider_payment_charge_id,
            },
          })
          .where(
            and(
              eq(transactions.externalId, payment.invoice_payload),
              eq(transactions.currency, "stars"),
              eq(transactions.status, "pending"),
              eq(transactions.amount, String(stars)),
            ),
          )
          .returning({ userId: transactions.userId })

        if (claimed.length === 0) return
        await t
          .update(users)
          .set({
            balance: sql`${users.balance} + ${credited}`,
            totalDepositedStars: sql`${users.totalDepositedStars} + ${stars}`,
          })
          .where(eq(users.id, claimed[0].userId))
      })
    }
  }

  return NextResponse.json({ ok: true })
}
