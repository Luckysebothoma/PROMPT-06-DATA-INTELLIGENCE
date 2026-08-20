const { pool } = require('../db');

async function getActiveSchema(key, version = null) {
  if (!key) return null;
  const query = version
    ? 'SELECT * FROM json_schemas WHERE schema_key = $1 AND version = $2 AND active = true LIMIT 1'
    : 'SELECT * FROM json_schemas WHERE schema_key = $1 AND active = true ORDER BY version DESC LIMIT 1';
  const params = version ? [key, version] : [key];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

async function listSchemas() {
  const { rows } = await pool.query(
    'SELECT id, schema_key, version, name, description, source, active, created_at, updated_at FROM json_schemas ORDER BY schema_key, version DESC'
  );
  return rows;
}

async function createSchema({ schema_key, name, description, schema, source = 'user' }) {
  if (!schema_key || !schema) {
    throw new Error('schema_key and schema are required');
  }
  const { rows: versionRows } = await pool.query(
    'SELECT COALESCE(MAX(version), 0) AS max_version FROM json_schemas WHERE schema_key = $1',
    [schema_key]
  );
  const nextVersion = (versionRows[0].max_version || 0) + 1;

  const { rows } = await pool.query(
    `INSERT INTO json_schemas (schema_key, version, name, description, schema, source, active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING *`,
    [schema_key, nextVersion, name || schema_key, description || null, JSON.stringify(schema), source]
  );
  return rows[0];
}

module.exports = { getActiveSchema, listSchemas, createSchema };
