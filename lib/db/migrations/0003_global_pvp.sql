-- Move stake ownership from the room to each participant. Before switching the
-- matchmaking model, refund every legacy waiting stake so no balance remains
-- locked in rooms that the new global queue will never consume.
ALTER TABLE "battle_slots"
  ADD COLUMN IF NOT EXISTS "stake" numeric(20, 2) NOT NULL DEFAULT '0';

WITH refunds AS (
  SELECT slots."user_id", SUM(rooms."entry_cost") AS amount
  FROM "battle_slots" slots
  INNER JOIN "battle_rooms" rooms ON rooms."id" = slots."room_id"
  WHERE rooms."status" = 'waiting'
    AND rooms."case_id" IS NULL
    AND slots."is_bot" = false
    AND slots."user_id" IS NOT NULL
  GROUP BY slots."user_id"
)
UPDATE "users" users
SET "balance" = users."balance" + refunds.amount
FROM refunds
WHERE users."id" = refunds."user_id";

DELETE FROM "battle_slots"
WHERE "room_id" IN (
  SELECT "id" FROM "battle_rooms"
  WHERE "status" = 'waiting' AND "case_id" IS NULL
);

DELETE FROM "battle_rooms"
WHERE "status" = 'waiting' AND "case_id" IS NULL;

