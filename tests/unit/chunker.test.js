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

  it('should detect instruction markers', () => {
    const input = '1. **Important**: Jangan ubah ini\n2. Lanjutkan';
    const chunks = parseChunks(input);
    const instruction = chunks.find(c => c.type === 'instruction');
    assert.ok(instruction);
    assert.ok(instruction.content.includes('Jangan ubah'));
  });

  it('should detect separator', () => {
    const input = 'foo\n---\nbar';
    const chunks = parseChunks(input);
    const sep = chunks.find(c => c.type === 'separator');
    assert.ok(sep);
  });

  it('should track line numbers', () => {
    const input = 'line1\nline2\nline3';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks[0].metadata.lineStart, 1);
    assert.strictEqual(chunks[0].metadata.lineEnd, 1);
    assert.strictEqual(chunks[1].metadata.lineStart, 2);
    assert.strictEqual(chunks[1].metadata.lineEnd, 2);
  });

  it('should track multi-line string literal line numbers', () => {
    const input = 'const x = "line1\nline2\nline3";';
    const chunks = parseChunks(input);
    const stringLit = chunks.find(c => c.type === 'string_literal');
    assert.ok(stringLit);
    assert.strictEqual(stringLit.metadata.lineStart, 1);
    assert.strictEqual(stringLit.metadata.lineEnd, 3);
  });
});
