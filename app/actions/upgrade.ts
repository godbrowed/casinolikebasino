"use server"

import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { inventory, gifts, gameHistory } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { upgradeChance } from "@/lib/upgrade-shared"
import { giftValueInStars } from "@/lib/pricing"
import { assertFreeCaseGiftUnlocked, getFreeCaseClaimStatus } from "@/lib/free-case-referrals"

export async function getUpgradeTargets(): Promise<
  { id: number; name: string; rarity: string; imageUrl: string; value: number }[]
> {
  const rows = await db.select().from(gifts)
  return rows
    .map((g) => ({
      id: g.id,
      name: g.name,
      rarity: g.rarity,
      imageUrl: g.imageUrl,
      value: giftValueInStars(g.value, g.floorTon),
    }))
    .sort((a, b) => a.value - b.value)
}

export async function upgradeGift(
  inventoryIds: number[],
  targetGiftId: number,
): Promise<{
  success: boolean
  chance: number
  target: { id: number; name: string; rarity: string; imageUrl: string; value: number }
}> {
  const userId = await requireUserId()
  const claim = await getFreeCaseClaimStatus(userId)

  return db.transaction(async (tx) => {
    const uniqueIds = [...new Set(inventoryIds.map(Number))]
    if (!uniqueIds.length || uniqueIds.length > 20 || uniqueIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Choose valid gifts")
    const sources = await tx
        .select({
          id: inventory.id,
          value: inventory.value,
          floorTon: gifts.floorTon,
          source: inventory.source,
        })
        .from(inventory)
        .innerJoin(gifts, eq(inventory.giftId, gifts.id))
        .where(
          and(
            inArray(inventory.id, uniqueIds),
            eq(inventory.userId, userId),
            eq(inventory.status, "owned"),
          ),
        )
    if (sources.length !== uniqueIds.length) throw new Error("One of the gifts is no longer available")
    sources.forEach((src) => assertFreeCaseGiftUnlocked(src.source, claim.ready))

    const target = (await tx.select().from(gifts).where(eq(gifts.id, targetGiftId)).limit(1))[0]
    if (!target) throw new Error("Target not found")

    const targetValue = giftValueInStars(target.value, target.floorTon)
    const sourceValue = sources.reduce((sum, src) => sum + giftValueInStars(src.value, src.floorTon), 0)
    if (targetValue <= sourceValue) throw new Error("Target must be more valuable")

    const chance = upgradeChance(sourceValue, targetValue)
    const success = Math.random() < chance

    if (success) {
      await tx
        .update(inventory)
        .set({ giftId: target.id, value: String(targetValue), source: "upgrade" })
        .where(eq(inventory.id, uniqueIds[0]))
      if (uniqueIds.length > 1) await tx.update(inventory).set({ status: "lost" }).where(inArray(inventory.id, uniqueIds.slice(1)))
    } else {
      await tx.update(inventory).set({ status: "lost" }).where(inArray(inventory.id, uniqueIds))
    }

    await tx.insert(gameHistory).values({
      userId,
      game: "upgrade",
      bet: String(sourceValue),
      result: success ? String(targetValue) : "0",
      meta: { targetName: target.name, imageUrl: target.imageUrl, rarity: target.rarity, chance: Math.round(chance * 100), success, inventoryIds: uniqueIds, giftCount: uniqueIds.length },
    })

    revalidatePath("/profile")

    return {
      success,
      chance,
      target: {
        id: target.id,
        name: target.name,
        rarity: target.rarity,
        imageUrl: target.imageUrl,
        value: targetValue,
      },
    }
  })
}
