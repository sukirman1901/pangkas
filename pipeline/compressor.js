export function compressChunks(chunks, config) {
  if (!Array.isArray(chunks)) return chunks;
  const globalLevel = config?.compressionLevel ?? 0.3;

  return chunks.map(chunk => {
    const level = getCompressionLevel(chunk.score, globalLevel);
    const compressed = compressChunk(chunk.content, level, chunk.type);

    return {
      ...chunk,
      content: compressed,
      compressLevel: level
    };
  });
}

function getCompressionLevel(chunkScore, globalLevel) {
  const adjusted = globalLevel * (1 - chunkScore);
  return Math.max(0, Math.min(1, adjusted));
}

function compressChunk(content, level, type) {
  if (!content || typeof content !== 'string') return content;
  if (level <= 0) return content;

  // Never compress string literals aggressively
  if (type === 'string_literal' && level > 0.3) {
    level = 0.3;
  }

  let compressed = content;

  // Level 1 (0.1-0.3): Conservative
  if (level > 0.1) {
    compressed = compressed
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
  }

  // Level 2 (0.3-0.5): Moderate
  if (level > 0.3) {
    compressed = compressed.replace(/[ \t]{2,}/g, ' ');
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
  }

  // Level 3 (0.5-0.7): Aggressive
  if (level > 0.5) {
    compressed = compressed
      .replace(/\s*([,;:])\s*/g, '$1 ')
      .replace(/\s*([\(\[\{])\s*/g, '$1')
      .replace(/\s*([\)\]\}])\s*/g, '$1');
  }

  // Level 4 (0.7-1.0): Very aggressive
  if (level > 0.7) {
    const lines = compressed.split('\n');
    compressed = lines.map(line => {
      if (line.length < 80) {
        return line.replace(/\s+/g, ' ').trim();
      }
      return line;
    }).join('\n');
  }

  return compressed;
}
