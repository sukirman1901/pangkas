# Session Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project-scoped session memory to Pangkas so OpenCode can retain context across restarts without polluting the workspace or bloating tokens.

**Architecture:** A lightweight JSON memory store scoped to the detected project root (via `.git`/`package.json`/`AGENTS.md` traversal). Memory is auto-saved after each assistant response, sanitized for secrets, and injected as a short system-message prefix on session startup. All files live inside `.pangkas/` and are auto-ignored via `.gitignore`.

**Tech Stack:** Node.js 20+, native `fs`/`path`, no external DB or embedding models.

---

## Task 1: Project Root Detection Utility

**Files:**
- Create: `project-root.js`
- Test: `tests/unit/project-root.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit/project-root.test.js
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
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/project-root.test.js`
Expected: FAIL with "findProjectRoot is not defined"

**Step 3: Write minimal implementation**

```javascript
// project-root.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT_MARKERS = ['.git', 'package.json', 'AGENTS.md'];
const HOME = os.homedir();

export function findProjectRoot(startPath = process.cwd()) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root && current !== HOME) {
    for (const marker of ROOT_MARKERS) {
      const markerPath = path.join(current, marker);
      try {
        fs.accessSync(markerPath);
        return current;
      } catch {
        // continue
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(startPath);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/project-root.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add project-root.js tests/unit/project-root.test.js
git commit -m "feat: add project root detection utility"
```

---

## Task 2: Memory Module Core (Create / Read / Update)

**Files:**
- Create: `memory.js`
- Test: `tests/unit/memory.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit/memory.test.js
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
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/memory.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// memory.js
import fs from 'fs';
import path from 'path';

const MEMORY_DIR = '.pangkas';
const MEMORY_FILE = 'memory.json';
const CONTEXT_FILE = 'CONTEXT.md';

function getMemoryDir(projectRoot) {
  return path.join(projectRoot, MEMORY_DIR);
}

function getMemoryPath(projectRoot) {
  return path.join(projectRoot, MEMORY_DIR, MEMORY_FILE);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadMemory(projectRoot) {
  const filepath = getMemoryPath(projectRoot);
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveMemory(projectRoot, data) {
  const dir = getMemoryDir(projectRoot);
  ensureDir(dir);
  ensureGitignore(projectRoot);
  const filepath = getMemoryPath(projectRoot);
  const payload = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    projectRoot,
    ...data,
  };
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  updateContextMarkdown(projectRoot, payload);
}

export function updateMemory(projectRoot, patch) {
  const existing = loadMemory(projectRoot) || {};
  const merged = { ...existing, ...patch, lastUpdated: new Date().toISOString() };
  saveMemory(projectRoot, merged);
}

export function updateContextMarkdown(projectRoot, data) {
  const dir = getMemoryDir(projectRoot);
  ensureDir(dir);
  const mdPath = path.join(dir, CONTEXT_FILE);
  const lines = [
    '# Pangkas Session Context',
    '',
    `> Auto-generated by Pangkas. Last updated: ${data.lastUpdated || new Date().toISOString()}`,
    '',
    '## Current Focus',
    data.recentFocus || 'N/A',
    '',
    '## Recent Session Summary',
    data.sessionSummary || 'N/A',
    '',
    '## Key Decisions',
  ];
  const decisions = Array.isArray(data.keyDecisions) ? data.keyDecisions : [];
  if (decisions.length === 0) {
    lines.push('- None yet');
  } else {
    for (const d of decisions) {
      lines.push(`- ${d}`);
    }
  }
  lines.push('');
  lines.push('## Files Being Modified');
  const files = Array.isArray(data.filesModified) ? data.filesModified : [];
  if (files.length === 0) {
    lines.push('- N/A');
  } else {
    for (const f of files) {
      lines.push(`- \`${f}\``);
    }
  }
  lines.push('');
  fs.writeFileSync(mdPath, lines.join('\n'));
}

export function ensureGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const entry = '.pangkas/';
  let content = '';
  try {
    content = fs.readFileSync(gitignorePath, 'utf8');
  } catch {
    // file does not exist
  }
  if (content.includes(entry)) return;
  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, `${content}${separator}${entry}\n`);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/memory.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add memory.js tests/unit/memory.test.js
git commit -m "feat: add project-scoped memory module"
```

---

## Task 3: Secret Sanitization

**Files:**
- Create: `sanitize.js`
- Test: `tests/unit/sanitize.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit/sanitize.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { sanitizeText } from '../../sanitize.js';

test('removes API keys', () => {
  const input = 'My key is sk-abc123xyz789 and token';
  const result = sanitizeText(input);
  assert(!result.includes('sk-abc123xyz789'));
  assert(result.includes('[REDACTED]'));
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
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/sanitize.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// sanitize.js
// Redacts common secret patterns before persisting memory to disk

const SECRET_PATTERNS = [
  // OpenAI / Anthropic API keys
  { regex: /sk-[a-zA-Z0-9]{20,}/g, label: 'API_KEY' },
  // Generic bearer tokens
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, label: 'BEARER_TOKEN' },
  // JWT-ish tokens
  { regex: /eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*/g, label: 'JWT_TOKEN' },
  // Password assignments
  { regex: /password\s*[:=]\s*\S+/gi, label: 'PASSWORD' },
  // AWS keys
  { regex: /AKIA[0-9A-Z]{16}/g, label: 'AWS_KEY' },
  // Private keys (beginning marker)
  { regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g, label: 'PRIVATE_KEY' },
];

export function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text;
  for (const { regex, label } of SECRET_PATTERNS) {
    cleaned = cleaned.replace(regex, `[REDACTED_${label}]`);
  }
  return cleaned;
}

export function sanitizeObject(obj) {
  if (typeof obj === 'string') return sanitizeText(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeObject(v);
    }
    return out;
  }
  return obj;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/sanitize.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add sanitize.js tests/unit/sanitize.test.js
git commit -m "feat: add secret sanitization for memory persistence"
```

---

## Task 4: Auto .gitignore

**Files:**
- Modify: `memory.js` (already contains ensureGitignore from Task 2)
- Test: `tests/unit/gitignore.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit/gitignore.test.js
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
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/gitignore.test.js`
Expected: FAIL (ensureGitignore not exported) — but it IS exported in Task 2, so this should PASS if Task 2 is done.

**Step 3: Verify ensureGitignore is called in saveMemory**

Open `memory.js` and confirm `ensureGitignore(projectRoot)` is called inside `saveMemory` right after `ensureDir(dir)`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/gitignore.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/gitignore.test.js
git commit -m "test: verify auto-gitignore behavior"
```

---

## Task 5: Memory Injection Hook

**Files:**
- Modify: `index.js` (plugin init)
- Modify: `config.js` (add new defaults)

**Step 1: Add config defaults**

In `config.js`, add to the `defaults` object:

```javascript
    // --- Session Memory ---
    enableSessionMemory: true,
    maxMemoryInjectLength: 500,
    memoryInjectIndicator: true,
```

And add env overrides in the `env` object:

```javascript
    enableSessionMemory: process.env.PANGKAS_SESSION_MEMORY === 'false' ? false : undefined,
    maxMemoryInjectLength: process.env.PANGKAS_MEMORY_LENGTH ? Number(process.env.PANGKAS_MEMORY_LENGTH) : undefined,
```

**Step 2: Modify index.js init**

Insert after `import { startDashboard } from "./dashboard.js";`:

```javascript
import { findProjectRoot } from './project-root.js';
import { loadMemory } from './memory.js';
```

Inside `PangkasPlugin`, after `const config = getPangkasConfig();`, add:

```javascript
  // Determine project root for memory scoping
  const projectRoot = findProjectRoot();
  
  // Load and inject session memory if enabled
  if (config.enableSessionMemory !== false) {
    const memory = loadMemory(projectRoot);
    if (memory && memory.sessionSummary && ctx.messages && Array.isArray(ctx.messages)) {
      const rawSummary = memory.sessionSummary;
      const clamped = rawSummary.length > config.maxMemoryInjectLength
        ? rawSummary.slice(0, config.maxMemoryInjectLength) + '...'
        : rawSummary;
      const indicator = config.memoryInjectIndicator
        ? '[Loaded context from previous session]\n'
        : '';
      const contextMsg = {
        role: 'system',
        content: `${indicator}${clamped}`,
        _pangkas_injected_memory: true,
      };
      // Insert after the first system message, or prepend if none
      const firstSystemIdx = ctx.messages.findIndex(m => m.role === 'system');
      if (firstSystemIdx >= 0) {
        ctx.messages.splice(firstSystemIdx + 1, 0, contextMsg);
      } else {
        ctx.messages.unshift(contextMsg);
      }
    }
  }
```

**Step 3: Verify syntax**

Run: `node --check index.js`
Expected: No output (success)

**Step 4: Commit**

```bash
git add index.js config.js
git commit -m "feat: inject previous session memory on plugin init"
```

---

## Task 6: Auto-Save Hook (After Response)

**Files:**
- Modify: `index.js` (add afterResponse helper)

**Step 1: Add imports**

At the top of `index.js`, add:

```javascript
import { updateMemory } from './memory.js';
import { sanitizeObject } from './sanitize.js';
```

**Step 2: Add memory update helper**

Append this function to `index.js` before the plugin export:

```javascript
function summarizeSession(messages) {
  if (!messages || messages.length === 0) return '';
  // Grab the last user message as the "current focus"
  const lastUser = messages.slice().reverse().find(m => m.role === 'user');
  const text = lastUser && lastUser.parts
    ? lastUser.parts.map(p => (typeof p === 'string' ? p : p.text || '')).join(' ')
    : '';
  return text.slice(0, 300);
}

function persistMemory(projectRoot, ctx) {
  const summary = summarizeSession(ctx.messages);
  if (!summary) return;
  const patch = sanitizeObject({
    sessionSummary: summary,
    recentFocus: summary,
    filesModified: [],
  });
  updateMemory(projectRoot, patch);
}
```

**Step 3: Wire into hooks**

Inside `"experimental.chat.messages.transform"`, after `output.messages = messages;`, append:

```javascript
      // Persist session memory if assistant message exists
      if (config.enableSessionMemory !== false) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          persistMemory(projectRoot, ctx);
        }
      }
```

**Step 4: Verify syntax**

Run: `node --check index.js`
Expected: No output (success)

**Step 5: Commit**

```bash
git add index.js
git commit -m "feat: auto-save session memory after assistant response"
```

---

## Task 7: Integration Test

**Files:**
- Create: `tests/integration/session-memory.test.js`

**Step 1: Write the test**

```javascript
// tests/integration/session-memory.test.js
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
```

**Step 2: Run test**

Run: `node --test tests/integration/session-memory.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/session-memory.test.js
git commit -m "test: add session memory integration test"
```

---

## Task 8: Update README

**Files:**
- Modify: `README.md`

**Step 1: Add Session Memory section**

Insert this section after `## v3 Pipeline (Context-Aware)`:

```markdown
---

## Session Memory (New)

Pangkas can remember the context of your previous session so you don't lose track after restarting OpenCode.

### How It Works

1. After each assistant response, Pangkas saves a short summary to `.pangkas/memory.json` inside your project root.
2. The `.pangkas/` folder is automatically added to `.gitignore` so it never leaks to GitHub.
3. When you reopen the same project, Pangkas injects the summary into the first system message.
4. All persisted text is sanitized to remove API keys, tokens, and passwords.

### Configuration

| File Key | Environment Variable | Default | Description |
|----------|---------------------|---------|-------------|
| `enableSessionMemory` | `PANGKAS_SESSION_MEMORY` | `true` | Enable session memory |
| `maxMemoryInjectLength` | `PANGKAS_MEMORY_LENGTH` | `500` | Max characters injected into prompt |
| `memoryInjectIndicator` | — | `true` | Show "[Loaded context...]" indicator |

### Privacy & Security

- Memory is stored **locally** only (no cloud).
- Secrets are redacted before saving (API keys, Bearer tokens, JWTs, passwords).
- The `.pangkas/` directory is auto-ignored by Git.
- You can delete `.pangkas/` at any time to reset memory.

### Disabling Memory

```jsonc
{
  "enableSessionMemory": false
}
```
```

**Step 2: Update config table**

Add the three new rows to the existing configuration table in README.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document session memory feature"
```

---

## Task 9: Final Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All suites PASS

**Step 2: Run syntax check on all modified/new files**

Run: `node --check index.js && node --check memory.js && node --check project-root.js && node --check sanitize.js && node --check config.js`
Expected: No output (all success)

**Step 3: Commit any final fixes**

If tests fail, fix and commit with `git commit -m "fix: address session memory edge cases"`.

**Step 4: Push**

```bash
git push
```

---

## Risks & Mitigations

| Risk | Mitigation in Plan |
|------|-------------------|
| File pollution | Store inside `.pangkas/` subfolder |
| Accidental git commit | Auto-append `.pangkas/` to `.gitignore` |
| Secret leakage | `sanitize.js` redacts API keys, tokens, passwords before save |
| Prompt bloat | `maxMemoryInjectLength` clamps injected text; defaults to 500 chars |
| Stale context | Only last user message is saved as "recent focus" (lightweight) |
| User confusion | `memoryInjectIndicator` adds visible tag so user knows context loaded |
| Wrong project root | `findProjectRoot` traverses up looking for `.git` / `package.json` / `AGENTS.md` |
| Crash before save | We save after assistant response (end of turn), not after every keystroke |

---

**Plan complete and saved to `docs/plans/2025-04-23-session-memory.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
