require('dotenv').config();
const { Worker } = require('bullmq');
const { connection, QUEUES } = require('../redisClient');
const recoveryLadder = require('../lib/recoveryLadder');
const metrics = require('../metrics');
const http = require('http');

const WORKER_NAME = process.env.WORKER_NAME || 'day6-worker';
metrics.workerActive.labels(WORKER_NAME).set(1);

function makeProcessor(queueName) {
  return async (job) => {
    try {
      const result = await recoveryLadder.run(job.data);
      metrics.queueJobsTotal.labels(queueName, result.success ? 'completed' : 'failed_validation').inc();
      return result;
    } catch (err) {
      metrics.queueJobsTotal.labels(queueName, 'error').inc();
      throw err;
    }
  };
}

const workers = Object.values(QUEUES).map((queueName) => {
  const worker = new Worker(queueName, makeProcessor(queueName), { connection, concurrency: 4 });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker:${queueName}] job ${job?.id} failed: ${err.message}`);
  });
  return worker;
});

// Minimal metrics endpoint so the worker process is independently scrapeable.
const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': metrics.register.contentType });
    res.end(await metrics.register.metrics());
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ai-gateway-6-of-10-data-intelligence-worker' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const port = parseInt(process.env.WORKER_METRICS_PORT || '8080', 10);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[worker] listening for health/metrics on :${port}, consuming queues: ${Object.values(QUEUES).join(', ')}`);
});

process.on('SIGTERM', async () => {
  await Promise.all(workers.map((w) => w.close()));
  server.close();
  process.exit(0);
});
