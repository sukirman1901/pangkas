import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deduplicateChunks } from '../../pipeline/dedup.js';

describe('dedup', () => {
  it('should mark identical chunks as redundant', () => {
    const messages = [
      [{ type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} }],
      [{ type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} }]
    ];
    const deduped = deduplicateChunks(messages, { dedupThreshold: 0.85 });
    assert.strictEqual(deduped[1][0].isRedundant, true);
  });

  it('should not mark different chunks as redundant', () => {
    const messages = [
      [{ type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} }],
      [{ type: 'code', content: 'function bar() {}', score: 0.6, metadata: {} }]
    ];
    const deduped = deduplicateChunks(messages, { dedupThreshold: 0.85 });
    assert.strictEqual(deduped[1][0].isRedundant, false);
  });

  it('should not dedup within the same message', () => {
    const messages = [
      [
        { type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} },
        { type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} }
      ]
    ];
    const deduped = deduplicateChunks(messages, { dedupThreshold: 0.85 });
    assert.strictEqual(deduped[0][1].isRedundant, false);
  });

  it('should handle single message', () => {
    const messages = [
      [{ type: 'code', content: 'function foo() {}', score: 0.6, metadata: {} }]
    ];
    const deduped = deduplicateChunks(messages, { dedupThreshold: 0.85 });
    assert.strictEqual(deduped[0][0].isRedundant, false);
  });
});
