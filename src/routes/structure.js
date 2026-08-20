const express = require('express');
const { v4: uuidv4 } = require('uuid');
const recoveryLadder = require('../lib/recoveryLadder');
const { errorEnvelope } = require('../envelope');

const router = express.Router();

router.post('/v1/structure', async (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();

  if (body?.input?.data === undefined) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data is required'));
  }

  const envelopeInput = {
    version: body.version || '1.0',
    request: {
      request_id: requestId,
      session_id: body?.request?.session_id || null,
      parent_request_id: body?.request?.parent_request_id || null
    },
    source: body.source || { stack: 'unknown', operation: 'structure' },
    input: body.input,
    schema: body.schema || { key: null, version: null },
    options: body.options || {}
  };

  try {
    const result = await recoveryLadder.run(envelopeInput);
    res.status(result.success ? 200 : 422).json(result);
  } catch (err) {
    res.status(500).json(errorEnvelope(requestId, 'INTERNAL_ERROR', err.message));
  }
});

module.exports = router;
