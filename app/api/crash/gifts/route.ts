import { NextResponse } from "next/server"
import { getCrashGifts, getGiftImages } from "@/app/actions/crash"

export const dynamic = "force-dynamic"

export async function GET() {
  const [giftResult, imageResult] = await Promise.allSettled([getCrashGifts(), getGiftImages()])
  return NextResponse.json({
    gifts: giftResult.status === "fulfilled" ? giftResult.value : [],
    rewardImages: imageResult.status === "fulfilled" ? imageResult.value : [],
  }, { headers: { "cache-control": "no-store" } })
}
