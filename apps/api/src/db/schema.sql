-- Tracer schema — runs once on server startup via migrate.ts

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  api_key         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  openai_key_enc  TEXT,   -- AES-256-GCM encrypted, nullable — BYOK
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  message     TEXT NOT NULL,
  error_type  TEXT NOT NULL DEFAULT 'Error',
  stack_trace TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  count       INTEGER NOT NULL DEFAULT 1,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB,
  UNIQUE (project_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS error_occurrences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id   UUID NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  url        TEXT,
  user_agent TEXT,
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata   JSONB
);

CREATE INDEX IF NOT EXISTS idx_errors_project_id    ON errors(project_id);
CREATE INDEX IF NOT EXISTS idx_errors_fingerprint   ON errors(project_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_errors_last_seen     ON errors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_errors_status        ON errors(project_id, status);
CREATE INDEX IF NOT EXISTS idx_occurrences_error_id ON error_occurrences(error_id);
