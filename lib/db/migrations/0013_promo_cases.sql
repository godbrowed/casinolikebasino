INSERT INTO "cases" ("slug", "name", "cover_url", "price", "accent", "sort_order", "is_free")
VALUES
  ('pug-pocket', 'Pug Pocket', '/cases/starter.png', 199, 'cyan', 12, false),
  ('pug-club', 'Pug Club', '/cases/lucky.png', 250, 'blue', 14, false)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "cover_url" = EXCLUDED."cover_url",
  "price" = EXCLUDED."price",
  "accent" = EXCLUDED."accent",
  "sort_order" = EXCLUDED."sort_order";

WITH selected_gifts AS (
  SELECT "id"
  FROM "gifts"
  WHERE "value" > 0
  ORDER BY "value" DESC
  LIMIT 4
)
INSERT INTO "case_items" ("case_id", "gift_id", "weight")
SELECT c."id", g."id", 1
FROM "cases" c
CROSS JOIN selected_gifts g
WHERE c."slug" IN ('pug-pocket', 'pug-club')
  AND NOT EXISTS (
    SELECT 1 FROM "case_items" existing WHERE existing."case_id" = c."id"
  );
