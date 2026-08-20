// LEVEL 1 - cheap deterministic sanitization.
// Every step is safe, reversible-in-intent, and logged in `applied`.

const CODE_FENCE_RE = /```(?:json|javascript|js)?\s*([\s\S]*?)```/i;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const TRAILING_COMMA_RE = /,\s*([\]}])/g;

function stripCodeFences(str, applied) {
  const match = str.match(CODE_FENCE_RE);
  if (match) {
    applied.push('strip_code_fences');
    return match[1].trim();
  }
  return str;
}

function extractJsonSpan(str, applied) {
  const firstObj = str.indexOf('{');
  const firstArr = str.indexOf('[');
  let start = -1;
  let openChar = '{';
  let closeChar = '}';

  if (firstObj === -1 && firstArr === -1) return str;

  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    openChar = '[';
    closeChar = ']';
  } else {
    start = firstObj;
  }

  // Walk forward tracking bracket depth, respecting string literals, to find
  // the matching close without slicing mid-syntax.
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let end = -1;

  for (let i = start; i < str.length; i += 1) {
    const ch = str[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return str; // could not find a clean boundary, leave as-is

  const span = str.slice(start, end + 1);
  if (span.length !== str.trim().length) {
    applied.push('trim_surrounding_text');
  }
  return span;
}

function normalizeWhitespace(str, applied) {
  const next = str.replace(/\r\n/g, '\n').trim();
  if (next !== str) applied.push('normalize_whitespace');
  return next;
}

function removeControlChars(str, applied) {
  if (CONTROL_CHAR_RE.test(str)) {
    applied.push('remove_control_characters');
    return str.replace(CONTROL_CHAR_RE, '');
  }
  return str;
}

function normalizeQuotes(str, applied) {
  const next = str
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  if (next !== str) applied.push('normalize_quotation_marks');
  return next;
}

function removeTrailingCommas(str, applied) {
  if (TRAILING_COMMA_RE.test(str)) {
    applied.push('remove_trailing_commas');
    return str.replace(TRAILING_COMMA_RE, '$1');
  }
  return str;
}

function unescapeIfDoubleEncoded(str, applied) {
  const trimmed = str.trim();
  if (!trimmed.startsWith('"')) return str;
  try {
    const inner = JSON.parse(trimmed);
    if (typeof inner === 'string' && (inner.trim().startsWith('{') || inner.trim().startsWith('['))) {
      applied.push('normalize_escaped_json');
      return inner;
    }
  } catch (_e) {
    // not double encoded, leave as-is
  }
  return str;
}

// Runs the full Level 1 pipeline. Input must be a string.
function sanitize(input) {
  const applied = [];
  if (typeof input !== 'string') {
    return { data: input, applied };
  }

  let working = input;
  working = stripCodeFences(working, applied);
  working = normalizeWhitespace(working, applied);
  working = unescapeIfDoubleEncoded(working, applied);
  working = removeControlChars(working, applied);
  working = normalizeQuotes(working, applied);
  working = extractJsonSpan(working, applied);
  working = removeTrailingCommas(working, applied);

  return { data: working, applied };
}

// Attempts a plain JSON.parse after sanitization. Never throws.
function attemptParse(sanitizedString) {
  try {
    return { ok: true, value: JSON.parse(sanitizedString) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { sanitize, attemptParse, extractJsonSpan };
