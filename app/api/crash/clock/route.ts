import { NextResponse } from "next/server"
import { getPublicCrashClock } from "@/lib/crash-server"

export const dynamic = "force-dynamic"

// Clock synchronization must not wait for database reads, user sessions or
// notifications. Money is still settled exclusively by authenticated actions.
export function GET() {
  return NextResponse.json(getPublicCrashClock(), {
    headers: { "cache-control": "no-store, max-age=0" },
  })
}
