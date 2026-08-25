-- Stake-based PvP rooms have no case. Keeping case_id nullable preserves the
-- foreign key for legacy case rooms without relying on an invalid sentinel 0.
ALTER TABLE "battle_rooms" ALTER COLUMN "case_id" DROP NOT NULL;
