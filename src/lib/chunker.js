// LEVEL 3 - data reduction / chopping.
// Never splits mid-syntax: arrays split on element boundaries, objects
// split on key boundaries, strings split on paragraph/sentence boundaries.

const { v4: uuidv4 } = require('uuid');

function byteSize(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
}

function chunkArray(arr, maxSize) {
  const chunks = [];
  let current = [];
  let currentSize = 2; // for [ ]

  for (const item of arr) {
    const itemSize = byteSize(item) + 1; // + comma
    if (current.length > 0 && currentSize + itemSize > maxSize) {
      chunks.push(current);
      current = [];
      currentSize = 2;
    }
    current.push(item);
    currentSize += itemSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function chunkObjectByKeys(obj, maxSize) {
  const chunks = [];
  let current = {};
  let currentSize = 2; // for { }

  for (const [key, value] of Object.entries(obj)) {
    const entrySize = byteSize({ [key]: value });
    if (Object.keys(current).length > 0 && currentSize + entrySize > maxSize) {
      chunks.push(current);
      current = {};
      currentSize = 2;
    }
    current[key] = value;
    currentSize += entrySize;
  }
  if (Object.keys(current).length > 0) chunks.push(current);
  return chunks;
}

function chunkString(str, maxSize) {
  // Prefer paragraph boundaries, then sentence boundaries, then hard slice
  // only as a last resort (still on a whitespace boundary where possible).
  const chunks = [];
  let remaining = str;

  while (byteSize(remaining) > maxSize) {
    let cut = maxSize;
    const window = remaining.slice(0, maxSize + 200);
    const paraBreak = window.lastIndexOf('\n\n');
    const sentenceBreak = window.lastIndexOf('. ');
    const spaceBreak = window.lastIndexOf(' ');

    if (paraBreak > maxSize * 0.5) cut = paraBreak + 2;
    else if (sentenceBreak > maxSize * 0.5) cut = sentenceBreak + 2;
    else if (spaceBreak > 0) cut = spaceBreak + 1;

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

// Returns { enabled: false } if under the limit, otherwise a full chunking
// envelope fragment per the Day 6 contract.
function chunkIfNeeded(data, maxSize, requestId) {
  const originalSize = byteSize(data);
  if (originalSize <= maxSize) {
    return { enabled: false };
  }

  let rawChunks;
  let dataType;

  if (Array.isArray(data)) {
    rawChunks = chunkArray(data, maxSize);
    dataType = 'array';
  } else if (data && typeof data === 'object') {
    rawChunks = chunkObjectByKeys(data, maxSize);
    dataType = 'object';
  } else if (typeof data === 'string') {
    rawChunks = chunkString(data, maxSize);
    dataType = 'string';
  } else {
    // Not choppable (number/boolean/etc) - return as a single "chunk".
    rawChunks = [data];
    dataType = 'primitive';
  }

  const chunks = rawChunks.map((chunk, index) => ({
    chunk_id: uuidv4(),
    index,
    data: chunk
  }));

  return {
    enabled: true,
    data_type: dataType,
    original_size: originalSize,
    chunk_size: maxSize,
    chunk_count: chunks.length,
    parent_request_id: requestId,
    chunks
  };
}

module.exports = { chunkIfNeeded, byteSize };
