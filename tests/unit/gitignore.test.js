import { test } from 'node:test';
import assert from 'node:assert';
import { ensureGitignore } from '../../memory.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('appends .pangkas/ to existing .gitignore', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-git-'));
  fs.writeFileSync(path.join(tmp, '.gitignore'), 'node_modules/\n');
  ensureGitignore(tmp);
  const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
  assert(content.includes('.pangkas/'));
});

test('creates .gitignore if missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-git-'));
  ensureGitignore(tmp);
  const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
  assert(content.includes('.pangkas/'));
});

test('does not duplicate entry', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-git-'));
  fs.writeFileSync(path.join(tmp, '.gitignore'), '.pangkas/\n');
  ensureGitignore(tmp);
  const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
  const matches = content.match(/\.pangkas\//g);
  assert.strictEqual(matches.length, 1);
});
