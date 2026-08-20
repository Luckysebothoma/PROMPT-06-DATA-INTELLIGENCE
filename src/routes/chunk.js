const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { chunkIfNeeded } = require('../lib/chunker');
const { errorEnvelope } = require('../envelope');

const router = express.Router();

router.post('/v1/chunk', (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();
  const data = body?.input?.data;
  const maxSize = body?.options?.max_size || parseInt(process.env.DEFAULT_MAX_PAYLOAD_SIZE || '10000', 10);

  if (data === undefined) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data is required'));
  }

  const chunking = chunkIfNeeded(data, maxSize, requestId);
  res.status(200).json({ success: true, request: { request_id: requestId }, chunking });
});

module.exports = router;
