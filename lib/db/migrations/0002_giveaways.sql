CREATE TABLE IF NOT EXISTS "giveaway_channels" (
  "id" serial PRIMARY KEY,
  "owner_user_id" text NOT NULL,
  "chat_id" text NOT NULL,
  "username" text,
  "title" text NOT NULL,
  "bot_status" text NOT NULL DEFAULT 'administrator',
  "can_post_messages" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "giveaway_channels_chat_id_unique"
  ON "giveaway_channels" ("chat_id");
CREATE INDEX IF NOT EXISTS "giveaway_channels_owner_idx"
  ON "giveaway_channels" ("owner_user_id", "active");

CREATE TABLE IF NOT EXISTS "giveaways" (
  "id" serial PRIMARY KEY,
  "owner_user_id" text NOT NULL,
  "channel_id" integer NOT NULL REFERENCES "giveaway_channels"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "prize_text" text NOT NULL,
  "ticket_price" numeric(20, 2) NOT NULL DEFAULT 0,
  "winner_count" integer NOT NULL DEFAULT 1,
  "max_tickets_per_user" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "ends_at" timestamptz NOT NULL,
  "post_message_id" integer,
  "participant_count" integer NOT NULL DEFAULT 0,
  "ticket_count" integer NOT NULL DEFAULT 0,
  "pot" numeric(20, 2) NOT NULL DEFAULT 0,
  "winner_user_ids" jsonb,
  "settled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "giveaways_owner_idx" ON "giveaways" ("owner_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "giveaways_due_idx" ON "giveaways" ("status", "ends_at");

CREATE TABLE IF NOT EXISTS "giveaway_entries" (
  "id" serial PRIMARY KEY,
  "giveaway_id" integer NOT NULL REFERENCES "giveaways"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tickets" integer NOT NULL DEFAULT 1,
  "amount" numeric(20, 2) NOT NULL DEFAULT 0,
  "joined_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "giveaway_entries_giveaway_user_unique"
  ON "giveaway_entries" ("giveaway_id", "user_id");
CREATE INDEX IF NOT EXISTS "giveaway_entries_giveaway_idx" ON "giveaway_entries" ("giveaway_id");
