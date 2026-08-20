const { pool } = require('../db');
const { anomaliesTotal } = require('../metrics');

// Never store secrets, credentials, or raw private content beyond size/
// classification. `metadata` should stay small and non-sensitive.
async function recordEvent({
  eventType,
  source = 'stack6',
  operation = null,
  status = null,
  recoveryMethod = null,
  schemaKey = null,
  requestId = null,
  parentRequestId = null,
  inputSize = null,
  outputSize = null,
  aiFallback = false,
  metadata = {}
}) {
  anomaliesTotal.labels(eventType).inc();

  try {
    const { rows } = await pool.query(
      `INSERT INTO anomaly_events
        (event_type, source, operation, status, recovery_method, schema_key,
         request_id, parent_request_id, input_size, output_size, ai_fallback, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        eventType, source, operation, status, recoveryMethod, schemaKey,
        requestId || null, parentRequestId || null, inputSize, outputSize,
        aiFallback, JSON.stringify(metadata || {})
      ]
    );
    return rows[0].id;
  } catch (err) {
    // Never let telemetry failures break the recovery pipeline.
    // eslint-disable-next-line no-console
    console.error('[anomalies] failed to record event', err.message);
    return null;
  }
}

async function listEvents({ eventType, schemaKey, limit = 50, offset = 0 } = {}) {
  const clauses = [];
  const params = [];
  if (eventType) {
    params.push(eventType);
    clauses.push(`event_type = $${params.length}`);
  }
  if (schemaKey) {
    params.push(schemaKey);
    clauses.push(`schema_key = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));
  params.push(offset);
  const { rows } = await pool.query(
    `SELECT * FROM anomaly_events ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

module.exports = { recordEvent, listEvents };
