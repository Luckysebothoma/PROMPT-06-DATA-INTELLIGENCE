const { v4: uuidv4 } = require('uuid');

function newRequestId() {
  return uuidv4();
}

function buildResponseEnvelope({
  success,
  requestId,
  resultType = 'json',
  data = null,
  schemaKey = null,
  schemaVersion = null,
  schemaValid = null,
  recoveryAttempted = false,
  recoveryMethod = null,
  aiFallback = false,
  chunking = { enabled: false },
  anomalies = [],
  error = null
}) {
  const envelope = {
    success,
    request: { request_id: requestId },
    result: { type: resultType, data },
    schema: {
      key: schemaKey,
      version: schemaVersion,
      valid: schemaValid
    },
    recovery: {
      attempted: recoveryAttempted,
      method: recoveryMethod,
      ai_fallback: aiFallback
    },
    chunking,
    anomalies
  };

  if (error) {
    envelope.error = error;
  }

  return envelope;
}

function errorEnvelope(requestId, code, message, extra = {}) {
  return buildResponseEnvelope({
    success: false,
    requestId,
    data: null,
    error: { code, message, ...extra }
  });
}

module.exports = { newRequestId, buildResponseEnvelope, errorEnvelope };
