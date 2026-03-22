import { sql } from "@vercel/postgres";

export { sql };

let scenarioEventsTableReady: Promise<void> | null = null;
let decisionPlansTableReady: Promise<void> | null = null;
let planOutcomesTableReady: Promise<void> | null = null;

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
