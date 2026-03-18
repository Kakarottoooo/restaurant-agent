-- Folio. database schema
-- Run this once after provisioning your Vercel Postgres / Neon database

-- User preference profiles (replaces localStorage)
CREATE TABLE IF NOT EXISTS preference_profiles (
  user_id       TEXT PRIMARY KEY,   -- Clerk userId
  profile_json  JSONB NOT NULL,     -- UserPreferenceProfile
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Saved restaurants (favorites)
CREATE TABLE IF NOT EXISTS favorites (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  card_json     JSONB NOT NULL,     -- RecommendationCard snapshot
  saved_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- User feedback records
CREATE TABLE IF NOT EXISTS feedback (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  restaurant_id   TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  query           TEXT,
  satisfied       BOOLEAN NOT NULL,
  issues          TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
