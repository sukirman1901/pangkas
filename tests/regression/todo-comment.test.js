import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline, reconstructText } from '../../pipeline/index.js';

describe('regression: TODO comment preservation', () => {
  it('should preserve TODO comments', () => {
    const pipeline = createPipeline({ compressionLevel: 0.9 });
    const input = 'const x = 1; // TODO: fix this';
    const chunks = pipeline.run(input);
    
    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.content.includes('TODO'));
    assert.ok(comment.score >= 0.8);
  });

  it('should preserve FIXME comments', () => {
    const pipeline = createPipeline({ compressionLevel: 0.9 });
    const input = 'const x = 1; // FIXME: bug here';
    const chunks = pipeline.run(input);
    
    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.content.includes('FIXME'));
    assert.ok(comment.score >= 0.8);
  });

  it('should preserve NOTE comments', () => {
    const pipeline = createPipeline({ compressionLevel: 0.9 });
    const input = 'const x = 1; // NOTE: important info';
    const chunks = pipeline.run(input);
    
    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.content.includes('NOTE'));
    assert.ok(comment.score >= 0.8);
  });

  it('should not compress important comments aggressively', () => {
    const pipeline = createPipeline({ compressionLevel: 0.9 });
    const input = '// WARNING: Do not change this value';
    const chunks = pipeline.run(input);
    
    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.score >= 0.8);
    assert.ok(comment.content.includes('WARNING'));
  });
});
