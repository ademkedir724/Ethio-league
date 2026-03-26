-- League Model Refactor Migration
-- Idempotent: safe to run multiple times.
-- Introduces: leagues table, leagueId on seasons, leagueId on user_role_scopes,
--             renames referee_leagues → season_referees.

BEGIN;

-- ─── Step 1: Create leagues table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leagues (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID        NOT NULL,
  name             TEXT        NOT NULL,
  league_type_id   INT,
  gender_category  TEXT,
  age_category     TEXT,
  division_level   INT,
  logo_url         TEXT,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leagues_org_name_unique UNIQUE (organization_id, name),
  CONSTRAINT leagues_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT leagues_type_fk FOREIGN KEY (league_type_id) REFERENCES league_types(id)
);

-- ─── Step 2: Backfill leagues from existing seasons ───────────────────────────
-- For each unique (organization_id, league_name) in seasons, create a League.
-- Seasons with null/empty league_name get a "Default League".
INSERT INTO leagues (id, organization_id, name, league_type_id, gender_category, age_category, division_level)
SELECT
  gen_random_uuid(),
  s.organization_id,
  COALESCE(NULLIF(TRIM(s.league_name), ''), 'Default League') AS name,
  MAX(s.league_type_id),
  MAX(s.gender_category),
  MAX(s.age_category),
  MAX(s.division_level)
FROM seasons s
GROUP BY s.organization_id, COALESCE(NULLIF(TRIM(s.league_name), ''), 'Default League')
ON CONFLICT (organization_id, name) DO NOTHING;

-- ─── Step 3: Add league_id column to seasons (nullable first) ─────────────────
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;

-- ─── Step 4: Backfill league_id on seasons ────────────────────────────────────
UPDATE seasons s
SET league_id = l.id
FROM leagues l
WHERE l.organization_id = s.organization_id
  AND l.name = COALESCE(NULLIF(TRIM(s.league_name), ''), 'Default League')
  AND s.league_id IS NULL;

-- ─── Step 5: Make league_id NOT NULL ─────────────────────────────────────────
ALTER TABLE seasons ALTER COLUMN league_id SET NOT NULL;

-- ─── Step 6: Drop migrated columns from seasons ───────────────────────────────
ALTER TABLE seasons
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS league_name,
  DROP COLUMN IF EXISTS league_type_id,
  DROP COLUMN IF EXISTS gender_category,
  DROP COLUMN IF EXISTS age_category,
  DROP COLUMN IF EXISTS division_level;

-- ─── Step 7: Add league_id to user_role_scopes ────────────────────────────────
ALTER TABLE user_role_scopes ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id);

-- ─── Step 8: Backfill league_id for existing league_admin scopes ──────────────
-- Find the league via: user_role_scope.season_id → seasons.league_id
UPDATE user_role_scopes urs
SET league_id = s.league_id
FROM seasons s
JOIN roles r ON r.id = urs.role_id AND r.name = 'league_admin'
WHERE urs.season_id = s.id
  AND urs.league_id IS NULL;

-- ─── Step 9: Rename referee_leagues → season_referees ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referee_leagues') THEN
    ALTER TABLE referee_leagues RENAME TO season_referees;
  END IF;
END $$;

-- Rename constraint/index if they exist (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referee_leagues_referee_id_season_id_key') THEN
    ALTER TABLE season_referees RENAME CONSTRAINT referee_leagues_referee_id_season_id_key TO season_referees_referee_id_season_id_key;
  END IF;
END $$;

COMMIT;
