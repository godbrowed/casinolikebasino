import { NextRequest, NextResponse } from "next/server"
import { rollPugDice } from "@/app/actions/dice"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { bet?: number; multiplier?: number }
    return NextResponse.json(await rollPugDice(Number(body.bet), Number(body.multiplier)))
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : error === "INSUFFICIENT_FUNDS" ? 409 : 400 })
  }
}
