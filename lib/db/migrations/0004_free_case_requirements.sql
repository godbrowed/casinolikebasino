CREATE TABLE IF NOT EXISTS "free_case_progress" (
  "user_id" text PRIMARY KEY,
  "share_count" integer NOT NULL DEFAULT 0,
  "trade_visited_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
