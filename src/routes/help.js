const express = require('express');
const router = express.Router();

router.get('/help', (req, res) => {
  res.status(200).json({
    service: 'ai-gateway-6-of-10-data-intelligence',
    version: '0.1.0',
    description: 'AI Gateway - Stack 6 of 10 - Data Intelligence Recovery, JSON Structuring, Sanitization and Chopping',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Process liveness, no external dependencies' },
      { method: 'GET', path: '/ready', description: 'Readiness including Postgres and Redis' },
      { method: 'GET', path: '/dependencies', description: 'Dependency connectivity diagnostics, including Stack 3 and Stack 5' },
      { method: 'GET', path: '/help', description: 'Machine readable API discovery document' },
      { method: 'GET', path: '/metrics', description: 'Prometheus metrics' },
      { method: 'POST', path: '/v1/structure', description: 'Run the full recovery ladder synchronously and return a clean structure' },
      { method: 'POST', path: '/v1/sanitize', description: 'Run Level 0/1 inspection and deterministic sanitization only' },
      { method: 'POST', path: '/v1/validate', description: 'Validate a JSON payload against a registered schema' },
      { method: 'POST', path: '/v1/parse', description: 'Attempt to parse input into JSON without schema mapping' },
      { method: 'POST', path: '/v1/chunk', description: 'Chop an oversized payload into ordered, boundary-safe chunks' },
      { method: 'GET', path: '/v1/schemas', description: 'List registered JSON skeletons' },
      { method: 'GET', path: '/v1/schemas/:key', description: 'Fetch the active skeleton for a schema key' },
      { method: 'POST', path: '/v1/schemas', description: 'Register a new JSON skeleton (versioned insert, no code changes required)' },
      { method: 'GET', path: '/v1/events', description: 'List recorded recovery events' },
      { method: 'GET', path: '/v1/anomalies', description: 'List recorded anomalies' },
      { method: 'POST', path: '/v1/jobs', description: 'Enqueue an async structuring job (BullMQ over the shared Redis)' },
      { method: 'GET', path: '/v1/jobs/:id', description: 'Fetch async job status/result' }
    ],
    notes: 'Day 6 of 10. Reuses Stack 3 (execution), Stack 4 (context/session) and Stack 5 (orchestration) as-is. Never invents missing business data; AI recovery is a last resort and is always re-validated deterministically.'
  });
});

module.exports = router;
