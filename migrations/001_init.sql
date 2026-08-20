-- Day 6 - Data Intelligence Stack
-- Minimum required tables only. Reuses whatever PostgreSQL instance this
-- service is pointed at. Does not touch Stack 3/4/5 tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reusable JSON skeleton / schema registry.
-- Future intelligence is added via INSERT, not code changes.
CREATE TABLE IF NOT EXISTS json_schemas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_key   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  name         TEXT,
  description  TEXT,
  schema       JSONB NOT NULL,
  source       TEXT NOT NULL DEFAULT 'system',
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schema_key, version)
);

CREATE INDEX IF NOT EXISTS idx_json_schemas_key_active
  ON json_schemas (schema_key, active);

-- Anomaly / event registry. No secrets, no raw credentials.
CREATE TABLE IF NOT EXISTS anomaly_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL,
  source             TEXT,
  operation          TEXT,
  status             TEXT,
  recovery_method    TEXT,
  schema_key         TEXT,
  request_id         UUID,
  parent_request_id  UUID,
  input_size         INTEGER,
  output_size        INTEGER,
  ai_fallback        BOOLEAN NOT NULL DEFAULT false,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_events_type ON anomaly_events (event_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_schema_key ON anomaly_events (schema_key);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_created_at ON anomaly_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_request_id ON anomaly_events (request_id);

-- Seed a small number of useful skeletons. Not exhaustive on purpose --
-- growth happens via INSERT INTO json_schemas, not application code.
INSERT INTO json_schemas (schema_key, version, name, description, schema, source)
VALUES
  ('generic_ai_response', 1, 'Generic AI Response',
   'Fallback skeleton for unclassified AI output',
   '{"content": "", "metadata": {}}'::jsonb, 'system'),

  ('chat_response', 1, 'Chat Response',
   'Standard chat completion shape',
   '{"role": "assistant", "content": "", "metadata": {}}'::jsonb, 'system'),

  ('image_prompt', 1, 'Image Generation Prompt',
   'Prompt payload for image generation workers',
   '{"title": "", "description": "", "prompt": "", "negative_prompt": "", "metadata": {}}'::jsonb, 'system'),

  ('extraction', 1, 'Extraction Result',
   'Structured extraction result',
   '{"fields": {}, "confidence": 0, "metadata": {}}'::jsonb, 'system'),

  ('classification', 1, 'Classification Result',
   'Intent/task classification result, mirrors Stack 5 contract',
   '{"intent": "", "task": "", "degraded": false, "metadata": {}}'::jsonb, 'system')

ON CONFLICT (schema_key, version) DO NOTHING;
