import "server-only"
import crypto from "crypto"
import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { db } from "./db"
import { users } from "./db/schema"
import type { TelegramUser } from "./telegram"

const COOKIE = "casino_session"

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "v0-local-development-only-secret"
  throw new Error("SESSION_SECRET is required in production")
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

function sign(id: string) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = `${id}.${issuedAt}`
  const sig = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex")
  return `${payload}.${sig}`
}

function unsign(value: string | undefined): string | null {
  if (!value) return null
  const signatureSeparator = value.lastIndexOf(".")
  if (signatureSeparator === -1) return null
  const payload = value.slice(0, signatureSeparator)
  const sig = value.slice(signatureSeparator + 1)
  const issuedAtSeparator = payload.lastIndexOf(".")
  if (issuedAtSeparator === -1) return null
  const id = payload.slice(0, issuedAtSeparator)
  const issuedAt = Number(payload.slice(issuedAtSeparator + 1))
  const now = Math.floor(Date.now() / 1000)
  if (!id || !Number.isSafeInteger(issuedAt) || issuedAt > now + 300 || now - issuedAt > SESSION_TTL_SECONDS) return null

  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex")
  const valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  return valid ? id : null
}

export async function createSession(tg: TelegramUser) {
  // Telegram user ID is the account identity. Atomic upsert avoids duplicate
  // account races when the Mini App sends parallel startup requests.
  await db
    .insert(users)
    .values({
      id: tg.id,
      username: tg.username,
      firstName: tg.firstName,
      photoUrl: tg.photoUrl,
      isDemo: tg.isDemo,
      balance: tg.isDemo ? "5000" : "0",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: tg.username,
        firstName: tg.firstName,
        photoUrl: tg.photoUrl,
        lastSeen: new Date(),
      },
    })

  const store = await cookies()
  store.set(COOKIE, sign(tg.id), {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies()
  return unsign(store.get(COOKIE)?.value)
}

export async function getCurrentUser() {
  const id = await getCurrentUserId()
  if (!id) return null
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId()
  if (!id) throw new Error("Unauthorized")
  return id
}
