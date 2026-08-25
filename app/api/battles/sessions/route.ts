import { NextResponse } from "next/server"
import { getBattleSessions } from "@/app/actions/battles"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await getBattleSessions(), { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json([], { headers: { "cache-control": "no-store" } })
  }
}
