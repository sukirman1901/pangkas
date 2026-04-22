import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseChunks } from '../../pipeline/chunker.js';

describe('chunker', () => {
  it('should parse simple string literal', () => {
    const input = 'const x = "hello world";';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].type, 'code');
    assert.strictEqual(chunks[1].type, 'string_literal');
    assert.strictEqual(chunks[2].type, 'code');
  });
});
