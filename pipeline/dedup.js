export function deduplicateChunks(messagesChunks, config) {
  if (!Array.isArray(messagesChunks) || messagesChunks.length < 2) {
    return messagesChunks.map(chunks =>
      chunks.map(c => ({ ...c, isRedundant: false }))
    );
  }

  const threshold = config?.dedupThreshold ?? 0.85;
  const result = messagesChunks.map(chunks =>
    chunks.map(c => ({ ...c, isRedundant: false }))
  );

  // Compare each message's chunks with previous messages
  for (let i = 1; i < result.length; i++) {
    for (const chunk of result[i]) {
      if (chunk.type === 'separator' || chunk.type === 'unknown') continue;

      for (let j = 0; j < i; j++) {
        for (const prevChunk of result[j]) {
          if (chunk.type !== prevChunk.type) continue;

          const sim = jaccardSimilarity(chunk.content, prevChunk.content);
          if (sim >= threshold) {
            chunk.isRedundant = true;
            break;
          }
        }
        if (chunk.isRedundant) break;
      }
    }
  }

  return result;
}

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(getNgrams(a.toLowerCase(), 3));
  const setB = new Set(getNgrams(b.toLowerCase(), 3));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function getNgrams(text, n) {
  const ngrams = [];
  for (let i = 0; i <= text.length - n; i++) {
    ngrams.push(text.substring(i, i + n));
  }
  return ngrams;
}
