const express = require('express');
const { listSchemas, getActiveSchema, createSchema } = require('../lib/schemaRegistry');

const router = express.Router();

router.get('/v1/schemas', async (req, res) => {
  const schemas = await listSchemas();
  res.status(200).json({ success: true, schemas });
});

router.get('/v1/schemas/:key', async (req, res) => {
  const schema = await getActiveSchema(req.params.key, req.query.version ? parseInt(req.query.version, 10) : null);
  if (!schema) {
    return res.status(404).json({ success: false, error: { code: 'SCHEMA_NOT_FOUND', message: `No active schema for key '${req.params.key}'` } });
  }
  res.status(200).json({ success: true, schema });
});

router.post('/v1/schemas', async (req, res) => {
  const { schema_key, name, description, schema, source } = req.body || {};
  if (!schema_key || !schema) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'schema_key and schema are required' } });
  }
  try {
    const created = await createSchema({ schema_key, name, description, schema, source });
    res.status(201).json({ success: true, schema: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

module.exports = router;
