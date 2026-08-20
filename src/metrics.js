const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'day6_' });

// Bounded labels only: operation, status, recovery_method, data_type, source,
// provider, worker, schema_key(bounded-ish - small known set), queue.
// Never request_id / session_id / user_id / raw content.

const requestsTotal = new client.Counter({
  name: 'day6_requests_total',
  help: 'Total requests received by Day 6',
  labelNames: ['operation', 'status'],
  registers: [register]
});

const structuresSuccessfulTotal = new client.Counter({
  name: 'day6_structures_successful_total',
  help: 'Structures that completed successfully',
  labelNames: ['recovery_method'],
  registers: [register]
});

const malformedJsonTotal = new client.Counter({
  name: 'day6_malformed_json_total',
  help: 'Inputs detected as malformed JSON',
  labelNames: ['data_type'],
  registers: [register]
});

const repairedJsonTotal = new client.Counter({
  name: 'day6_repaired_json_total',
  help: 'Inputs successfully repaired',
  labelNames: ['recovery_method'],
  registers: [register]
});

const unrecoverableTotal = new client.Counter({
  name: 'day6_unrecoverable_total',
  help: 'Inputs that could not be recovered',
  labelNames: ['data_type'],
  registers: [register]
});

const schemaMismatchesTotal = new client.Counter({
  name: 'day6_schema_mismatches_total',
  help: 'Schema validation mismatches',
  labelNames: ['schema_key'],
  registers: [register]
});

const oversizedPayloadsTotal = new client.Counter({
  name: 'day6_oversized_payloads_total',
  help: 'Payloads exceeding max size',
  labelNames: ['data_type'],
  registers: [register]
});

const chunksCreatedTotal = new client.Counter({
  name: 'day6_chunks_created_total',
  help: 'Chunks created during data chopping',
  labelNames: ['data_type'],
  registers: [register]
});

const recoveryAttemptsTotal = new client.Counter({
  name: 'day6_recovery_attempts_total',
  help: 'Recovery ladder attempts by level',
  labelNames: ['level'],
  registers: [register]
});

const aiFallbackAttemptsTotal = new client.Counter({
  name: 'day6_ai_fallback_attempts_total',
  help: 'AI recovery escalations attempted',
  labelNames: ['provider'],
  registers: [register]
});

const aiFallbackSuccessTotal = new client.Counter({
  name: 'day6_ai_fallback_success_total',
  help: 'AI recovery escalations that produced valid output',
  labelNames: ['provider'],
  registers: [register]
});

const aiFallbackFailureTotal = new client.Counter({
  name: 'day6_ai_fallback_failure_total',
  help: 'AI recovery escalations that failed',
  labelNames: ['provider'],
  registers: [register]
});

const anomaliesTotal = new client.Counter({
  name: 'day6_anomalies_total',
  help: 'Anomalies recorded',
  labelNames: ['event_type'],
  registers: [register]
});

const processingDuration = new client.Histogram({
  name: 'day6_processing_duration_seconds',
  help: 'Processing duration of the recovery ladder',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const queueJobsTotal = new client.Counter({
  name: 'day6_queue_jobs_total',
  help: 'Queue job lifecycle events',
  labelNames: ['queue', 'status'],
  registers: [register]
});

const workerActive = new client.Gauge({
  name: 'day6_worker_active',
  help: 'Number of active worker processes consuming jobs',
  labelNames: ['worker'],
  registers: [register]
});

module.exports = {
  register,
  requestsTotal,
  structuresSuccessfulTotal,
  malformedJsonTotal,
  repairedJsonTotal,
  unrecoverableTotal,
  schemaMismatchesTotal,
  oversizedPayloadsTotal,
  chunksCreatedTotal,
  recoveryAttemptsTotal,
  aiFallbackAttemptsTotal,
  aiFallbackSuccessTotal,
  aiFallbackFailureTotal,
  anomaliesTotal,
  processingDuration,
  queueJobsTotal,
  workerActive
};
