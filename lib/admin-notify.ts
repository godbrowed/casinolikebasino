import "server-only"

const token = process.env.TELEGRAM_BOT_TOKEN

export async function notifyAdmins(text: string, replyMarkup?: unknown) {
  if (!token) return
  const ids = (process.env.ADMIN_TELEGRAM_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  await Promise.allSettled(ids.map((chatId) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup }), cache: "no-store",
  })))
}
