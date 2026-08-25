import { NextRequest, NextResponse } from "next/server"
import { joinBattle, leaveBattle } from "@/app/actions/battles"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; bet?: number; roomId?: number }
    if (body.action === "join") return NextResponse.json(await joinBattle({ bet: Number(body.bet), roomId: body.roomId }))
    if (body.action === "leave" && Number.isFinite(body.roomId)) {
      await leaveBattle(Number(body.roomId))
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    if (error === "Unauthorized") return NextResponse.json({ error }, { status: 401 })
    if (error === "INSUFFICIENT_FUNDS" || error === "SESSION_CLOSED") {
      return NextResponse.json({ error }, { status: 409 })
    }
    if (error === "INVALID_BET" || error === "INVALID_ACTION") {
      return NextResponse.json({ error }, { status: 400 })
    }

    console.error("PvP action failed", cause)
    return NextResponse.json({ error: "PVP_TEMPORARILY_UNAVAILABLE" }, { status: 500 })
  }
}
