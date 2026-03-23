import { sql } from "@vercel/postgres";

export { sql };

let scenarioEventsTableReady: Promise<void> | null = null;
let decisionPlansTableReady: Promise<void> | null = null;
let planOutcomesTableReady: Promise<void> | null = null;
let feedbackPromptsTableReady: Promise<void> | null = null;
let planVotesTableReady: Promise<void> | null = null;
let priceWatchesTableReady: Promise<void> | null = null;
let userPreferencesTableReady: Promise<void> | null = null;
let userNotificationsTableReady: Promise<void> | null = null;

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
  await ensureUserNotificationsTable();
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
      // Prevent duplicate prompts from concurrent cron runs
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS feedback_prompts_plan_unique_idx ON feedback_prompts (plan_id)`;
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
      // 4b-2 migrations: user_id column + per-user unique index
      await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_id TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS user_prefs_user_idx ON user_preferences (user_id) WHERE user_id IS NOT NULL`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_prefs_user_key_idx ON user_preferences (user_id, preference_key) WHERE user_id IS NOT NULL`;
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
  confidence = 1.0,
  userId?: string
): Promise<void> {
  await ensureUserPreferencesTable();
  if (userId) {
    await sql`
      INSERT INTO user_preferences (session_id, user_id, preference_key, preference_value, confidence, updated_at)
      VALUES (${sessionId}, ${userId}, ${key}, ${value}, ${confidence}, NOW())
      ON CONFLICT (user_id, preference_key) WHERE user_id IS NOT NULL
      DO UPDATE SET preference_value = EXCLUDED.preference_value,
                    confidence = EXCLUDED.confidence,
                    session_id = EXCLUDED.session_id,
                    updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO user_preferences (session_id, preference_key, preference_value, confidence, updated_at)
      VALUES (${sessionId}, ${key}, ${value}, ${confidence}, NOW())
      ON CONFLICT (session_id, preference_key)
      DO UPDATE SET preference_value = EXCLUDED.preference_value,
                    confidence = EXCLUDED.confidence,
                    updated_at = NOW()
    `;
  }
}

export async function getUserPreferences(
  sessionId: string,
  userId?: string
): Promise<Record<string, string>> {
  await ensureUserPreferencesTable();
  const result = userId
    ? await sql<{ preference_key: string; preference_value: string }>`
        SELECT preference_key, preference_value
        FROM user_preferences
        WHERE user_id = ${userId}
      `
    : await sql<{ preference_key: string; preference_value: string }>`
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

export interface PushSubscriptionRecord {
  id: number;
  session_id: string;
  user_id: string | null;
  push_endpoint: string;
  push_subscription: object;
}

export async function ensureUserNotificationsTable() {
  if (!userNotificationsTableReady) {
    userNotificationsTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id                  BIGSERIAL PRIMARY KEY,
          session_id          TEXT NOT NULL,
          user_id             TEXT,
          push_endpoint       TEXT NOT NULL,
          push_subscription   JSONB NOT NULL,
          notification_email  TEXT,
          created_at          TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (push_endpoint)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS user_notifs_session_idx ON user_notifications (session_id)`;
      await sql`CREATE INDEX IF NOT EXISTS user_notifs_user_idx ON user_notifications (user_id) WHERE user_id IS NOT NULL`;
    })().catch((err) => {
      userNotificationsTableReady = null;
      throw err;
    });
  }
  await userNotificationsTableReady;
}

export async function upsertPushSubscription(
  sessionId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userId?: string
): Promise<void> {
  await ensureUserNotificationsTable();
  await sql`
    INSERT INTO user_notifications (session_id, user_id, push_endpoint, push_subscription)
    VALUES (${sessionId}, ${userId ?? null}, ${subscription.endpoint}, ${JSON.stringify(subscription)})
    ON CONFLICT (push_endpoint)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      user_id = COALESCE(EXCLUDED.user_id, user_notifications.user_id),
      push_subscription = EXCLUDED.push_subscription
  `;
}

export async function getPushSubscriptionsBySession(
  sessionId: string
): Promise<PushSubscriptionRecord[]> {
  await ensureUserNotificationsTable();
  const result = await sql<PushSubscriptionRecord>`
    SELECT id, session_id, user_id, push_endpoint, push_subscription
    FROM user_notifications
    WHERE session_id = ${sessionId}
  `;
  return result.rows;
}

export async function getAllPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  await ensureUserNotificationsTable();
  const result = await sql<PushSubscriptionRecord>`
    SELECT id, session_id, user_id, push_endpoint, push_subscription
    FROM user_notifications
    ORDER BY created_at DESC
  `;
  return result.rows;
}

// ─── Phase 4 (Decision Room): Shared Decision Sessions ───────────────────────

let decisionSessionsTableReady: Promise<void> | null = null;

export async function ensureDecisionSessionsTable(): Promise<void> {
  if (!decisionSessionsTableReady) {
    decisionSessionsTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS decision_sessions (
          id                    TEXT PRIMARY KEY,
          initiator_user_id     TEXT,
          partner_session_token TEXT NOT NULL,
          initiator_constraints TEXT NOT NULL,
          partner_constraints   TEXT,
          conflict              BOOLEAN NOT NULL DEFAULT FALSE,
          conflict_reason       TEXT,
          merged_options        JSONB,
          initiator_vote        JSONB NOT NULL DEFAULT '[]',
          partner_vote          JSONB NOT NULL DEFAULT '[]',
          status                TEXT NOT NULL DEFAULT 'waiting_partner',
          decided_card_id       TEXT,
          feedback_initiator    TEXT,
          feedback_partner      TEXT,
          party_size            INT NOT NULL DEFAULT 2,
          decision_type         TEXT NOT NULL DEFAULT 'dinner_tonight',
          city_id               TEXT NOT NULL DEFAULT 'los-angeles',
          created_at            TIMESTAMPTZ DEFAULT NOW(),
          expires_at            TIMESTAMPTZ NOT NULL,
          deleted_at            TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS decision_sessions_initiator_idx ON decision_sessions (initiator_user_id) WHERE initiator_user_id IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS decision_sessions_expires_idx ON decision_sessions (expires_at)`;
    })().catch((err) => {
      decisionSessionsTableReady = null;
      throw err;
    });
  }
  await decisionSessionsTableReady;
}

export interface DecisionSession {
  id: string;
  initiator_user_id: string | null;
  partner_session_token: string;
  initiator_constraints: string;
  partner_constraints: string | null;
  conflict: boolean;
  conflict_reason: string | null;
  merged_options: unknown[] | null;
  initiator_vote: { card_id: string; approved: boolean }[];
  partner_vote: { card_id: string; approved: boolean }[];
  status: "waiting_partner" | "voting" | "decided" | "conflict" | "expired";
  decided_card_id: string | null;
  feedback_initiator: "loved" | "fine" | "never" | null;
  feedback_partner: "loved" | "fine" | "never" | null;
  party_size: number;
  decision_type: string;
  city_id: string;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export async function createDecisionSession(params: {
  id: string;
  initiatorUserId: string | null;
  partnerSessionToken: string;
  initiatorConstraints: string;
  cityId: string;
  decisionType?: string;
}): Promise<DecisionSession> {
  await ensureDecisionSessionsTable();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result = await sql<DecisionSession>`
    INSERT INTO decision_sessions
      (id, initiator_user_id, partner_session_token, initiator_constraints, city_id, decision_type, expires_at)
    VALUES
      (${params.id}, ${params.initiatorUserId}, ${params.partnerSessionToken},
       ${params.initiatorConstraints}, ${params.cityId}, ${params.decisionType ?? "dinner_tonight"}, ${expiresAt})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getDecisionSession(id: string): Promise<DecisionSession | null> {
  await ensureDecisionSessionsTable();
  const result = await sql<DecisionSession>`
    SELECT * FROM decision_sessions WHERE id = ${id} AND deleted_at IS NULL
  `;
  return result.rows[0] ?? null;
}

export async function updateDecisionSession(
  id: string,
  updates: Partial<{
    partner_constraints: string;
    conflict: boolean;
    conflict_reason: string;
    merged_options: unknown[];
    initiator_vote: { card_id: string; approved: boolean }[];
    partner_vote: { card_id: string; approved: boolean }[];
    status: string;
    decided_card_id: string;
    feedback_initiator: string;
    feedback_partner: string;
  }>
): Promise<DecisionSession | null> {
  await ensureDecisionSessionsTable();
  const existing = await sql<DecisionSession>`SELECT * FROM decision_sessions WHERE id = ${id} AND deleted_at IS NULL`;
  if (!existing.rows[0]) return null;

  if (updates.partner_constraints !== undefined)
    await sql`UPDATE decision_sessions SET partner_constraints = ${updates.partner_constraints} WHERE id = ${id}`;
  if (updates.conflict !== undefined)
    await sql`UPDATE decision_sessions SET conflict = ${updates.conflict} WHERE id = ${id}`;
  if (updates.conflict_reason !== undefined)
    await sql`UPDATE decision_sessions SET conflict_reason = ${updates.conflict_reason} WHERE id = ${id}`;
  if (updates.merged_options !== undefined)
    await sql`UPDATE decision_sessions SET merged_options = ${JSON.stringify(updates.merged_options)} WHERE id = ${id}`;
  if (updates.initiator_vote !== undefined)
    await sql`UPDATE decision_sessions SET initiator_vote = ${JSON.stringify(updates.initiator_vote)} WHERE id = ${id}`;
  if (updates.partner_vote !== undefined)
    await sql`UPDATE decision_sessions SET partner_vote = ${JSON.stringify(updates.partner_vote)} WHERE id = ${id}`;
  if (updates.status !== undefined)
    await sql`UPDATE decision_sessions SET status = ${updates.status} WHERE id = ${id}`;
  if (updates.decided_card_id !== undefined)
    await sql`UPDATE decision_sessions SET decided_card_id = ${updates.decided_card_id} WHERE id = ${id}`;
  if (updates.feedback_initiator !== undefined)
    await sql`UPDATE decision_sessions SET feedback_initiator = ${updates.feedback_initiator} WHERE id = ${id}`;
  if (updates.feedback_partner !== undefined)
    await sql`UPDATE decision_sessions SET feedback_partner = ${updates.feedback_partner} WHERE id = ${id}`;

  const result = await sql<DecisionSession>`SELECT * FROM decision_sessions WHERE id = ${id}`;
  return result.rows[0] ?? null;
}

// ─── G-4: Venue quality degradation tracking ──────────────────────────────────

let venueBaselinesTableReady: Promise<void> | null = null;

export async function ensureVenueBaselinesTable(): Promise<void> {
  if (!venueBaselinesTableReady) {
    venueBaselinesTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS venue_baselines (
          id SERIAL PRIMARY KEY,
          plan_id TEXT NOT NULL,
          venue_id TEXT NOT NULL,
          venue_name TEXT NOT NULL,
          baseline_rating FLOAT NOT NULL,
          baseline_review_count INT NOT NULL,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS venue_baselines_plan_idx ON venue_baselines (plan_id)`;
    })().catch((err) => {
      venueBaselinesTableReady = null;
      throw err;
    });
  }
  await venueBaselinesTableReady;
}

export async function recordVenueBaseline(
  planId: string,
  venueId: string,
  venueName: string,
  rating: number,
  reviewCount: number
): Promise<void> {
  await ensureVenueBaselinesTable();
  await sql`
    INSERT INTO venue_baselines (plan_id, venue_id, venue_name, baseline_rating, baseline_review_count)
    VALUES (${planId}, ${venueId}, ${venueName}, ${rating}, ${reviewCount})
    ON CONFLICT DO NOTHING
  `;
}

/** On Clerk sign-in: copy all session-keyed prefs to the user account (idempotent). */
export async function mergeSessionPreferences(
  sessionId: string,
  userId: string
): Promise<void> {
  await ensureUserPreferencesTable();
  // Stamp user_id on session rows ONLY where no user-keyed pref already exists for that key.
  // Skipping keys the user already has prevents unique constraint violations.
  await sql`
    UPDATE user_preferences
    SET user_id = ${userId}
    WHERE session_id = ${sessionId}
      AND user_id IS NULL
      AND preference_key NOT IN (
        SELECT preference_key FROM user_preferences WHERE user_id = ${userId}
      )
  `;
}
