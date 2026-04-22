import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scoreChunks } from '../../pipeline/scorer.js';

describe('scorer', () => {
  it('should give high score to instruction', () => {
    const chunks = [{ type: 'instruction', content: 'IMPORTANT: jangan ubah', metadata: {} }];
    const scored = scoreChunks(chunks);
    assert.ok(scored[0].score >= 0.9);
  });

  it('should give low score to separator', () => {
    const chunks = [{ type: 'separator', content: '---', metadata: {} }];
    const scored = scoreChunks(chunks);
    assert.ok(scored[0].score <= 0.2);
  });

  it('should give moderate score to code', () => {
    const chunks = [{ type: 'code', content: 'const x = 1;', metadata: {} }];
    const scored = scoreChunks(chunks);
    assert.ok(scored[0].score >= 0.5 && scored[0].score <= 0.7);
  });

  it('should detect TODO comment as important', () => {
    const chunks = [{ type: 'comment', content: '// TODO: fix this bug', metadata: {} }];
    const scored = scoreChunks(chunks);
    assert.ok(scored[0].score >= 0.8);
  });

  it('should detect greeting comment as noise', () => {
    const chunks = [{ type: 'comment', content: '// hello world', metadata: {} }];
    const scored = scoreChunks(chunks);
    assert.ok(scored[0].score <= 0.2);
  });
});
