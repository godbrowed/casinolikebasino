import { NextRequest, NextResponse } from "next/server"
import { cashoutGiftCrash, settleGiftBust, startGiftCrash } from "@/app/actions/crash"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; inventoryId?: number; token?: string }
    if (body.action === "start") return NextResponse.json(await startGiftCrash(Number(body.inventoryId)))
    if (body.action === "cashout" && body.token) return NextResponse.json(await cashoutGiftCrash(body.token))
    if (body.action === "settle" && body.token) {
      await settleGiftBust(body.token)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    const status = error === "Unauthorized" ? 401 : error === "BETTING_CLOSED" ? 409 : 400
    return NextResponse.json({ error }, { status })
  }
}
