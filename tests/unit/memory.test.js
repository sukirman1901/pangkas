import { test } from 'node:test';
import assert from 'node:assert';
import { loadMemory, saveMemory, updateMemory } from '../../memory.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('loadMemory returns null when no memory exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-mem-'));
  const result = loadMemory(tmp);
  assert.strictEqual(result, null);
});

test('saveMemory creates .pangkas/memory.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-mem-'));
  saveMemory(tmp, { sessionSummary: 'hello' });
  const data = JSON.parse(fs.readFileSync(path.join(tmp, '.pangkas', 'memory.json'), 'utf8'));
  assert.strictEqual(data.sessionSummary, 'hello');
});

test('updateMemory merges existing data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-mem-'));
  saveMemory(tmp, { sessionSummary: 'old', keyDecisions: ['a'] });
  updateMemory(tmp, { sessionSummary: 'new' });
  const data = loadMemory(tmp);
  assert.strictEqual(data.sessionSummary, 'new');
  assert.deepStrictEqual(data.keyDecisions, ['a']);
});
