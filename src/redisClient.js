const Redis = require('ioredis');

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null
};

const redis = new Redis(connection);

const QUEUES = {
  STRUCTURE: process.env.QUEUE_STRUCTURE || 'data-structure',
  RECOVERY: process.env.QUEUE_RECOVERY || 'json-recovery',
  CHUNKING: process.env.QUEUE_CHUNKING || 'data-chunking'
};

module.exports = { redis, connection, QUEUES };
