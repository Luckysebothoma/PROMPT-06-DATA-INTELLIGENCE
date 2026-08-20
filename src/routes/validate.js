const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateAgainstSkeleton } = require('../lib/reconstructor');
const { getActiveSchema } = require('../lib/schemaRegistry');
const { errorEnvelope } = require('../envelope');

const router = express.Router();

router.post('/v1/validate', async (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();
  const data = body?.input?.data;
  const schemaKey = body?.schema?.key;
  const schemaVersion = body?.schema?.version || null;

  if (data === undefined || !schemaKey) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data and schema.key are required'));
  }

  const schemaRow = await getActiveSchema(schemaKey, schemaVersion);
  if (!schemaRow) {
    return res.status(404).json(errorEnvelope(requestId, 'SCHEMA_NOT_FOUND', `No active schema for key '${schemaKey}'`));
  }

  const validation = validateAgainstSkeleton(data, schemaRow.schema);
  res.status(200).json({
    success: true,
    request: { request_id: requestId },
    schema: { key: schemaKey, version: schemaRow.version, valid: validation.valid },
    missing_fields: validation.missingFields,
    unexpected_fields: validation.unexpectedFields,
    type_mismatches: validation.typeMismatches
  });
});

module.exports = router;
