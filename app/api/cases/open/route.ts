import { NextRequest, NextResponse } from "next/server"
import { openCases } from "@/app/actions/cases"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { caseId?: number; count?: number }
    return NextResponse.json(await openCases(Number(body.caseId), Number(body.count)))
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "OPEN_FAILED"
    const status = error === "Unauthorized" ? 401 : error === "INSUFFICIENT_FUNDS" || error === "FREE_CASE_COOLDOWN" || error === "FREE_CASE_REQUIREMENTS" ? 409 : 400
    return NextResponse.json({ error }, { status })
  }
}
