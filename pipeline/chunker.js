export function parseChunks(text) {
  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        chunks.push({
          type: 'string_literal',
          content: current,
          score: 0.0,
          compressLevel: 0.0,
          metadata: { lineStart: 0, lineEnd: 0 }
        });
        current = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      if (current.trim()) {
        chunks.push({
          type: 'code',
          content: current,
          score: 0.0,
          compressLevel: 0.0,
          metadata: { lineStart: 0, lineEnd: 0 }
        });
      }
      current = char;
      inString = true;
      stringChar = char;
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    chunks.push({
      type: 'code',
      content: current,
      score: 0.0,
      compressLevel: 0.0,
      metadata: { lineStart: 0, lineEnd: 0 }
    });
  }

  return chunks;
}
