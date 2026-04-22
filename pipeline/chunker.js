function splitLineComments(text) {
  const result = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Find // comment (but not in URL like http://)
    let commentIndex = -1;
    for (let i = 0; i < line.length - 1; i++) {
      if (line[i] === '/' && line[i + 1] === '/') {
        // Check if it's not part of a URL (preceded by :)
        if (i > 0 && line[i - 1] === ':') continue;
        commentIndex = i;
        break;
      }
    }

    // Find # comment
    let hashIndex = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '#') {
        // Check if it's not a hex color or shebang at start
        if (i === 0 && line.startsWith('#!')) continue;
        hashIndex = i;
        break;
      }
    }

    // Use whichever comes first
    const idx = commentIndex !== -1 && hashIndex !== -1
      ? Math.min(commentIndex, hashIndex)
      : commentIndex !== -1 ? commentIndex : hashIndex;

    if (idx !== -1) {
      const codePart = line.slice(0, idx);
      const commentPart = line.slice(idx);
      if (codePart.trim()) {
        result.push({ type: 'code', content: codePart });
      }
      if (commentPart.trim()) {
        result.push({ type: 'comment', content: commentPart });
      }
    } else {
      if (line.trim()) {
        result.push({ type: 'code', content: line });
      }
    }
  }

  return result;
}

export function parseChunks(text) {
  if (!text || typeof text !== 'string') return [];

  const rawChunks = [];
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
        rawChunks.push({
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
        rawChunks.push({
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
    rawChunks.push({
      type: 'code',
      content: current,
      score: 0.0,
      compressLevel: 0.0,
      metadata: { lineStart: 0, lineEnd: 0 }
    });
  }

  // Post-process: split comments from code chunks
  const finalChunks = [];
  for (const chunk of rawChunks) {
    if (chunk.type === 'code') {
      const split = splitLineComments(chunk.content);
      for (const part of split) {
        finalChunks.push({
          ...chunk,
          type: part.type,
          content: part.content
        });
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  // Classify code chunks as instruction or separator
  return finalChunks.map(chunk => classifyChunk(chunk));
}

function classifyChunk(chunk) {
  if (chunk.type !== 'code') return chunk;

  const trimmed = chunk.content.trim();

  // Separator: ---, ===, ___, etc.
  if (/^[-=_*]{3,}$/.test(trimmed)) {
    return { ...chunk, type: 'separator' };
  }

  // Instruction markers
  if (
    /^\s*\d+\.\s/.test(trimmed) ||                    // Numbered list
    /^\s*[*-]\s/.test(trimmed) ||                     // Bullet list
    /^(IMPORTANT|NOTE|WARNING|CRITICAL|ALWAYS|NEVER|TODO|FIXME):/i.test(trimmed)
  ) {
    return { ...chunk, type: 'instruction' };
  }

  return chunk;
}
