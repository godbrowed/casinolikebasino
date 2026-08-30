import { NextRequest, NextResponse } from "next/server"
import { sellAll, sellGift, sellInventoryItems } from "@/app/actions/user"
import { requestGiftWithdraw } from "@/app/actions/gifts-transfer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; inventoryId?: number; inventoryIds?: number[] }
    if (body.action === "sell" && Number.isFinite(body.inventoryId)) {
      return NextResponse.json(await sellGift(Number(body.inventoryId)))
    }
    if (body.action === "sellAll") return NextResponse.json(await sellAll())
    if (body.action === "sellBatch" && Array.isArray(body.inventoryIds)) return NextResponse.json(await sellInventoryItems(body.inventoryIds))
    if (body.action === "withdraw" && Number.isFinite(body.inventoryId)) {
      return NextResponse.json(await requestGiftWithdraw(Number(body.inventoryId)))
    }
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "REQUEST_FAILED"
    const status = error === "Unauthorized" ? 401 : error === "ACCOUNT_BLOCKED" || error === "NFT_WITHDRAWALS_BLOCKED" ? 403 : error === "Item not found" ? 404 : 400
    return NextResponse.json({ error }, { status })
  }
}
