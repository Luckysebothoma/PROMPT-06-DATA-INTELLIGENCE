const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Queue, QueueEvents } = require('bullmq');
const { connection, QUEUES } = require('../redisClient');
const { errorEnvelope } = require('../envelope');
const metrics = require('../metrics');

const router = express.Router();

const queues = {
  [QUEUES.STRUCTURE]: new Queue(QUEUES.STRUCTURE, { connection }),
  [QUEUES.RECOVERY]: new Queue(QUEUES.RECOVERY, { connection }),
  [QUEUES.CHUNKING]: new Queue(QUEUES.CHUNKING, { connection })
};

function resolveQueueName(requested) {
  if (requested && queues[requested]) return requested;
  return QUEUES.STRUCTURE;
}

router.post('/v1/jobs', async (req, res) => {
  const body = req.body || {};
  const requestId = body?.request?.request_id || uuidv4();

  if (body?.input?.data === undefined) {
    return res.status(400).json(errorEnvelope(requestId, 'INVALID_REQUEST', 'input.data is required'));
  }

  const queueName = resolveQueueName(body.queue);
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

  const job = await queues[queueName].add('structure', envelopeInput, {
    jobId: requestId,
    attempts: 2,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 500
  });

  metrics.queueJobsTotal.labels(queueName, 'enqueued').inc();

  res.status(202).json({
    success: true,
    request: { request_id: requestId },
    job: { id: job.id, queue: queueName, status: 'queued' }
  });
});

router.get('/v1/jobs/:id', async (req, res) => {
  const queueName = resolveQueueName(req.query.queue);
  const job = await queues[queueName].getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: `No job '${req.params.id}' on queue '${queueName}'` } });
  }
  const state = await job.getState();
  res.status(200).json({
    success: true,
    job: {
      id: job.id,
      queue: queueName,
      status: state,
      result: job.returnvalue || null,
      failed_reason: job.failedReason || null
    }
  });
});

module.exports = router;
