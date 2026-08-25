import { NextResponse } from "next/server"
import { getLiveDrops } from "@/app/actions/cases"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await getLiveDrops(), { headers: { "cache-control": "no-store" } })
}
