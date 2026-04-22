import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline, reconstructText } from '../../pipeline/index.js';
import { fixture } from '../fixtures/sample-react-component.js';

describe('benchmark: compression ratio', () => {
  it('should reduce tokens while preserving meaning', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const chunks = pipeline.run(fixture);
    
    const output = reconstructText(chunks);
    
    const originalTokens = Math.ceil(fixture.length / 4);
    const compressedTokens = Math.ceil(output.length / 4);
    const savings = originalTokens - compressedTokens;
    const ratio = savings / originalTokens;
    
    console.log(`Original: ${originalTokens} tokens`);
    console.log(`Compressed: ${compressedTokens} tokens`);
    console.log(`Savings: ${(ratio * 100).toFixed(1)}%`);
    
    // Should save at least 5%
    assert.ok(ratio > 0.05, `Expected >5% savings, got ${(ratio * 100).toFixed(1)}%`);
    
    // Should preserve IMPORTANT comment
    assert.ok(output.includes('IMPORTANT'));
    
    // Should preserve TODO comment
    assert.ok(output.includes('TODO'));
  });
});
