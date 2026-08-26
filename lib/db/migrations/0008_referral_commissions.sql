ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "program" text NOT NULL DEFAULT 'free-case';

CREATE TABLE IF NOT EXISTS "referral_commissions" (
  "id" serial PRIMARY KEY,
  "referral_id" integer NOT NULL REFERENCES "referrals"("id") ON DELETE CASCADE,
  "deposit_transaction_id" integer NOT NULL REFERENCES "transactions"("id") ON DELETE RESTRICT,
  "amount" numeric(20, 2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_commissions_deposit_unique"
  ON "referral_commissions" ("deposit_transaction_id");

CREATE INDEX IF NOT EXISTS "referral_commissions_referral_idx"
  ON "referral_commissions" ("referral_id", "created_at" DESC);
