import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline, reconstructText } from '../../pipeline/index.js';

describe('pipeline', () => {
  it('should process text end-to-end', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const input = 'IMPORTANT: jangan ubah\n\n\nconst x = "hello"; // TODO: fix';
    const chunks = pipeline.run(input);

    const instruction = chunks.find(c => c.type === 'instruction');
    assert.ok(instruction);
    assert.strictEqual(instruction.score, 1.0);
    assert.strictEqual(instruction.compressLevel, 0); // Not compressed

    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.score >= 0.8);
  });

  it('should reconstruct text from chunks', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const input = 'const x = 1;';
    const chunks = pipeline.run(input);
    const output = reconstructText(chunks);
    assert.ok(output.includes('const x = 1;'));
  });

  it('should handle empty input gracefully', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const chunks = pipeline.run('');
    assert.strictEqual(chunks.length, 0);
  });
});
