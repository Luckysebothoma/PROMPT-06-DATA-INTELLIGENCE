const express = require('express');
const { listEvents } = require('../lib/anomalies');

const router = express.Router();

router.get('/v1/events', async (req, res) => {
  const events = await listEvents({
    eventType: req.query.event_type,
    schemaKey: req.query.schema_key,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
    offset: req.query.offset ? parseInt(req.query.offset, 10) : 0
  });
  res.status(200).json({ success: true, events });
});

router.get('/v1/anomalies', async (req, res) => {
  const ANOMALY_TYPES = new Set([
    'malformed_json', 'unexpected_output', 'schema_mismatch', 'missing_required_field',
    'invalid_type', 'oversized_payload', 'chunking_required', 'deterministic_repair',
    'ai_recovery_required', 'ai_recovery_failed', 'validation_failed', 'provider_fallback',
    'unknown_structure'
  ]);
  const events = await listEvents({
    eventType: req.query.event_type,
    schemaKey: req.query.schema_key,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
    offset: req.query.offset ? parseInt(req.query.offset, 10) : 0
  });
  const anomalies = events.filter((e) => ANOMALY_TYPES.has(e.event_type) || e.event_type.startsWith('ai_recovery') || e.event_type.startsWith('validation'));
  res.status(200).json({ success: true, anomalies });
});

module.exports = router;
