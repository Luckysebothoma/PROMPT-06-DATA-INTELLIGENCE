require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const metrics = require('./metrics');

const app = express();
app.use(express.json({ limit: '25mb' }));

app.use(require('./routes/health'));
app.use(require('./routes/ready'));
app.use(require('./routes/dependencies'));
app.use(require('./routes/help'));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

app.use(require('./routes/structure'));
app.use(require('./routes/sanitize'));
app.use(require('./routes/validate'));
app.use(require('./routes/parse'));
app.use(require('./routes/chunk'));
app.use(require('./routes/schemas'));
app.use(require('./routes/events'));
app.use(require('./routes/jobs'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` }
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[server] unhandled error', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' }
  });
});

const port = parseInt(process.env.PORT || '8080', 10);

async function ensureMigrations() {
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // eslint-disable-next-line no-await-in-loop
    await pool.query(sql);
  }
}

async function start() {
  try {
    await ensureMigrations();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] migration step failed (continuing, may already be applied):', err.message);
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] ai-gateway-6-of-10-data-intelligence listening on :${port}`);
  });
}

start();

module.exports = app;
