// LEVEL 5 - AI RECOVERY.
// Only reached when deterministic recovery (Levels 0-4) fails.
// Does NOT implement a second provider integration - it calls the EXISTING
// Stack 3 (/v1/execute) or Stack 5 (/v1/chat) execution path.
// The AI's output is NEVER trusted directly: it is re-run through the
// deterministic sanitizer + validator by the caller (recoveryLadder.js).

const fetch = require('node-fetch');

const STACK3_URL = process.env.STACK3_URL || 'http://192.168.0.140:4405';
const STACK5_URL = process.env.STACK5_URL || 'http://192.168.0.140:4407';
const ROUTE = process.env.AI_RECOVERY_ROUTE || 'stack3';
const PROVIDER = process.env.AI_RECOVERY_PROVIDER || 'groq';
const MODEL = process.env.AI_RECOVERY_MODEL || 'openai/gpt-oss-120b';
const TIMEOUT_MS = parseInt(process.env.AI_RECOVERY_TIMEOUT_MS || '15000', 10);

function buildPrompt(malformedInput, skeleton) {
  const skeletonBlock = skeleton ? JSON.stringify(skeleton) : '{}';
  const inputBlock = typeof malformedInput === 'string'
    ? malformedInput
    : JSON.stringify(malformedInput);

  return [
    'You are a JSON recovery service.',
    'You are NOT allowed to invent missing information.',
    'Repair the supplied structure so it conforms to the supplied JSON skeleton.',
    'Return ONLY valid JSON.',
    '',
    'INPUT:',
    inputBlock,
    '',
    'SKELETON:',
    skeletonBlock,
    '',
    'RULES:',
    '- preserve original information',
    '- do not invent information',
    '- do not explain',
    '- do not use markdown',
    "- do not add fields not defined by the skeleton",
    '- return JSON only'
  ].join('\n');
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI recovery request timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callStack3(prompt) {
  const res = await withTimeout(fetch(`${STACK3_URL}/v1/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: PROVIDER,
      model: MODEL,
      message: prompt,
      instruction: 'You are a strict JSON recovery service. Return JSON only.',
      temperature: 0
    })
  }), TIMEOUT_MS);

  if (!res.ok) {
    throw new Error(`Stack 3 execute returned HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(body.error?.message || 'Stack 3 execute reported failure');
  }
  return body.response;
}

async function callStack5(prompt, sessionId) {
  const res = await withTimeout(fetch(`${STACK5_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message: prompt
    })
  }), TIMEOUT_MS);

  if (!res.ok) {
    throw new Error(`Stack 5 chat returned HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(body.error?.message || 'Stack 5 chat reported failure');
  }
  return body.response;
}

// Returns the raw text the AI produced. Caller is responsible for running
// it back through sanitizer.js + reconstructor.js before trusting it.
async function escalate({ malformedInput, skeleton, sessionId }) {
  const prompt = buildPrompt(malformedInput, skeleton);
  if (ROUTE === 'stack5') {
    return callStack5(prompt, sessionId);
  }
  return callStack3(prompt);
}

module.exports = { escalate, buildPrompt, STACK3_URL, STACK5_URL, PROVIDER, MODEL };
