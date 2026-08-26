import { NextRequest, NextResponse } from "next/server"
import { requireUserId } from "@/lib/session"
import { freeCaseRequirements, prepareFreeCaseShare, recordFreeCaseShare, recordTradeVisit } from "@/lib/free-case"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const userId = await requireUserId()
    return NextResponse.json(await freeCaseRequirements(userId), { headers: { "cache-control": "no-store" } })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUIREMENTS_FAILED"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await request.json() as { action?: string }
    if (body.action === "prepare-share") return NextResponse.json({ messageId: await prepareFreeCaseShare(userId) })
    if (body.action === "share-complete") await recordFreeCaseShare(userId)
    else if (body.action === "trade-visit") await recordTradeVisit(userId)
    else return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 })
    return NextResponse.json(await freeCaseRequirements(userId))
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUIREMENTS_FAILED"
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 400 })
  }
}
