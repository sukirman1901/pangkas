import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline, reconstructText } from '../../pipeline/index.js';

describe('regression: string literal bug', () => {
  it('should not break URLs in string literals', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const input = 'const url = "https://example.com";';
    const chunks = pipeline.run(input);
    
    const stringLit = chunks.find(c => c.type === 'string_literal');
    assert.ok(stringLit);
    assert.ok(stringLit.content.includes('https://'));
  });

  it('should not break template literals with URLs', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const input = 'const url = `https://api.example.com/v1`;';
    const chunks = pipeline.run(input);
    
    const stringLit = chunks.find(c => c.type === 'string_literal');
    assert.ok(stringLit);
    assert.ok(stringLit.content.includes('https://'));
  });
});
