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

  it('should handle escaped quotes inside string', () => {
    const input = 'const x = "hello \\"world\\"";';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[1].type, 'string_literal');
    assert.ok(chunks[1].content.includes('world'));
  });

  it('should separate line comment from code', () => {
    const input = 'const x = 1; // TODO: fix this';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].type, 'code');
    assert.strictEqual(chunks[1].type, 'comment');
  });

  it('should separate hash comment from code', () => {
    const input = 'x = 1  # TODO: fix this';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].type, 'code');
    assert.strictEqual(chunks[1].type, 'comment');
  });
});
