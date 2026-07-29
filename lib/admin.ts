import "server-only"

/** Telegram account IDs allowed to use the in-app administration tools. */
export function isAdminId(id: string | null | undefined): boolean {
  if (!id) return false
  const allowed = (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  return allowed.includes(id)
}
