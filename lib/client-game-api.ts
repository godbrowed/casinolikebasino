"use client"

import type { CrashBoard, OwnedGift } from "@/app/actions/crash"
import type { BattleSession, MatchState } from "@/app/actions/battles"
import type { GiftDTO } from "@/app/actions/cases"

type ApiError = { error?: string }
export type LiveDrop = { id: number; name: string; rarity: string; imageUrl: string; value: number }
export type FreeCaseRequirements = { shares: number; requiredShares: number; subscribed: boolean; channelCheckAvailable: boolean; tradeVisited: boolean; ready: boolean; channelUrl: string; tradeUrl: string }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
  const payload = (await response.json().catch(() => ({}))) as T & ApiError
  if (!response.ok) throw new Error(payload.error || "REQUEST_FAILED")
  return payload
}

export const fetchCrashBoard = () => api<CrashBoard>("/api/crash/board")
export const fetchLiveDrops = () => api<LiveDrop[]>("/api/live-drops")
export const fetchFreeCaseRequirements = () => api<FreeCaseRequirements>("/api/cases/requirements")
export const updateFreeCaseRequirement = (action: "prepare-share" | "share-complete" | "trade-visit") =>
  api<FreeCaseRequirements & { messageId?: string }>("/api/cases/requirements", { method: "POST", body: JSON.stringify({ action }) })

export const fetchCrashGifts = () =>
  api<{ gifts: OwnedGift[]; rewardImages: string[] }>("/api/crash/gifts")

export const startCrashApi = (bet: number) =>
  api<{ token: string; startTime: number; balance: number }>("/api/crash/action", {
    method: "POST",
    body: JSON.stringify({ action: "start", bet }),
  })

export const cashoutCrashApi = (token: string) =>
  api<{ success: boolean; multiplier: number; crashPoint: number; payout: number; balance: number | null }>("/api/crash/action", {
    method: "POST",
    body: JSON.stringify({ action: "cashout", token }),
  })

export const settleCrashApi = (token: string) =>
  api<{ ok: true }>("/api/crash/action", {
    method: "POST",
    body: JSON.stringify({ action: "settle", token }),
  })

export const startGiftCrashApi = (inventoryId: number) =>
  api<{ token: string; startTime: number; stakeValue: number }>("/api/crash/gift-action", {
    method: "POST",
    body: JSON.stringify({ action: "start", inventoryId }),
  })

export const cashoutGiftCrashApi = (token: string) =>
  api<{ success: boolean; multiplier: number; crashPoint: number; gift: OwnedGift | null }>("/api/crash/gift-action", {
    method: "POST",
    body: JSON.stringify({ action: "cashout", token }),
  })

export const settleGiftCrashApi = (token: string) =>
  api<{ ok: true }>("/api/crash/gift-action", {
    method: "POST",
    body: JSON.stringify({ action: "settle", token }),
  })

export const fetchBattleSessions = () => api<BattleSession[]>("/api/battles/sessions")
export const fetchMatchState = (roomId: number) => api<MatchState>(`/api/battles/match/${roomId}`)

export const joinBattleApi = (bet: number, roomId?: number) =>
  api<{ roomId: number }>("/api/battles/action", {
    method: "POST",
    body: JSON.stringify({ action: "join", bet, roomId }),
  })

export const leaveBattleApi = (roomId: number) =>
  api<{ ok: true }>("/api/battles/action", {
    method: "POST",
    body: JSON.stringify({ action: "leave", roomId }),
  })

export const openCasesApi = (caseId: number, count: number) =>
  api<{ results: { won: GiftDTO; inventoryId: number | null }[]; balance: number }>("/api/cases/open", {
    method: "POST",
    body: JSON.stringify({ caseId, count }),
  })

export const sellGiftApi = (inventoryId: number) =>
  api<{ balance: number; value: number }>("/api/inventory/action", {
    method: "POST",
    body: JSON.stringify({ action: "sell", inventoryId }),
  })

export const sellAllGiftsApi = () =>
  api<{ balance: number | null; total: number }>("/api/inventory/action", {
    method: "POST",
    body: JSON.stringify({ action: "sellAll" }),
  })

export const withdrawGiftApi = (inventoryId: number) =>
  api<{ ok: true }>("/api/inventory/action", {
    method: "POST",
    body: JSON.stringify({ action: "withdraw", inventoryId }),
  })
