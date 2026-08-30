import { NextRequest, NextResponse } from "next/server"
import { cashoutGiftCrash, settleGiftBust, startGiftCrash } from "@/app/actions/crash"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; inventoryIds?: number[]; token?: string }
    if (body.action === "start") return NextResponse.json(await startGiftCrash(body.inventoryIds ?? []))
    if (body.action === "cashout" && body.token) return NextResponse.json(await cashoutGiftCrash(body.token))
    if (body.action === "settle" && body.token) {
      await settleGiftBust(body.token)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    const status = error === "Unauthorized" ? 401 : error === "CRASH_MAINTENANCE" ? 503 : error === "BETTING_CLOSED" ? 409 : 400
    return NextResponse.json({ error }, { status })
  }
}
