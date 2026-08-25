import { NextRequest, NextResponse } from "next/server"
import { getMatchState } from "@/app/actions/battles"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params
    return NextResponse.json(await getMatchState(Number(roomId)), { headers: { "cache-control": "no-store" } })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "MATCH_UNAVAILABLE"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 404 })
  }
}
