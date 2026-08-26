import { NextRequest, NextResponse } from "next/server"
import { cashoutMines, getActiveMines, revealMineTile, startMines } from "@/app/actions/mines"

export async function GET() {
  try {
    return NextResponse.json(await getActiveMines())
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; bet?: number; mineCount?: number; roundId?: number; tile?: number }
    if (body.action === "start") return NextResponse.json(await startMines(Number(body.bet), Number(body.mineCount)))
    if (body.action === "reveal") return NextResponse.json(await revealMineTile(Number(body.roundId), Number(body.tile)))
    if (body.action === "cashout") return NextResponse.json(await cashoutMines(Number(body.roundId)))
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : error === "INSUFFICIENT_FUNDS" ? 409 : 400 })
  }
}
