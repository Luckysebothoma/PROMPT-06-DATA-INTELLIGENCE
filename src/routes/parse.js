const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { inspect } = require('../lib/inspector');
const { sanitize, attemptParse } = require('../lib/sanitizer');
const { errorEnvelope } = require('../envelope');

const router = express.Router();

router.post('/v1/parse', (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();
  const raw = body?.input?.data;

  if (raw === undefined) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data is required'));
  }

  if (typeof raw === 'object' && raw !== null) {
    return res.status(200).json({ success: true, request: { request_id: requestId }, data: raw });
  }

  const inspection = inspect(raw, { maxSize: body?.options?.max_size || 10000 });
  const { data: sanitized } = sanitize(raw);
  const parsed = attemptParse(sanitized);

  if (!parsed.ok) {
    return res.status(422).json({
      success: false,
      request: { request_id: requestId },
      inspection,
      error: { code: 'PARSE_FAILED', message: parsed.error }
    });
  }

  res.status(200).json({ success: true, request: { request_id: requestId }, inspection, data: parsed.value });
});

module.exports = router;
