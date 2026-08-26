ALTER TABLE "giveaways"
  ADD COLUMN IF NOT EXISTS "inventory_ids" jsonb;
