-- Migration: Squad Request Workflow
-- Adds clubId (origin marker) to players and coaches,
-- adds requestStatus + playerRole to season_club_players,
-- adds requestStatus to season_club_coaches.

-- 1. Add origin club to players (nullable — existing rows stay null)
ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- 2. Add origin club to coaches (nullable)
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- 3. Add requestStatus to season_club_players (default 'approved' for backward compat)
ALTER TABLE season_club_players ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'approved';

-- 4. Add playerRole to season_club_players (nullable — set by Club Admin at request time)
ALTER TABLE season_club_players ADD COLUMN IF NOT EXISTS player_role TEXT;

-- 5. Add requestStatus to season_club_coaches (default 'approved' for backward compat)
ALTER TABLE season_club_coaches ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'approved';
