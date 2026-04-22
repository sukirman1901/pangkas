import { test } from 'node:test';
import assert from 'node:assert';
import { sanitizeText } from '../../sanitize.js';

test('removes API keys', () => {
  const input = 'My key is sk-abc123xyz789 and token';
  const result = sanitizeText(input);
  assert(!result.includes('sk-abc123xyz789'));
  assert(result.includes('[REDACTED_API_KEY]'));
});

test('removes bearer tokens', () => {
  const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs';
  const result = sanitizeText(input);
  assert(!result.includes('eyJhbGciOiJIUzI1NiIs'));
});

test('leaves safe text untouched', () => {
  const input = 'Refactor logger.js to remove console noise';
  const result = sanitizeText(input);
  assert.strictEqual(result, input);
});
