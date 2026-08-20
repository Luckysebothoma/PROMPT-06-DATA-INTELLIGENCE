const express = require('express');
const { ping: pingDb } = require('../db');
const { redis } = require('../redisClient');

const router = express.Router();

router.get('/ready', async (req, res) => {
  const checks = { postgres: false, redis: false };
  try {
    await pingDb();
    checks.postgres = true;
  } catch (_e) { /* stays false */ }

  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG';
  } catch (_e) { /* stays false */ }

  const ready = checks.postgres && checks.redis;
  res.status(ready ? 200 : 503).json({ success: ready, ready, dependencies: checks });
});

module.exports = router;
