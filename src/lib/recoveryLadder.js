// Orchestrates the mandatory Day 6 order:
// 1 RECEIVE 2 INSPECT 3 CLASSIFY 4 NORMALIZE 5 CHOP IF NECESSARY
// 6 DETERMINISTIC REPAIR 7 KNOWN SKELETON 8 VALIDATE 9 ESCALATE TO AI
// 10 VALIDATE AI RESULT 11 RECORD EVENT 12 RETURN CLEAN RESULT

const { inspect } = require('./inspector');
const { sanitize, attemptParse } = require('./sanitizer');
const { chunkIfNeeded, byteSize } = require('./chunker');
const { reconcile, validateAgainstSkeleton } = require('./reconstructor');
const { getActiveSchema } = require('./schemaRegistry');
const aiRecovery = require('./aiRecovery');
const { recordEvent } = require('./anomalies');
const { buildResponseEnvelope, newRequestId } = require('../envelope');
const metrics = require('../metrics');

async function run(envelopeInput) {
  const startedAt = process.hrtime.bigint();
  const requestId = envelopeInput?.request?.request_id || newRequestId();
  const parentRequestId = envelopeInput?.request?.parent_request_id || null;
  const source = envelopeInput?.source || {};
  const rawInput = envelopeInput?.input?.data;
  const schemaKey = envelopeInput?.schema?.key || null;
  const schemaVersion = envelopeInput?.schema?.version || null;
  const options = envelopeInput?.options || {};
  const allowAiRecovery = options.allow_ai_recovery !== false
    && (process.env.ALLOW_AI_RECOVERY_DEFAULT || 'true') !== 'false';
  const allowChunking = options.allow_chunking !== false
    && (process.env.ALLOW_CHUNKING_DEFAULT || 'true') !== 'false';
  const maxSize = options.max_size || parseInt(process.env.DEFAULT_MAX_PAYLOAD_SIZE || '10000', 10);

  const anomalies = [];
  let recoveryMethod = null;

  const finish = async (envelope, statusLabel) => {
    const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    metrics.processingDuration.labels(source.operation || 'structure').observe(elapsedSeconds);
    metrics.requestsTotal.labels(source.operation || 'structure', statusLabel).inc();
    return envelope;
  };

  // STEP 1 - RECEIVE (already have rawInput)
  // STEP 2 - INSPECT
  const inspection = inspect(rawInput, { maxSize });

  if (inspection.is_oversized) {
    metrics.oversizedPayloadsTotal.labels(inspection.data_type).inc();
    const id = await recordEvent({
      eventType: 'oversized_payload', source: source.stack, operation: source.operation,
      status: 'detected', schemaKey, requestId, parentRequestId,
      inputSize: inspection.size, metadata: { data_type: inspection.data_type }
    });
    anomalies.push({ id, type: 'oversized_payload' });
  }

  // STEP 3 - CLASSIFY happens implicitly via inspection.data_type
  if (['malformed_json', 'unknown'].includes(inspection.data_type)) {
    metrics.malformedJsonTotal.labels(inspection.data_type).inc();
  }

  // STEP 4 - NORMALIZE (Level 1 deterministic sanitization)
  metrics.recoveryAttemptsTotal.labels('1').inc();
  const { data: sanitizedString, applied } = sanitize(rawInput);

  let workingData = null;
  let parsedOk = false;

  if (typeof rawInput === 'object' && rawInput !== null) {
    workingData = rawInput;
    parsedOk = true;
  } else {
    const parseResult = attemptParse(sanitizedString);
    if (parseResult.ok) {
      workingData = parseResult.value;
      parsedOk = true;
      if (applied.length > 0) {
        recoveryMethod = `deterministic_${applied[applied.length - 1]}`;
        metrics.repairedJsonTotal.labels(recoveryMethod).inc();
        const id = await recordEvent({
          eventType: 'deterministic_repair', source: source.stack, operation: source.operation,
          status: 'recovered', recoveryMethod, schemaKey, requestId, parentRequestId,
          inputSize: inspection.size, outputSize: byteSize(workingData),
          metadata: { applied }
        });
        anomalies.push({ id, type: 'deterministic_repair' });
      }
    }
  }

  // STEP 5 - CHOP IF NECESSARY (before further schema work, on the best data we have)
  let chunking = { enabled: false };
  if (allowChunking && parsedOk) {
    chunking = chunkIfNeeded(workingData, maxSize, requestId);
    if (chunking.enabled) {
      metrics.chunksCreatedTotal.labels(chunking.data_type).inc(chunking.chunk_count);
      const id = await recordEvent({
        eventType: 'chunking_required', source: source.stack, operation: source.operation,
        status: 'chunked', schemaKey, requestId, parentRequestId,
        inputSize: chunking.original_size, outputSize: chunking.chunk_size,
        metadata: { chunk_count: chunking.chunk_count, data_type: chunking.data_type }
      });
      anomalies.push({ id, type: 'chunking_required' });
    }
  }

  // STEP 6/7 - Known skeleton mapping (Level 2 / Level 4)
  let schemaRow = null;
  let schemaValid = null;
  let reconciled = null;

  if (schemaKey) {
    schemaRow = await getActiveSchema(schemaKey, schemaVersion);
  }

  if (parsedOk && schemaRow) {
    const skeleton = schemaRow.schema;
    reconciled = reconcile(workingData, skeleton);
    const validation = validateAgainstSkeleton(workingData, skeleton);
    schemaValid = validation.valid;

    if (!validation.valid || validation.missingFields.length > 0) {
      metrics.schemaMismatchesTotal.labels(schemaKey).inc();
      const id = await recordEvent({
        eventType: 'schema_mismatch', source: source.stack, operation: source.operation,
        status: validation.valid ? 'partial' : 'mismatch', schemaKey, requestId, parentRequestId,
        metadata: {
          missing_fields: validation.missingFields,
          unexpected_fields: validation.unexpectedFields,
          type_mismatches: validation.typeMismatches
        }
      });
      anomalies.push({ id, type: 'schema_mismatch' });
    }

    workingData = reconciled.result;
  }

  // STEP 8 - VALIDATE
  // Deterministic path succeeds once we have parsed JSON. Schema mismatches
  // are recorded as anomalies but do not by themselves force AI escalation -
  // missing/incompatible fields are expected and must never be hallucinated
  // into existence. AI escalation is reserved for "could not parse at all".

  if (parsedOk) {
    const envelope = buildResponseEnvelope({
      success: true,
      requestId,
      data: workingData,
      schemaKey,
      schemaVersion: schemaRow ? schemaRow.version : schemaVersion,
      schemaValid,
      recoveryAttempted: applied.length > 0,
      recoveryMethod,
      aiFallback: false,
      chunking,
      anomalies
    });
    metrics.structuresSuccessfulTotal.labels(recoveryMethod || 'none').inc();
    return finish(envelope, 'success');
  }

  // STEP 9 - ESCALATE TO EXISTING AI (only because deterministic recovery failed)
  if (!allowAiRecovery) {
    const id = await recordEvent({
      eventType: 'unrecoverable_no_ai', source: source.stack, operation: source.operation,
      status: 'failed', schemaKey, requestId, parentRequestId, inputSize: inspection.size
    });
    metrics.unrecoverableTotal.labels(inspection.data_type).inc();
    const envelope = buildResponseEnvelope({
      success: false,
      requestId,
      data: null,
      schemaKey,
      chunking,
      anomalies: [...anomalies, { id, type: 'unrecoverable_no_ai' }],
      error: { code: 'JSON_RECOVERY_FAILED', message: 'Deterministic recovery failed and AI recovery is disabled for this request.' }
    });
    return finish(envelope, 'failed');
  }

  metrics.aiFallbackAttemptsTotal.labels(aiRecovery.PROVIDER).inc();
  const aiEventId = await recordEvent({
    eventType: 'ai_recovery_required', source: source.stack, operation: source.operation,
    status: 'attempting', schemaKey, requestId, parentRequestId, inputSize: inspection.size, aiFallback: true
  });
  anomalies.push({ id: aiEventId, type: 'ai_recovery_required' });

  let aiRaw = null;
  let aiError = null;
  try {
    aiRaw = await aiRecovery.escalate({
      malformedInput: rawInput,
      skeleton: schemaRow ? schemaRow.schema : null,
      sessionId: requestId
    });
  } catch (err) {
    aiError = err.message;
  }

  if (aiError) {
    metrics.aiFallbackFailureTotal.labels(aiRecovery.PROVIDER).inc();
    const id = await recordEvent({
      eventType: 'ai_recovery_failed', source: source.stack, operation: source.operation,
      status: 'failed', schemaKey, requestId, parentRequestId, aiFallback: true,
      metadata: { reason: aiError }
    });
    metrics.unrecoverableTotal.labels(inspection.data_type).inc();
    const envelope = buildResponseEnvelope({
      success: false,
      requestId,
      data: null,
      schemaKey,
      recoveryAttempted: true,
      aiFallback: true,
      chunking,
      anomalies: [...anomalies, { id, type: 'ai_recovery_failed' }],
      error: { code: 'JSON_RECOVERY_FAILED', message: 'AI recovery request failed.', recovery: { deterministic_attempted: true, ai_attempted: true, validated: false } }
    });
    return finish(envelope, 'failed');
  }

  // STEP 10 - VALIDATE AI-REPAIRED RESULT (never trust it directly)
  const { data: aiSanitized } = sanitize(aiRaw);
  const aiParse = attemptParse(aiSanitized);

  if (!aiParse.ok) {
    metrics.aiFallbackFailureTotal.labels(aiRecovery.PROVIDER).inc();
    const id = await recordEvent({
      eventType: 'validation_failed', source: source.stack, operation: source.operation,
      status: 'failed', schemaKey, requestId, parentRequestId, aiFallback: true,
      metadata: { reason: 'ai output did not parse as JSON after sanitization' }
    });
    metrics.unrecoverableTotal.labels(inspection.data_type).inc();
    const envelope = buildResponseEnvelope({
      success: false,
      requestId,
      data: null,
      schemaKey,
      recoveryAttempted: true,
      aiFallback: true,
      chunking,
      anomalies: [...anomalies, { id, type: 'validation_failed' }],
      error: { code: 'JSON_RECOVERY_FAILED', message: 'AI-repaired output failed validation.', recovery: { deterministic_attempted: true, ai_attempted: true, validated: false } }
    });
    return finish(envelope, 'failed');
  }

  let aiResultData = aiParse.value;
  let aiSchemaValid = null;
  if (schemaRow) {
    const validation = validateAgainstSkeleton(aiResultData, schemaRow.schema);
    aiSchemaValid = validation.valid;
    aiResultData = reconcile(aiResultData, schemaRow.schema).result;
  }

  metrics.aiFallbackSuccessTotal.labels(aiRecovery.PROVIDER).inc();
  metrics.structuresSuccessfulTotal.labels('ai_recovery').inc();
  const successId = await recordEvent({
    eventType: 'ai_recovery_success', source: source.stack, operation: source.operation,
    status: 'recovered', recoveryMethod: 'ai_recovery', schemaKey, requestId, parentRequestId,
    outputSize: byteSize(aiResultData), aiFallback: true
  });

  // STEP 11/12 - RECORD + RETURN
  const envelope = buildResponseEnvelope({
    success: true,
    requestId,
    data: aiResultData,
    schemaKey,
    schemaVersion: schemaRow ? schemaRow.version : schemaVersion,
    schemaValid: aiSchemaValid,
    recoveryAttempted: true,
    recoveryMethod: 'ai_recovery',
    aiFallback: true,
    chunking,
    anomalies: [...anomalies, { id: successId, type: 'ai_recovery_success' }]
  });
  return finish(envelope, 'success');
}

module.exports = { run };
