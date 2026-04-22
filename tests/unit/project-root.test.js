import { test } from 'node:test';
import assert from 'node:assert';
import { findProjectRoot } from '../../project-root.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('findProjectRoot returns cwd when .git exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-test-'));
  fs.mkdirSync(path.join(tmp, '.git'));
  const result = findProjectRoot(path.join(tmp, 'src', 'deep'));
  assert.strictEqual(result, tmp);
});

test('findProjectRoot returns cwd when package.json exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pangkas-test-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
  const result = findProjectRoot(path.join(tmp, 'src'));
  assert.strictEqual(result, tmp);
});

test('findProjectRoot stops at home dir', () => {
  const result = findProjectRoot(os.homedir());
  assert.strictEqual(result, os.homedir());
});
