-- Add league rulebook fields to seasons table
ALTER TABLE "seasons"
  ADD COLUMN IF NOT EXISTS "minSquadSize"        INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "minStartingPlayers"  INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS "maxBenchPlayers"     INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "rules"               TEXT;
