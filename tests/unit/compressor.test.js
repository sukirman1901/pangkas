import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compressChunks } from '../../pipeline/compressor.js';

describe('adaptive compressor', () => {
  it('should not compress high-score chunk', () => {
    const chunks = [
      { type: 'instruction', content: 'IMPORTANT: jangan ubah ini', score: 1.0, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.5 });
    assert.strictEqual(compressed[0].content, 'IMPORTANT: jangan ubah ini');
  });

  it('should compress low-score chunk aggressively', () => {
    const chunks = [
      { type: 'separator', content: '\n\n\n---\n\n\n', score: 0.1, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.5 });
    assert.ok(compressed[0].content.length < '\n\n\n---\n\n\n'.length);
  });

  it('should calculate compressLevel based on score', () => {
    const chunks = [
      { type: 'instruction', content: 'test', score: 1.0, metadata: {} },
      { type: 'code', content: 'test', score: 0.6, metadata: {} },
      { type: 'separator', content: 'test', score: 0.1, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.5 });
    assert.strictEqual(compressed[0].compressLevel, 0);
    assert.ok(compressed[1].compressLevel > 0 && compressed[1].compressLevel < 0.5);
    assert.ok(compressed[2].compressLevel > 0.4);
  });

  it('should not aggressively compress string literals', () => {
    const chunks = [
      { type: 'string_literal', content: '"hello   world"', score: 0.1, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.9 });
    assert.ok(compressed[0].content.includes('hello   world'));
  });
});
