"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { inventory, gifts, gameHistory } from "@/lib/db/schema"
import { requireUserId } from "@/lib/session"
import { upgradeChance } from "@/lib/upgrade-shared"
import { giftValueInStars } from "@/lib/pricing"

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
  inventoryId: number,
  targetGiftId: number,
): Promise<{
  success: boolean
  chance: number
  target: { id: number; name: string; rarity: string; imageUrl: string; value: number }
}> {
  const userId = await requireUserId()

  return db.transaction(async (tx) => {
    const src = (
      await tx
        .select({
          id: inventory.id,
          value: inventory.value,
          floorTon: gifts.floorTon,
        })
        .from(inventory)
        .innerJoin(gifts, eq(inventory.giftId, gifts.id))
        .where(
          and(
            eq(inventory.id, inventoryId),
            eq(inventory.userId, userId),
            eq(inventory.status, "owned"),
          ),
        )
        .limit(1)
    )[0]
    if (!src) throw new Error("Item not found")

    const target = (await tx.select().from(gifts).where(eq(gifts.id, targetGiftId)).limit(1))[0]
    if (!target) throw new Error("Target not found")

    const targetValue = giftValueInStars(target.value, target.floorTon)
    const sourceValue = giftValueInStars(src.value, src.floorTon)
    if (targetValue <= sourceValue) throw new Error("Target must be more valuable")

    const chance = upgradeChance(sourceValue, targetValue)
    const success = Math.random() < chance

    if (success) {
      await tx
        .update(inventory)
        .set({ giftId: target.id, value: String(targetValue), source: "upgrade" })
        .where(eq(inventory.id, inventoryId))
    } else {
      await tx.update(inventory).set({ status: "lost" }).where(eq(inventory.id, inventoryId))
    }

    await tx.insert(gameHistory).values({
      userId,
      game: "upgrade",
      bet: String(sourceValue),
      result: success ? String(targetValue) : "0",
      meta: { targetName: target.name, imageUrl: target.imageUrl, rarity: target.rarity, chance: Math.round(chance * 100), success },
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
