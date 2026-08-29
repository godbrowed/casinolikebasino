-- Earlier giveaway forms silently used 100 tickets per player. The creator now
-- controls this value explicitly; lift existing active paid draws so they are
-- immediately usable with the new purchase control as well.
UPDATE "giveaways"
SET "max_tickets_per_user" = 100000
WHERE "status" = 'active'
  AND "ticket_price" > 0
  AND "max_tickets_per_user" <= 100;
