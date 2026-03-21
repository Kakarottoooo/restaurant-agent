import { sql } from "@vercel/postgres";

export { sql };

let scenarioEventsTableReady: Promise<void> | null = null;

/**
 * Initialize the database tables if they don't exist.
 * Call once on first deploy or via a setup script.
 */
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS preference_profiles (
      user_id       TEXT PRIMARY KEY,
      profile_json  JSONB NOT NULL,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS favorites (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      card_json     JSONB NOT NULL,
      saved_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, restaurant_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      restaurant_id   TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      query           TEXT,
      satisfied       BOOLEAN NOT NULL,
      issues          TEXT[],
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await ensureScenarioEventsTable();
}

export async function ensureScenarioEventsTable() {
  if (!scenarioEventsTableReady) {
    scenarioEventsTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS scenario_events (
          id            SERIAL PRIMARY KEY,
          user_id       TEXT,
          session_id    TEXT NOT NULL,
          scenario      TEXT NOT NULL,
          plan_id       TEXT NOT NULL,
          event_type    TEXT NOT NULL,
          option_id     TEXT,
          action_id     TEXT,
          request_id    TEXT,
          query_text    TEXT,
          metadata_json JSONB,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;
    })();
  }

  await scenarioEventsTableReady;
}
