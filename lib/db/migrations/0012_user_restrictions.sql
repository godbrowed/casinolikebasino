ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "casino_blocked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "nft_withdrawals_blocked" boolean NOT NULL DEFAULT false;
