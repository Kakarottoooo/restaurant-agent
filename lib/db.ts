import { sql } from "@vercel/postgres";

export { sql };

let scenarioEventsTableReady: Promise<void> | null = null;
let decisionPlansTableReady: Promise<void> | null = null;
let planOutcomesTableReady: Promise<void> | null = null;
let feedbackPromptsTableReady: Promise<void> | null = null;
let planVotesTableReady: Promise<void> | null = null;
let priceWatchesTableReady: Promise<void> | null = null;
let userPreferencesTableReady: Promise<void> | null = null;

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
  await ensureDecisionPlansTable();
  await ensurePlanOutcomesTable();
  await ensureFeedbackPromptsTable();
  await ensurePlanVotesTable();
  await ensurePriceWatchesTable();
  await ensureUserPreferencesTable();
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
    })().catch((err) => {
      scenarioEventsTableReady = null;
      throw err;
    });
  }

  await scenarioEventsTableReady;
}

export async function ensureDecisionPlansTable() {
  if (!decisionPlansTableReady) {
    decisionPlansTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS decision_plans (
          id          TEXT PRIMARY KEY,
          session_id  TEXT NOT NULL,
          user_id     TEXT,
          scenario    TEXT NOT NULL,
          query_text  TEXT,
          plan_json   JSONB NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS decision_plans_session_idx ON decision_plans (session_id)`;
      await sql`CREATE INDEX IF NOT EXISTS decision_plans_user_idx ON decision_plans (user_id) WHERE user_id IS NOT NULL`;
      // Migration: add parent_plan_id for refinement lineage tracking
      await sql`ALTER TABLE decision_plans ADD COLUMN IF NOT EXISTS parent_plan_id TEXT`;
    })().catch((err) => {
      decisionPlansTableReady = null;
      throw err;
    });
  }

  await decisionPlansTableReady;
}

export async function ensurePlanOutcomesTable() {
  if (!planOutcomesTableReady) {
    planOutcomesTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS plan_outcomes (
          id            BIGSERIAL PRIMARY KEY,
          plan_id       TEXT NOT NULL,
          session_id    TEXT,
          user_id       TEXT,
          outcome_type  TEXT NOT NULL,
          option_id     TEXT,
          metadata      JSONB,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS plan_outcomes_plan_idx ON plan_outcomes (plan_id)`;
    })().catch((err) => {
      planOutcomesTableReady = null;
      throw err;
    });
  }

  await planOutcomesTableReady;
}

export async function ensureFeedbackPromptsTable() {
  if (!feedbackPromptsTableReady) {
    feedbackPromptsTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS feedback_prompts (
          id            BIGSERIAL PRIMARY KEY,
          plan_id       TEXT NOT NULL,
          user_session  TEXT NOT NULL,
          scheduled_for TIMESTAMPTZ NOT NULL,
          sent_at       TIMESTAMPTZ,
          responded_at  TIMESTAMPTZ,
          response_json JSONB,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS feedback_prompts_plan_idx ON feedback_prompts (plan_id)`;
      await sql`CREATE INDEX IF NOT EXISTS feedback_prompts_session_idx ON feedback_prompts (user_session)`;
    })().catch((err) => {
      feedbackPromptsTableReady = null;
      throw err;
    });
  }

  await feedbackPromptsTableReady;
}

export async function ensurePlanVotesTable() {
  if (!planVotesTableReady) {
    planVotesTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS plan_votes (
          id            BIGSERIAL PRIMARY KEY,
          plan_id       TEXT NOT NULL,
          voter_session TEXT NOT NULL,
          option_id     TEXT NOT NULL,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS plan_votes_plan_idx ON plan_votes (plan_id)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS plan_votes_voter_idx ON plan_votes (plan_id, voter_session)`;
    })().catch((err) => {
      planVotesTableReady = null;
      throw err;
    });
  }
  await planVotesTableReady;
}

export async function ensurePriceWatchesTable() {
  if (!priceWatchesTableReady) {
    priceWatchesTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS price_watches (
          id                BIGSERIAL PRIMARY KEY,
          plan_id           TEXT NOT NULL,
          session_id        TEXT NOT NULL,
          item_type         TEXT NOT NULL,
          item_key          TEXT NOT NULL,
          item_label        TEXT NOT NULL,
          last_known_price  NUMERIC(10,2) NOT NULL,
          threshold_pct     NUMERIC(5,2) NOT NULL DEFAULT 10,
          search_params     JSONB,
          created_at        TIMESTAMPTZ DEFAULT NOW(),
          last_checked_at   TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS price_watches_plan_idx ON price_watches (plan_id)`;
      await sql`CREATE INDEX IF NOT EXISTS price_watches_session_idx ON price_watches (session_id)`;
    })().catch((err) => {
      priceWatchesTableReady = null;
      throw err;
    });
  }
  await priceWatchesTableReady;
}

export async function ensureUserPreferencesTable() {
  if (!userPreferencesTableReady) {
    userPreferencesTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id               BIGSERIAL PRIMARY KEY,
          session_id       TEXT NOT NULL,
          preference_key   TEXT NOT NULL,
          preference_value TEXT NOT NULL,
          confidence       FLOAT DEFAULT 1.0,
          updated_at       TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (session_id, preference_key)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS user_prefs_session_idx ON user_preferences (session_id)`;
    })().catch((err) => {
      userPreferencesTableReady = null;
      throw err;
    });
  }
  await userPreferencesTableReady;
}

export async function upsertUserPreference(
  sessionId: string,
  key: string,
  value: string,
  confidence = 1.0
): Promise<void> {
  await ensureUserPreferencesTable();
  await sql`
    INSERT INTO user_preferences (session_id, preference_key, preference_value, confidence, updated_at)
    VALUES (${sessionId}, ${key}, ${value}, ${confidence}, NOW())
    ON CONFLICT (session_id, preference_key)
    DO UPDATE SET preference_value = EXCLUDED.preference_value,
                  confidence = EXCLUDED.confidence,
                  updated_at = NOW()
  `;
}

export async function getUserPreferences(sessionId: string): Promise<Record<string, string>> {
  await ensureUserPreferencesTable();
  const result = await sql<{ preference_key: string; preference_value: string }>`
    SELECT preference_key, preference_value
    FROM user_preferences
    WHERE session_id = ${sessionId}
  `;
  const prefs: Record<string, string> = {};
  for (const row of result.rows) {
    prefs[row.preference_key] = row.preference_value;
  }
  return prefs;
}
