"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"

const RAW_TON_ADDRESS = /^[A-Za-z0-9_-]{48}$/

export async function linkTonWallet(address: string) {
  const userId = await requireUserId()
  const normalized = address.trim()
  if (!RAW_TON_ADDRESS.test(normalized)) throw new Error("Invalid TON wallet address")

  await db.update(users).set({ tonWalletAddress: normalized }).where(eq(users.id, userId))
  revalidatePath("/profile")
  return { address: normalized }
}

export async function unlinkTonWallet() {
  const userId = await requireUserId()
  await db.update(users).set({ tonWalletAddress: null }).where(eq(users.id, userId))
  revalidatePath("/profile")
  return { ok: true }
}
