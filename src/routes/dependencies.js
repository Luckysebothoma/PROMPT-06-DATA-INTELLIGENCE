const express = require('express');
const fetch = require('node-fetch');
const { ping: pingDb } = require('../db');
const { redis } = require('../redisClient');

const router = express.Router();
const TIMEOUT_MS = 2000;

async function checkHttp(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch (_e) {
    return false;
  }
}

router.get('/dependencies', async (req, res) => {
  const [postgres, redisOk, stack3, stack5] = await Promise.all([
    pingDb().then(() => true).catch(() => false),
    redis.ping().then((p) => p === 'PONG').catch(() => false),
    checkHttp(process.env.STACK3_URL || 'http://192.168.0.140:4405'),
    checkHttp(process.env.STACK5_URL || 'http://192.168.0.140:4407')
  ]);

  res.status(200).json({
    success: true,
    dependencies: {
      postgres: { reachable: postgres },
      redis: { reachable: redisOk },
      stack3: { reachable: stack3, url: process.env.STACK3_URL || 'http://192.168.0.140:4405' },
      stack5: { reachable: stack5, url: process.env.STACK5_URL || 'http://192.168.0.140:4407' }
    }
  });
});

module.exports = router;
