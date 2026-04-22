# Smart Fact Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace flat text summaries with structured, typed facts in Pangkas Session Memory v2.0

**Architecture:** Create a new `fact-extractor.js` module with rule-based extraction, refactor `memory.js` to store/retrieve facts instead of summaries, update `index.js` to inject formatted facts into system prompts.

**Tech Stack:** Node.js, ES Modules, no external dependencies

---

## Prerequisites

- [ ] Read `docs/plans/2026-04-23-smart-fact-extraction-design.md`
- [ ] Ensure you're in the project root: `/Users/aaa/Documents/Developer/pangkas/pangkas`
- [ ] Node.js available for testing

---

## File Inventory (What Exists Now)

```
pangkas/
├── index.js              # Main plugin - needs update
├── memory.js             # Memory storage - needs refactor
├── config.js             # Config loader - needs update
├── dashboard.js          # Web dashboard - needs update
├── sanitize.js           # Secret sanitizer - verify compatibility
├── project-root.js       # Project root finder - no changes
├── logger.js             # Logging - no changes
└── legacy/               # Legacy code - no changes
```

---

## Task 1: Create `fact-extractor.js` Core Module

**Files:**
- Create: `fact-extractor.js`
- Test: `tests/fact-extractor.test.js`

**Step 1: Write the failing test**

Create `tests/fact-extractor.test.js`:

```javascript
import { describe, test, expect } from '@jest/globals';
import { extractFacts, mergeFacts, getRelevantFacts, formatFactsForPrompt } from '../fact-extractor.js';

describe('extractFacts', () => {
  test('detects decisions from text', () => {
    const messages = [
      { role: 'user', parts: [{ text: 'Kita putuskan pakai SQLite untuk database' }] }
    ];
    const facts = extractFacts(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].type).toBe('decision');
    expect(facts[0].content).toContain('SQLite');
  });

  test('detects todos', () => {
    const messages = [
      { role: 'assistant', parts: [{ text: 'Next kita perlu fix bug di dashboard' }] }
    ];
    const facts = extractFacts(messages);
    const todo = facts.find(f => f.type === 'todo');
    expect(todo).toBeDefined();
    expect(todo.content).toContain('fix bug');
  });

  test('detects files', () => {
    const messages = [
      { role: 'user', parts: [{ text: 'Saya edit file dashboard.js dan index.js' }] }
    ];
    const facts = extractFacts(messages);
    const files = facts.filter(f => f.type === 'file');
    expect(files.length).toBe(2);
  });
});

describe('mergeFacts', () => {
  test('updates existing fact sessionCount', () => {
    const existing = [
      { id: '1', type: 'todo', content: 'Fix bug A', sessionCount: 1, isLatest: true }
    ];
    const extracted = [
      { type: 'todo', content: 'Fix bug A' }
    ];
    const merged = mergeFacts(existing, extracted);
    expect(merged[0].sessionCount).toBe(2);
  });

  test('marks old facts as not latest when contradicted', () => {
    const existing = [
      { id: '1', type: 'todo', content: 'Fix bug A', isLatest: true }
    ];
    const extracted = [
      { type: 'done', content: 'Fix bug A' }
    ];
    const merged = mergeFacts(existing, extracted);
    expect(merged[0].isLatest).toBe(false);
    expect(merged[1].type).toBe('done');
    expect(merged[1].isLatest).toBe(true);
  });
});

describe('getRelevantFacts', () => {
  test('limits to max facts', () => {
    const facts = Array(20).fill(null).map((_, i) => ({
      type: 'todo',
      content: `Task ${i}`,
      confidence: 0.8,
      isLatest: true
    }));
    const relevant = getRelevantFacts(facts, { limit: 7 });
    expect(relevant.length).toBe(7);
  });

  test('prioritizes bugs over todos', () => {
    const facts = [
      { type: 'todo', content: 'Task A', confidence: 0.9, isLatest: true },
      { type: 'bug', content: 'Bug B', confidence: 0.8, isLatest: true }
    ];
    const relevant = getRelevantFacts(facts, { limit: 1 });
    expect(relevant[0].type).toBe('bug');
  });
});

describe('formatFactsForPrompt', () => {
  test('formats facts into readable text', () => {
    const facts = [
      { type: 'bug', content: 'Crash on null' },
      { type: 'todo', content: 'Add tests' }
    ];
    const text = formatFactsForPrompt(facts);
    expect(text).toContain('[BUG]');
    expect(text).toContain('[TODO]');
    expect(text).toContain('Crash on null');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/aaa/Documents/Developer/pangkas/pangkas
node --test tests/fact-extractor.test.js
```

**Expected:** FAIL with "Cannot find module '../fact-extractor.js'"

**Step 3: Create `fact-extractor.js` with minimal implementation**

```javascript
import { randomUUID } from 'crypto';

export const FACT_TYPES = {
  DECISION: 'decision',
  TODO: 'todo',
  DONE: 'done',
  FILE: 'file',
  BUG: 'bug',
  PREFERENCE: 'preference',
  QUESTION: 'question',
};

export const PRIORITY_ORDER = [
  FACT_TYPES.BUG,
  FACT_TYPES.TODO,
  FACT_TYPES.DECISION,
  FACT_TYPES.PREFERENCE,
  FACT_TYPES.QUESTION,
  FACT_TYPES.FILE,
  FACT_TYPES.DONE,
];

/**
 * Extract facts from conversation messages
 */
export function extractFacts(messages, existingFacts = []) {
  if (!messages || !Array.isArray(messages)) return [];
  
  const text = extractTextFromMessages(messages);
  const extracted = [];
  
  // Rule-based extraction
  extracted.push(...extractDecisions(text));
  extracted.push(...extractTodos(text));
  extracted.push(...extractFiles(text));
  extracted.push(...extractBugs(text));
  extracted.push(...extractPreferences(text));
  extracted.push(...extractQuestions(text));
  
  return extracted;
}

function extractTextFromMessages(messages) {
  return messages
    .filter(m => m.parts && Array.isArray(m.parts))
    .map(m => m.parts.map(p => typeof p === 'string' ? p : p.text || '').join(' '))
    .join('\n');
}

function extractDecisions(text) {
  const facts = [];
  const patterns = [
    /(?:kita\s+)?(?:putuskan|memutuskan|decide|pilih|gunakan|pakai|menggunakan)\s+(.{10,150})/gi,
    /(?:akan\s+)?(?:menggunakan|memakai|pakai)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.DECISION, match[1].trim()));
    }
  }
  return facts;
}

function extractTodos(text) {
  const facts = [];
  const patterns = [
    /(?:nanti|next|berikutnya|perlu|harus|should|need to)\s+(.{10,150})/gi,
    /(?:todo|task|fitur)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.TODO, match[1].trim()));
    }
  }
  return facts;
}

function extractFiles(text) {
  const facts = [];
  const filePattern = /[\w-]+\.(js|ts|jsx|tsx|py|go|rs|java|rb|php|css|html|json|md|yml|yaml)/gi;
  let match;
  
  while ((match = filePattern.exec(text)) !== null) {
    facts.push(createFact(FACT_TYPES.FILE, match[0]));
  }
  return facts;
}

function extractBugs(text) {
  const facts = [];
  const patterns = [
    /(?:bug|error|crash|fail|broken|issue)\s+(.{10,150})/gi,
    /(?:tidak\s+)?(?:berhasil|work|jalan|fungsi)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.BUG, match[1].trim()));
    }
  }
  return facts;
}

function extractPreferences(text) {
  const facts = [];
  const patterns = [
    /(?:saya\s+)?(?:prefer|suka|lebih\s+suka|preferensi)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.PREFERENCE, match[1].trim()));
    }
  }
  return facts;
}

function extractQuestions(text) {
  const facts = [];
  const pattern = /(?:\?|apakah|bagaimana|mengapa|kenapa|what|how|why)\s+(.{10,150}\?)/gi;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    facts.push(createFact(FACT_TYPES.QUESTION, match[1].trim()));
  }
  return facts;
}

function createFact(type, content) {
  return {
    id: randomUUID(),
    type,
    content: content.slice(0, 150),
    confidence: 0.7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionCount: 1,
    isLatest: true,
  };
}

/**
 * Merge extracted facts with existing, handling duplicates
 */
export function mergeFacts(existing, extracted) {
  const merged = [...existing];
  
  for (const newFact of extracted) {
    const duplicate = findDuplicate(newFact, merged);
    if (duplicate) {
      updateExisting(duplicate, newFact);
    } else {
      merged.push(newFact);
    }
  }
  
  return merged;
}

function findDuplicate(fact, existing) {
  return existing.find(e => 
    e.type === fact.type && 
    similarity(e.content, fact.content) > 0.8
  );
}

function similarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return intersection.length / Math.max(wordsA.size, wordsB.size);
}

function updateExisting(existing, newFact) {
  existing.sessionCount += 1;
  existing.updatedAt = new Date().toISOString();
  existing.confidence = Math.max(existing.confidence, newFact.confidence);
  
  // Handle state transitions
  if (existing.type === FACT_TYPES.TODO && newFact.type === FACT_TYPES.DONE) {
    existing.isLatest = false;
    return createFact(FACT_TYPES.DONE, existing.content);
  }
  
  return null;
}

/**
 * Get relevant facts for injection, sorted by priority
 */
export function getRelevantFacts(allFacts, options = {}) {
  const {
    limit = 7,
    types = null,
    excludeDone = true,
  } = options;
  
  let filtered = allFacts.filter(f => f.isLatest);
  
  if (excludeDone) {
    filtered = filtered.filter(f => f.type !== FACT_TYPES.DONE);
  }
  
  if (types) {
    filtered = filtered.filter(f => types.includes(f.type));
  }
  
  // Sort by priority order
  filtered.sort((a, b) => {
    const priorityA = PRIORITY_ORDER.indexOf(a.type);
    const priorityB = PRIORITY_ORDER.indexOf(b.type);
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // Then by confidence
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    
    // Then by recency
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  return filtered.slice(0, limit);
}

/**
 * Format facts for injection into system prompt
 */
export function formatFactsForPrompt(facts) {
  if (!facts || facts.length === 0) return '';
  
  const lines = facts.map(f => {
    const prefix = `[${f.type.toUpperCase()}]`;
    return `${prefix} ${f.content}`;
  });
  
  return '[Session Context]\n' + lines.join('\n');
}
```

**Step 4: Run tests**

```bash
node --test tests/fact-extractor.test.js
```

**Expected:** All tests PASS

**Step 5: Commit**

```bash
git add fact-extractor.js tests/fact-extractor.test.js
git commit -m "feat: add fact extraction engine with rule-based extraction

- Extract facts from conversations (decision, todo, file, bug, preference, question)
- Merge with existing facts, handling duplicates
- Get relevant facts with priority sorting
- Format facts for prompt injection"
```

---

## Task 2: Refactor `memory.js` for Fact Storage

**Files:**
- Modify: `memory.js`
- Test: `tests/memory.test.js` (update existing)

**Step 1: Read current `memory.js`**

```bash
cat /Users/aaa/Documents/Developer/pangkas/pangkas/memory.js
```

**Step 2: Refactor `memory.js`**

Replace entire file with:

```javascript
import fs from 'fs';
import path from 'path';
import { extractFacts, mergeFacts, getRelevantFacts, formatFactsForPrompt } from './fact-extractor.js';

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

// v2.0: Load facts-based memory
export function loadMemory(projectRoot) {
  const filepath = getMemoryPath(projectRoot);
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(raw);
    
    // Handle v1.x migration (ignore old format)
    if (!data.version || data.version !== '2.0') {
      return null; // Will start fresh
    }
    
    return data;
  } catch {
    return null;
  }
}

// v2.0: Save facts
export function saveFacts(projectRoot, facts) {
  const dir = getMemoryDir(projectRoot);
  ensureDir(dir);
  ensureGitignore(projectRoot);
  
  const filepath = getMemoryPath(projectRoot);
  const payload = {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    projectRoot,
    facts,
  };
  
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  updateContextMarkdown(projectRoot, payload);
}

// Get facts for injection
export function getFactsForInjection(projectRoot, options = {}) {
  const memory = loadMemory(projectRoot);
  if (!memory || !memory.facts) return null;
  
  const relevant = getRelevantFacts(memory.facts, options);
  if (relevant.length === 0) return null;
  
  return formatFactsForPrompt(relevant);
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
    '## Facts',
  ];
  
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const activeFacts = facts.filter(f => f.isLatest);
  
  if (activeFacts.length === 0) {
    lines.push('- No active facts');
  } else {
    for (const f of activeFacts) {
      lines.push(`- **[${f.type.toUpperCase()}]** ${f.content}`);
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

// Legacy support (deprecated)
export function saveMemory(projectRoot, data) {
  console.warn('saveMemory() is deprecated, use saveFacts() instead');
  // Convert old format to facts if needed
  const facts = [];
  if (data.sessionSummary) {
    facts.push({
      id: 'legacy-1',
      type: 'decision',
      content: data.sessionSummary.slice(0, 150),
      confidence: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionCount: 1,
      isLatest: true,
    });
  }
  saveFacts(projectRoot, facts);
}
```

**Step 3: Update test**

Create/update `tests/memory.test.js`:

```javascript
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadMemory, saveFacts, getFactsForInjection } from '../memory.js';

describe('memory v2.0', () => {
  const testDir = path.join(os.tmpdir(), 'pangkas-test-' + Date.now());
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('saves and loads facts', () => {
    const facts = [
      { id: '1', type: 'todo', content: 'Fix bug', confidence: 0.9, isLatest: true }
    ];
    saveFacts(testDir, facts);
    const loaded = loadMemory(testDir);
    expect(loaded.version).toBe('2.0');
    expect(loaded.facts).toHaveLength(1);
    expect(loaded.facts[0].content).toBe('Fix bug');
  });

  test('ignores v1.x format', () => {
    const v1Data = { sessionSummary: 'Old format', version: '1.0' };
    fs.mkdirSync(path.join(testDir, '.pangkas'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.pangkas', 'memory.json'), JSON.stringify(v1Data));
    const loaded = loadMemory(testDir);
    expect(loaded).toBeNull();
  });

  test('formats facts for injection', () => {
    const facts = [
      { id: '1', type: 'bug', content: 'Crash', confidence: 0.9, isLatest: true }
    ];
    saveFacts(testDir, facts);
    const text = getFactsForInjection(testDir);
    expect(text).toContain('[BUG]');
    expect(text).toContain('Crash');
  });
});
```

**Step 4: Run tests**

```bash
node --test tests/memory.test.js
```

**Expected:** All PASS

**Step 5: Commit**

```bash
git add memory.js tests/memory.test.js
git commit -m "refactor: memory.js to v2.0 with fact-based storage

- Replace summary-based with facts-based storage
- Add getFactsForInjection() for prompt formatting
- Handle v1.x migration (ignore old format)
- Update CONTEXT.md generation for facts"
```

---

## Task 3: Update `index.js` to Inject Facts

**Files:**
- Modify: `index.js`
- Read: `config.js` (check current config keys)

**Step 1: Read relevant parts of `index.js`**

```bash
sed -n '95,145p' /Users/aaa/Documents/Developer/pangkas/pangkas/index.js
```

**Step 2: Update injection logic**

Find the block that injects memory (around line 116-138) and replace:

```javascript
// BEFORE (summary-based)
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
  // ... rest of injection
}

// AFTER (fact-based)
import { getFactsForInjection } from './memory.js';

// ... inside plugin init
if (config.enableSessionMemory !== false) {
  const factsText = getFactsForInjection(projectRoot, {
    limit: config.maxFactsToInject || 7,
    excludeDone: true,
  });
  
  if (factsText && ctx.messages && Array.isArray(ctx.messages)) {
    const indicator = config.memoryInjectIndicator
      ? '[Loaded context from previous sessions]\n'
      : '';
    const contextMsg = {
      role: 'system',
      content: `${indicator}${factsText}`,
      _pangkas_injected_memory: true,
    };
    
    const firstSystemIdx = ctx.messages.findIndex(m => m.role === 'system');
    if (firstSystemIdx >= 0) {
      ctx.messages.splice(firstSystemIdx + 1, 0, contextMsg);
    } else {
      ctx.messages.unshift(contextMsg);
    }
  }
}
```

**Step 3: Update persistMemory function**

Find `persistMemory` function (around line 88-106) and replace:

```javascript
function persistMemory(projectRoot, ctx) {
  const messages = ctx.messages || [];
  const extracted = extractFacts(messages);
  
  if (extracted.length === 0) return;
  
  const memory = loadMemory(projectRoot);
  const existing = memory?.facts || [];
  const merged = mergeFacts(existing, extracted);
  
  saveFacts(projectRoot, merged);
}
```

**Step 4: Add import at top**

```javascript
import { extractFacts, mergeFacts } from './fact-extractor.js';
import { loadMemory, saveFacts, getFactsForInjection } from './memory.js';
```

**Step 5: Commit**

```bash
git add index.js
git commit -m "feat: inject structured facts instead of flat summaries

- Replace summary injection with fact-based injection
- Use getFactsForInjection() with configurable limit
- Update persistMemory to extract and save facts
- More granular, token-efficient context loading"
```

---

## Task 4: Update `config.js`

**Files:**
- Modify: `config.js`

**Step 1: Add fact extraction config**

Find defaults object and add:

```javascript
// --- Fact Extraction (v2.0) ---
enableFactExtraction: true,
maxFactsToInject: 7,
minFactConfidence: 0.6,
factPriorityOrder: ['bug', 'todo', 'decision', 'preference', 'question', 'file', 'done'],
archiveDoneAfterSessions: 3,
maxFactContentLength: 150,
```

**Step 2: Add env vars**

```javascript
enableFactExtraction: process.env.PANGKAS_FACTS === 'false' ? false : undefined,
maxFactsToInject: process.env.PANGKAS_MAX_FACTS ? Number(process.env.PANGKAS_MAX_FACTS) : undefined,
```

**Step 3: Commit**

```bash
git add config.js
git commit -m "config: add fact extraction settings (v2.0)

- enableFactExtraction, maxFactsToInject
- minFactConfidence, factPriorityOrder
- archiveDoneAfterSessions, maxFactContentLength
- Environment variable support"
```

---

## Task 5: Update Dashboard Memory Tab

**Files:**
- Modify: `dashboard.js`

**Step 1: Update Memory page HTML**

Replace the Memory page section to show facts grouped by type:

```javascript
// In the HTML template, update the Memory page:
<div class="page" id="page-memory">
  <h1 class="page-title">Session Memory</h1>
  <p class="page-subtitle">Structured facts from previous sessions</p>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Facts</div>
      <div class="stat-value" id="mem-total">-</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active</div>
      <div class="stat-value success" id="mem-active">-</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Bugs</div>
      <div class="stat-value" id="mem-bugs">-</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Todos</div>
      <div class="stat-value" id="mem-todos">-</div>
    </div>
  </div>

  <div id="mem-facts-container"></div>
</div>
```

**Step 2: Update loadMemory() JS function**

Replace `loadMemory()` in dashboard.js:

```javascript
async function loadMemory() {
  try {
    const res = await fetch('/api/memory');
    const data = await res.json();

    if (!data.hasMemory || !data.facts) {
      document.getElementById('mem-total').textContent = '0';
      document.getElementById('mem-active').textContent = '0';
      return;
    }

    const facts = data.facts.filter(f => f.isLatest);
    document.getElementById('mem-total').textContent = data.facts.length;
    document.getElementById('mem-active').textContent = facts.length;
    document.getElementById('mem-bugs').textContent = facts.filter(f => f.type === 'bug').length;
    document.getElementById('mem-todos').textContent = facts.filter(f => f.type === 'todo').length;

    // Group facts by type
    const grouped = {};
    for (const f of facts) {
      if (!grouped[f.type]) grouped[f.type] = [];
      grouped[f.type].push(f);
    }

    let html = '';
    const typeOrder = ['bug', 'todo', 'decision', 'preference', 'question', 'file'];
    for (const type of typeOrder) {
      if (!grouped[type]) continue;
      const icon = getTypeIcon(type);
      html += `
        <div class="card">
          <div class="form-item">
            <div class="form-label">
              <div class="form-icon">${icon}</div>
              <div class="form-text">
                <h4>${type.toUpperCase()} (${grouped[type].length})</h4>
              </div>
            </div>
          </div>
          <div class="mem-list">
            ${grouped[type].map(f => `
              <div class="mem-item">
                <span>${escapeHtml(f.content)}</span>
                <span style="color:var(--text-subtle);font-size:12px">${f.confidence > 0.8 ? '★' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    document.getElementById('mem-facts-container').innerHTML = html;
  } catch (e) {
    console.error('Failed to load memory:', e);
  }
}

function getTypeIcon(type) {
  const icons = {
    bug: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
    todo: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    decision: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>',
  };
  return icons[type] || icons.decision;
}
```

**Step 3: Update API endpoint**

Update `/api/memory` to return facts:

```javascript
if (req.url === '/api/memory') {
  const memory = readMemoryData();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(memory));
  return;
}
```

**Step 4: Commit**

```bash
git add dashboard.js
git commit -m "feat: update dashboard Memory tab for fact-based display

- Show facts grouped by type (bug, todo, decision, etc.)
- Stats cards: Total, Active, Bugs, Todos
- Type-specific icons from Lucide
- Confidence indicators"
```

---

## Task 6: Integration Testing

**Step 1: Create integration test**

Create `tests/integration.test.js`:

```javascript
import { describe, test, expect } from '@jest/globals';
import { extractFacts } from '../fact-extractor.js';
import { saveFacts, loadMemory, getFactsForInjection } from '../memory.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Integration: Full flow', () => {
  const testDir = path.join(os.tmpdir(), 'pangkas-integration-' + Date.now());
  
  test('extract → save → load → inject flow', () => {
    // 1. Simulate conversation
    const messages = [
      { role: 'user', parts: [{ text: 'Kita putuskan pakai SQLite' }] },
      { role: 'assistant', parts: [{ text: 'Oke, next kita perlu setup config' }] },
    ];
    
    // 2. Extract facts
    const facts = extractFacts(messages);
    expect(facts.length).toBeGreaterThan(0);
    
    // 3. Save
    fs.mkdirSync(testDir, { recursive: true });
    saveFacts(testDir, facts);
    
    // 4. Load
    const memory = loadMemory(testDir);
    expect(memory.version).toBe('2.0');
    expect(memory.facts.length).toBeGreaterThan(0);
    
    // 5. Inject
    const prompt = getFactsForInjection(testDir);
    expect(prompt).toContain('[DECISION]');
    expect(prompt).toContain('SQLite');
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });
});
```

**Step 2: Run**

```bash
node --test tests/integration.test.js
```

**Expected:** PASS

**Step 3: Commit**

```bash
git add tests/integration.test.js
git commit -m "test: add integration test for fact extraction flow

- Extract → Save → Load → Inject end-to-end test
- Validates v2.0 memory pipeline"
```

---

## Task 7: Documentation Update

**Files:**
- Modify: `README.md`

**Step 1: Update README**

Replace Session Memory section with v2.0 documentation.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for v2.0 fact-based memory

- Replace summary-based docs with fact-based
- Add fact types documentation
- Update configuration options
- Migration notes from v1.x"
```

---

## Final Verification

```bash
# Run all tests
node --test tests/*.test.js

# Check syntax
node --check index.js
node --check memory.js
node --check fact-extractor.js

# Verify git status
git status
git log --oneline -10
```

---

## Summary of Changes

| File | Action | Lines Changed |
|------|--------|--------------|
| `fact-extractor.js` | **CREATE** | ~250 lines |
| `memory.js` | **REFACTOR** | ~120 lines (was 104) |
| `index.js` | **UPDATE** | ~30 lines |
| `config.js` | **UPDATE** | ~10 lines |
| `dashboard.js` | **UPDATE** | ~80 lines |
| `tests/*.test.js` | **CREATE** | ~200 lines |
| `README.md` | **UPDATE** | ~50 lines |

**Total:** ~7 commits, ~740 lines of code

---

**Plan complete!** Ready for execution. 🚀
