ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_premium" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY,
  "inviter_user_id" text NOT NULL,
  "referred_user_id" text NOT NULL,
  "qualified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "qualified_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_user_unique"
  ON "referrals" ("referred_user_id");

CREATE INDEX IF NOT EXISTS "referrals_inviter_user_idx"
  ON "referrals" ("inviter_user_id");
