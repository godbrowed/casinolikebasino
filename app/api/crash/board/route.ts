import { NextResponse } from "next/server"
import { getCrashBoard } from "@/app/actions/crash"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await getCrashBoard(), { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "BOARD_TEMPORARILY_UNAVAILABLE" }, { status: 503 })
  }
}
