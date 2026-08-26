CREATE TABLE IF NOT EXISTS "giveaway_required_channels" (
  "id" serial PRIMARY KEY,
  "giveaway_id" integer NOT NULL REFERENCES "giveaways"("id") ON DELETE CASCADE,
  "channel_id" integer NOT NULL REFERENCES "giveaway_channels"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "giveaway_required_channels_unique"
  ON "giveaway_required_channels" ("giveaway_id", "channel_id");

CREATE INDEX IF NOT EXISTS "giveaway_required_channels_giveaway_idx"
  ON "giveaway_required_channels" ("giveaway_id");
