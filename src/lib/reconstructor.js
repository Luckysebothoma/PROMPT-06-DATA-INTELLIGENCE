// LEVEL 2 / LEVEL 4 - known skeleton mapping and schema-guided reconstruction.
// Skeletons are flat-ish example objects (see migrations/001_init.sql). The
// type of each skeleton value defines the expected type for that field.
// Missing required data is NEVER invented - it stays absent/null.

function expectedType(value) {
  if (value === null) return 'any';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object'
}

function actualType(value) {
  if (value === null || value === undefined) return 'missing';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// Maps `data` onto `skeleton`, field by field, one level deep (nested
// objects are matched but not recursively re-typed beyond presence).
function reconcile(data, skeleton) {
  const result = {};
  const missingFields = [];
  const unexpectedFields = [];
  const typeMismatches = [];

  const skeletonKeys = Object.keys(skeleton || {});
  const dataObj = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};

  for (const key of skeletonKeys) {
    const expected = expectedType(skeleton[key]);
    if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
      const actual = actualType(dataObj[key]);
      if (expected !== 'any' && actual !== 'missing' && actual !== expected) {
        typeMismatches.push({ field: key, expected, actual });
        result[key] = dataObj[key]; // preserve original value, flagged not fixed
      } else {
        result[key] = dataObj[key];
      }
    } else {
      missingFields.push(key);
      // Preserve absence rather than inventing a value.
      result[key] = expected === 'object' ? {} : (expected === 'array' ? [] : null);
    }
  }

  for (const key of Object.keys(dataObj)) {
    if (!skeletonKeys.includes(key)) {
      unexpectedFields.push(key);
    }
  }

  return { result, missingFields, unexpectedFields, typeMismatches };
}

function validateAgainstSkeleton(data, skeleton) {
  const { missingFields, unexpectedFields, typeMismatches } = reconcile(data, skeleton);
  return {
    valid: typeMismatches.length === 0,
    missingFields,
    unexpectedFields,
    typeMismatches
  };
}

module.exports = { reconcile, validateAgainstSkeleton, expectedType, actualType };
