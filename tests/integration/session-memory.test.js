import { test } from 'node:test';
import assert from 'node:assert';
import { findProjectRoot } from '../../project-root.js';
import { loadMemory, saveMemory } from '../../memory.js';
import { sanitizeObject } from '../../sanitize.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('full session memory flow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-int-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{}');

  // Simulate plugin init finding root
  const root = findProjectRoot(path.join(tmp, 'src'));
  assert.strictEqual(root, tmp);

  // Simulate saving memory
  saveMemory(root, { sessionSummary: 'Refactored logger' });
  const mem = loadMemory(root);
  assert.strictEqual(mem.sessionSummary, 'Refactored logger');

  // Simulate sanitization
  const dirty = { sessionSummary: 'sk-12345secret' };
  const clean = sanitizeObject(dirty);
  assert(!clean.sessionSummary.includes('sk-12345secret'));

  // Verify .gitignore exists
  const gitignore = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
  assert(gitignore.includes('.pangkas/'));
});
