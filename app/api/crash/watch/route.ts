import { NextResponse } from "next/server"
import { crashPointForRound } from "@/lib/crash-server"
import { CRASH_BETTING_MS, CRASH_ROUND_MS, elapsedForMultiplier, sharedRoundId, sharedRoundStart } from "@/lib/crash-shared"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * One lightweight long-poll per client and round. The response is held until
 * the secret server crash moment, so clients stop the animation on time
 * without learning the result early or polling the database every 100 ms.
 */
export async function GET(request: Request) {
  const requestedRound = Number(new URL(request.url).searchParams.get("roundId"))
  const now = Date.now()
  const currentRound = sharedRoundId(now)
  if (!Number.isSafeInteger(requestedRound) || requestedRound !== currentRound) {
    return NextResponse.json({ error: "ROUND_CHANGED" }, { status: 409 })
  }

  const multiplier = crashPointForRound(requestedRound)
  const crashAt = sharedRoundStart(now) + CRASH_BETTING_MS + elapsedForMultiplier(multiplier)
  const delay = Math.max(0, Math.min(CRASH_ROUND_MS, crashAt - Date.now()))

  if (delay > 0) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay)
      request.signal.addEventListener("abort", () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
    })
  }

  if (request.signal.aborted) return new Response(null, { status: 204 })
  return NextResponse.json(
    { roundId: requestedRound, multiplier },
    { headers: { "cache-control": "no-store" } },
  )
}
