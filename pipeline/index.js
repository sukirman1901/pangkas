import { parseChunks } from './chunker.js';
import { scoreChunks } from './scorer.js';
import { compressChunks } from './compressor.js';
import { deduplicateChunks } from './dedup.js';

// Simple logger that doesn't depend on external modules
function logStats(stats) {
  // Log hanya ke file lewat logger.js utama, tidak ke console terminal
  // Silakan impor logStats dari ../logger.js jika ingin menyimpan ke file
}

export function createPipeline(config) {
  return {
    run(text) {
      try {
        if (!text || typeof text !== 'string') return [];
        
        const chunks = parseChunks(text);
        const scored = scoreChunks(chunks);
        const compressed = compressChunks(scored, config);
        return compressed;
      } catch (err) {
        logStats({ event: 'pipeline_error', error: err.message, fallback: 'original_text' });
        return [{ 
          type: 'unknown', 
          content: text, 
          score: 1.0, 
          compressLevel: 0.0,
          metadata: { lineStart: 1, lineEnd: 1 }
        }];
      }
    },

    deduplicate(messagesChunks) {
      try {
        return deduplicateChunks(messagesChunks, config);
      } catch (err) {
        logStats({ event: 'dedup_error', error: err.message });
        return messagesChunks;
      }
    }
  };
}

export function reconstructText(chunks) {
  if (!Array.isArray(chunks)) return '';
  return chunks
    .filter(c => !c.isRedundant)
    .map(c => c.content)
    .join('');
}
