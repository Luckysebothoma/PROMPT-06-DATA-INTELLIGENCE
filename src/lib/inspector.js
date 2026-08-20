// LEVEL 0 - Input inspection.
// Determines a coarse data_type without mutating the input.

const CODE_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

function byteSize(value) {
  try {
    return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  } catch (_e) {
    return 0;
  }
}

function looksLikeEscapedJson(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('"') && !trimmed.includes('\\"')) return false;
  try {
    const once = JSON.parse(trimmed.startsWith('"') ? trimmed : `"${trimmed.replace(/"/g, '\\"')}"`);
    return typeof once === 'string' && (once.trim().startsWith('{') || once.trim().startsWith('['));
  } catch (_e) {
    return false;
  }
}

function inspect(raw, opts = {}) {
  const maxSize = opts.maxSize || 10000;
  const inspection = {
    data_type: 'unknown',
    size: byteSize(raw),
    is_code_fence: false,
    is_escaped: false,
    is_oversized: false,
    parses_directly: false
  };

  inspection.is_oversized = inspection.size > maxSize;

  if (raw === null || raw === undefined) {
    inspection.data_type = 'unknown';
    return inspection;
  }

  if (typeof raw === 'object') {
    inspection.data_type = Array.isArray(raw) ? 'json_array' : 'json_object';
    inspection.parses_directly = true;
    return inspection;
  }

  if (typeof raw !== 'string') {
    inspection.data_type = 'unknown';
    return inspection;
  }

  const trimmed = raw.trim();

  if (CODE_FENCE_RE.test(trimmed)) {
    inspection.is_code_fence = true;
  }

  try {
    const parsed = JSON.parse(trimmed);
    inspection.parses_directly = true;
    inspection.data_type = Array.isArray(parsed) ? 'json_array' : (typeof parsed === 'object' && parsed !== null ? 'json_object' : 'string');
    return inspection;
  } catch (_e) {
    // fall through
  }

  if (looksLikeEscapedJson(trimmed)) {
    inspection.is_escaped = true;
    inspection.data_type = 'escaped_json';
    return inspection;
  }

  if (inspection.is_code_fence) {
    inspection.data_type = 'markdown';
    return inspection;
  }

  if (trimmed.includes('{') || trimmed.includes('[')) {
    inspection.data_type = 'malformed_json';
    return inspection;
  }

  inspection.data_type = 'string';
  return inspection;
}

module.exports = { inspect, byteSize, looksLikeEscapedJson };
