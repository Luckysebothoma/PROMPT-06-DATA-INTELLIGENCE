const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { inspect } = require('../lib/inspector');
const { sanitize, attemptParse } = require('../lib/sanitizer');
const { errorEnvelope } = require('../envelope');

const router = express.Router();

router.post('/v1/sanitize', (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();
  const raw = body?.input?.data;

  if (raw === undefined) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data is required'));
  }

  const inspection = inspect(raw, { maxSize: body?.options?.max_size || 10000 });
  const { data: sanitized, applied } = sanitize(raw);
  const parsed = typeof raw === 'object' ? { ok: true, value: raw } : attemptParse(sanitized);

  res.status(200).json({
    success: true,
    request: { request_id: requestId },
    inspection,
    sanitized_string: typeof raw === 'string' ? sanitized : null,
    applied,
    parsed: parsed.ok ? parsed.value : null,
    parse_error: parsed.ok ? null : parsed.error
  });
});

module.exports = router;
