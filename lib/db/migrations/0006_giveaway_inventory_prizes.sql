ALTER TABLE "giveaways"
  ADD COLUMN IF NOT EXISTS "inventory_id" integer REFERENCES "inventory"("id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS "giveaways_active_inventory_unique"
  ON "giveaways" ("inventory_id")
  WHERE "inventory_id" IS NOT NULL AND "status" IN ('draft', 'active');
