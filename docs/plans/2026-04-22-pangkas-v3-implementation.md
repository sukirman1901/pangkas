# Pangkas v3 Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Unified Context-Aware Pipeline untuk Pangkas v3, mengadopsi prinsip Smart Chunking, Importance Scoring, dan Deduplication dari Supermemory.

**Architecture:** Satu pipeline tunggal (`chunker.js` → `scorer.js` → `compressor.js` → `dedup.js`) yang di-orchestrate oleh `pipeline/index.js`. Backward compatible dengan v2 via config `usePipeline: false`.

**Tech Stack:** Pure Node.js ES Modules, zero dependency. Test framework: Node.js built-in `node:test` + `node:assert`.

**Design Doc Reference:** `docs/plans/2026-04-22-pangkas-v3-pipeline-design.md`

---

## Pre-Implementation Setup

### Task 0: Verify Environment

**Step 1: Check Node.js version**

Run: `node --version`
Expected: `v20.x.x` or higher (need `node:test`)

**Step 2: Verify project structure**

Run: `ls -la /Users/aaa/Documents/Developer/pangkas/pangkas/`
Expected: Ada `index.js`, `compressor.js`, `pruner.js`, dll.

**Step 3: Create pipeline directory**

Run: `mkdir -p /Users/aaa/Documents/Developer/pangkas/pangkas/pipeline`

---

## Phase 1: Chunker

### Task 1: Chunker Core — String Literal Detection

**Files:**
- Create: `pipeline/chunker.js`
- Test: `tests/unit/chunker.test.js`

**Step 1: Write failing test**

```js
// tests/unit/chunker.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseChunks } from '../../pipeline/chunker.js';

describe('chunker', () => {
  it('should parse simple string literal', () => {
    const input = 'const x = "hello world";';
    const chunks = parseChunks(input);
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].type, 'code');
    assert.strictEqual(chunks[1].type, 'string_literal');
  });
});
```

**Step 2: Run test (should fail)**

Run: `cd /Users/aaa/Documents/Developer/pangkas/pangkas && node --test tests/unit/chunker.test.js`
Expected: FAIL — `parseChunks` not found

**Step 3: Implement chunker (minimal)**

```js
// pipeline/chunker.js
export function parseChunks(text) {
  if (!text || typeof text !== 'string') return [];
  
  const chunks = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        chunks.push({
          type: 'string_literal',
          content: current,
          score: 0.0,
          compressLevel: 0.0,
          metadata: { lineStart: 0, lineEnd: 0 }
        });
        current = '';
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      if (current.trim()) {
        chunks.push({
          type: 'code',
          content: current,
          score: 0.0,
          compressLevel: 0.0,
          metadata: { lineStart: 0, lineEnd: 0 }
        });
      }
      current = char;
      inString = true;
      stringChar = char;
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    chunks.push({
      type: 'code',
      content: current,
      score: 0.0,
      compressLevel: 0.0,
      metadata: { lineStart: 0, lineEnd: 0 }
    });
  }
  
  return chunks;
}
```

**Step 4: Run test (should pass)**

Run: `node --test tests/unit/chunker.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add pipeline/chunker.js tests/unit/chunker.test.js
git commit -m "feat(chunker): basic string literal detection"
```

---

### Task 2: Chunker — Escaped Quotes Support

**Files:**
- Modify: `pipeline/chunker.js`
- Test: `tests/unit/chunker.test.js`

**Step 1: Add failing test**

```js
it('should handle escaped quotes inside string', () => {
  const input = 'const x = "hello \\"world\\"";';
  const chunks = parseChunks(input);
  assert.strictEqual(chunks.length, 2);
  assert.strictEqual(chunks[1].type, 'string_literal');
  assert.ok(chunks[1].content.includes('"world"'));
});
```

**Step 2: Run test (should fail)**

Expected: FAIL — escaped quotes break string detection

**Step 3: Fix implementation**

Already handled in Task 1 (escaped flag). If test fails, debug dan fix logic escaped.

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/chunker.js tests/unit/chunker.test.js
git commit -m "feat(chunker): support escaped quotes in strings"
```

---

### Task 3: Chunker — Comment Detection

**Files:**
- Modify: `pipeline/chunker.js`
- Test: `tests/unit/chunker.test.js`

**Step 1: Add failing tests**

```js
it('should separate line comment from code', () => {
  const input = 'const x = 1; // TODO: fix this';
  const chunks = parseChunks(input);
  assert.strictEqual(chunks.length, 2);
  assert.strictEqual(chunks[0].type, 'code');
  assert.strictEqual(chunks[1].type, 'comment');
});

it('should separate hash comment from code', () => {
  const input = 'x = 1  # TODO: fix this';
  const chunks = parseChunks(input);
  assert.strictEqual(chunks.length, 2);
  assert.strictEqual(chunks[1].type, 'comment');
});
```

**Step 2: Run test (should fail)**

**Step 3: Implement comment detection**

Tambahkan logic di `parseChunks` untuk detect `//` dan `#` comments. Split chunk code yang mengandung comment jadi 2 chunks.

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/chunker.js tests/unit/chunker.test.js
git commit -m "feat(chunker): line comment detection"
```

---

### Task 4: Chunker — Instruction & Separator Detection

**Files:**
- Modify: `pipeline/chunker.js`
- Test: `tests/unit/chunker.test.js`

**Step 1: Add failing tests**

```js
it('should detect instruction markers', () => {
  const input = '1. **Important**: Jangan ubah ini\n2. Lanjutkan';
  const chunks = parseChunks(input);
  const instruction = chunks.find(c => c.type === 'instruction');
  assert.ok(instruction);
  assert.ok(instruction.content.includes('Jangan ubah'));
});

it('should detect separator', () => {
  const input = 'foo\n---\nbar';
  const chunks = parseChunks(input);
  const sep = chunks.find(c => c.type === 'separator');
  assert.ok(sep);
});
```

**Step 2-5: Implement, test, commit**

---

### Task 5: Chunker — Line Number Metadata

**Files:**
- Modify: `pipeline/chunker.js`
- Test: `tests/unit/chunker.test.js`

**Step 1: Add test**

```js
it('should track line numbers', () => {
  const input = 'line1\nline2\nline3';
  const chunks = parseChunks(input);
  assert.strictEqual(chunks[0].metadata.lineStart, 1);
  assert.strictEqual(chunks[0].metadata.lineEnd, 3);
});
```

**Step 2-5: Implement line counting, test, commit**

---

## Phase 2: Scorer

### Task 6: Scorer — Basic Importance Scoring

**Files:**
- Create: `pipeline/scorer.js`
- Test: `tests/unit/scorer.test.js`

**Step 1: Write failing test**

```js
// tests/unit/scorer.test.js
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
});
```

**Step 2: Run test (should fail)**

**Step 3: Implement scorer**

```js
// pipeline/scorer.js
const IMPORTANT_PATTERNS = [
  /TODO|FIXME|HACK|XXX|BUG|WARN|WARNING|IMPORTANT|NOTE|CRITICAL|DEPRECATED/i,
  /@param|@returns|@throws|@example|@see/i,
  /eslint-disable|noqa|pragma|prettier-ignore/i,
  /copyright|license|author|version/i,
  /^\s*[*#]\s+(?:step|phase|section|part)\s*\d+/i,
];

const INSTRUCTION_PATTERNS = [
  /\b(must|always|never|don't|do not|should|important|critical|remember to)\b/i,
  /\b(context|standard|pattern|rule|guideline)\b/i,
];

export function scoreChunks(chunks) {
  if (!Array.isArray(chunks)) return [];
  
  return chunks.map(chunk => {
    let score = 0.5; // Default moderate
    
    switch (chunk.type) {
      case 'instruction':
        score = 1.0;
        break;
      case 'comment':
        if (isImportantComment(chunk.content)) {
          score = 0.85;
        } else if (isNoiseComment(chunk.content)) {
          score = 0.15;
        } else {
          score = 0.4;
        }
        break;
      case 'string_literal':
        score = 0.7; // String literal berisi data penting
        break;
      case 'code':
        score = 0.6;
        if (INSTRUCTION_PATTERNS.some(p => p.test(chunk.content))) {
          score = 0.9;
        }
        break;
      case 'separator':
        score = 0.05;
        break;
      default:
        score = 0.5;
    }
    
    return {
      ...chunk,
      score,
      isImportant: score >= 0.8
    };
  });
}

function isImportantComment(text) {
  return IMPORTANT_PATTERNS.some(p => p.test(text));
}

function isNoiseComment(text) {
  const noisePatterns = [
    /\/{2,}\s*$/,
    /\/{2,}\s*[-=]{3,}/,
    /\/{2,}\s*(?:hi|hello|bye)/i,
    /^\s*\/\*\*?\s*\*\/\s*$/,
  ];
  return noisePatterns.some(p => p.test(text));
}
```

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/scorer.js tests/unit/scorer.test.js
git commit -m "feat(scorer): basic importance scoring per chunk type"
```

---

### Task 7: Scorer — Important Comment Detection

**Files:**
- Modify: `pipeline/scorer.js`
- Test: `tests/unit/scorer.test.js`

**Step 1: Add tests**

```js
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
```

**Step 2-5: Verify, test, commit**

---

## Phase 3: Adaptive Compressor

### Task 8: Adaptive Compressor — Per-Chunk Level Calculation

**Files:**
- Create: `pipeline/compressor.js`
- Test: `tests/unit/compressor.test.js`

**Step 1: Write failing test**

```js
// tests/unit/compressor.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compressChunks } from '../../pipeline/compressor.js';

describe('adaptive compressor', () => {
  it('should not compress high-score chunk', () => {
    const chunks = [
      { type: 'instruction', content: 'IMPORTANT: jangan ubah ini', score: 1.0, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.5 });
    assert.strictEqual(compressed[0].content, 'IMPORTANT: jangan ubah ini');
  });
  
  it('should compress low-score chunk aggressively', () => {
    const chunks = [
      { type: 'separator', content: '\n\n\n---\n\n\n', score: 0.1, metadata: {} }
    ];
    const compressed = compressChunks(chunks, { compressionLevel: 0.5 });
    assert.ok(compressed[0].content.length < '\n\n\n---\n\n\n'.length);
  });
});
```

**Step 2: Run test (should fail)**

**Step 3: Implement adaptive compressor**

```js
// pipeline/compressor.js
export function compressChunks(chunks, config) {
  if (!Array.isArray(chunks)) return chunks;
  const globalLevel = config?.compressionLevel ?? 0.3;
  
  return chunks.map(chunk => {
    const level = getCompressionLevel(chunk.score, globalLevel);
    const compressed = compressChunk(chunk.content, level, chunk.type);
    
    return {
      ...chunk,
      content: compressed,
      compressLevel: level
    };
  });
}

function getCompressionLevel(chunkScore, globalLevel) {
  const adjusted = globalLevel * (1 - chunkScore);
  return Math.max(0, Math.min(1, adjusted));
}

function compressChunk(content, level, type) {
  if (!content || typeof content !== 'string') return content;
  if (level <= 0) return content;
  
  // Never compress string literals aggressively
  if (type === 'string_literal' && level > 0.3) {
    level = 0.3;
  }
  
  let compressed = content;
  
  // Level 1 (0.1-0.3): Conservative
  if (level > 0.1) {
    compressed = compressed
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
  }
  
  // Level 2 (0.3-0.5): Moderate
  if (level > 0.3) {
    compressed = compressed.replace(/[ \t]{2,}/g, ' ');
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
  }
  
  // Level 3 (0.5-0.7): Aggressive
  if (level > 0.5) {
    compressed = compressed
      .replace(/\s*([,;:])\s*/g, '$1 ')
      .replace(/\s*([\(\[\{])\s*/g, '$1')
      .replace(/\s*([\)\]\}])\s*/g, '$1');
  }
  
  // Level 4 (0.7-1.0): Very aggressive
  if (level > 0.7) {
    const lines = compressed.split('\n');
    compressed = lines.map(line => {
      if (line.length < 80) {
        return line.replace(/\s+/g, ' ').trim();
      }
      return line;
    }).join('\n');
  }
  
  return compressed;
}
```

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/compressor.js tests/unit/compressor.test.js
git commit -m "feat(compressor): adaptive per-chunk compression"
```

---

### Task 9: Compressor — String Literal Protection

**Files:**
- Modify: `pipeline/compressor.js`
- Test: `tests/unit/compressor.test.js`

**Step 1: Add test**

```js
it('should not aggressively compress string literals', () => {
  const chunks = [
    { type: 'string_literal', content: '"hello   world"', score: 0.1, metadata: {} }
  ];
  const compressed = compressChunks(chunks, { compressionLevel: 0.9 });
  assert.ok(compressed[0].content.includes('hello   world'));
});
```

**Step 2-5: Verify, test, commit**

---

## Phase 4: Deduplicator

### Task 10: Dedup — Jaccard Similarity

**Files:**
- Create: `pipeline/dedup.js`
- Test: `tests/unit/dedup.test.js`

**Step 1: Write failing test**

```js
// tests/unit/dedup.test.js
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
});
```

**Step 2: Run test (should fail)**

**Step 3: Implement dedup**

```js
// pipeline/dedup.js
export function deduplicateChunks(messagesChunks, config) {
  if (!Array.isArray(messagesChunks) || messagesChunks.length < 2) {
    return messagesChunks;
  }
  
  const threshold = config?.dedupThreshold ?? 0.85;
  const result = messagesChunks.map(chunks => 
    chunks.map(c => ({ ...c, isRedundant: false }))
  );
  
  // Compare each message's chunks with previous messages
  for (let i = 1; i < result.length; i++) {
    for (const chunk of result[i]) {
      if (chunk.type === 'separator' || chunk.type === 'unknown') continue;
      
      for (let j = 0; j < i; j++) {
        for (const prevChunk of result[j]) {
          if (chunk.type !== prevChunk.type) continue;
          
          const sim = jaccardSimilarity(chunk.content, prevChunk.content);
          if (sim >= threshold) {
            chunk.isRedundant = true;
            break;
          }
        }
        if (chunk.isRedundant) break;
      }
    }
  }
  
  return result;
}

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(getNgrams(a.toLowerCase(), 3));
  const setB = new Set(getNgrams(b.toLowerCase(), 3));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function getNgrams(text, n) {
  const ngrams = [];
  for (let i = 0; i <= text.length - n; i++) {
    ngrams.push(text.substring(i, i + n));
  }
  return ngrams;
}
```

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/dedup.js tests/unit/dedup.test.js
git commit -m "feat(dedup): Jaccard similarity-based deduplication"
```

---

## Phase 5: Pipeline Orchestrator

### Task 11: Pipeline Orchestrator

**Files:**
- Create: `pipeline/index.js`
- Test: `tests/integration/pipeline.test.js`

**Step 1: Write failing test**

```js
// tests/integration/pipeline.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline } from '../../pipeline/index.js';

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
});
```

**Step 2: Run test (should fail)**

**Step 3: Implement orchestrator**

```js
// pipeline/index.js
import { parseChunks } from './chunker.js';
import { scoreChunks } from './scorer.js';
import { compressChunks } from './compressor.js';
import { deduplicateChunks } from './dedup.js';
import { logStats } from '../logger.js';

export function createPipeline(config) {
  return {
    run(text) {
      try {
        const chunks = parseChunks(text);
        const scored = scoreChunks(chunks);
        const compressed = compressChunks(scored, config);
        return compressed;
      } catch (err) {
        logStats({ event: 'pipeline_error', error: err.message, fallback: 'original_text' });
        return [{ 
          type: 'unknown', 
          content: text, 
          score: 1.0, 
          compressLevel: 0.0,
          metadata: { lineStart: 1, lineEnd: 1 }
        }];
      }
    },
    
    deduplicate(messagesChunks) {
      try {
        return deduplicateChunks(messagesChunks, config);
      } catch (err) {
        logStats({ event: 'dedup_error', error: err.message });
        return messagesChunks;
      }
    }
  };
}

export function reconstructText(chunks) {
  if (!Array.isArray(chunks)) return '';
  return chunks
    .filter(c => !c.isRedundant)
    .map(c => c.content)
    .join('');
}
```

**Step 4: Run test (should pass)**

**Step 5: Commit**

```bash
git add pipeline/index.js tests/integration/pipeline.test.js
git commit -m "feat(pipeline): orchestrator with graceful degradation"
```

---

## Phase 6: Config & Integration

### Task 12: Config Update

**Files:**
- Modify: `config.js`

**Step 1: Add new config fields**

```js
// Tambahkan ke defaults di config.js
const defaults = {
  // ... existing configs ...
  
  // v3 Pipeline config
  usePipeline: true,
  dedupThreshold: 0.85,
  maxChunksPerMessage: 500,
  enableBenchmark: false,
};
```

**Step 2: Add env mapping**

```js
const env = {
  // ... existing env mappings ...
  usePipeline: process.env.PANGKAS_USE_PIPELINE === 'false' ? false : undefined,
  dedupThreshold: process.env.PANGKAS_DEDUP_THRESHOLD ? Number(process.env.PANGKAS_DEDUP_THRESHOLD) : undefined,
  maxChunksPerMessage: process.env.PANGKAS_MAX_CHUNKS ? Number(process.env.PANGKAS_MAX_CHUNKS) : undefined,
  enableBenchmark: process.env.PANGKAS_BENCHMARK === 'true' ? true : undefined,
};
```

**Step 3: Add validation**

```js
// Clamp values
merged.dedupThreshold = Math.max(0, Math.min(1, merged.dedupThreshold));
merged.maxChunksPerMessage = Math.max(10, Math.min(10000, merged.maxChunksPerMessage));
```

**Step 4: Commit**

```bash
git add config.js
git commit -m "feat(config): add v3 pipeline configuration fields"
```

---

### Task 13: Index.js Integration

**Files:**
- Modify: `index.js`
- Test: `tests/integration/hooks.test.js`

**Step 1: Update index.js**

```js
// index.js
import { createPipeline, reconstructText } from './pipeline/index.js';

// Helper untuk extract text dari parts
function extractText(parts) {
  if (!parts || !Array.isArray(parts)) return '';
  return parts.map(p => {
    if (p && typeof p.text === 'string') return p.text;
    if (typeof p === 'string') return p;
    return '';
  }).join('');
}

// Helper untuk reconstruct parts dari chunks
function reconstructParts(parts, chunks) {
  // Simplified: replace text content
  const text = reconstructText(chunks);
  if (parts.length === 1 && parts[0].text) {
    return [{ ...parts[0], text }];
  }
  return [{ text }];
}

export const PangkasPlugin = async (ctx) => {
  const config = getPangkasConfig();
  
  // Legacy mode
  if (!config.usePipeline) {
    return createLegacyHooks(config); // Import dari legacy/
  }
  
  const pipeline = createPipeline(config);
  
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      if (!config.pruneSystemPrompt || !output.system || !Array.isArray(output.system)) {
        return;
      }
      
      output.system = output.system.map(str => {
        if (typeof str !== 'string') return str;
        const chunks = pipeline.run(str);
        return reconstructText(chunks);
      });
    },
    
    "experimental.chat.messages.transform": async (_input, output) => {
      if (!output.messages || !Array.isArray(output.messages)) return;
      
      let messages = [...output.messages];
      
      // Process each message
      messages = messages.map(msg => {
        if (!msg || !msg.parts) return msg;
        
        const text = extractText(msg.parts);
        const chunks = pipeline.run(text);
        msg.parts = reconstructParts(msg.parts, chunks);
        msg._chunks = chunks;
        return msg;
      });
      
      // Deduplication
      const allChunks = messages.map(m => m._chunks || []);
      const deduped = pipeline.deduplicate(allChunks);
      messages = messages.map((msg, i) => {
        msg._chunks = deduped[i];
        return msg;
      });
      
      // History management
      if (config.maxHistoryMessages > 0 && messages.length > config.maxHistoryMessages) {
        if (config.useSummarization) {
          messages = manageHistory(messages, config.maxHistoryMessages);
        } else {
          messages = messages.slice(-config.maxHistoryMessages);
        }
      }
      
      output.messages = messages;
    },
    
    "chat.message": async (input, output) => {
      if (!output.parts || !Array.isArray(output.parts)) return;
      
      const text = extractText(output.parts);
      const chunks = pipeline.run(text);
      output.parts = reconstructParts(output.parts, chunks);
    }
  };
};
```

**Step 2: Commit**

```bash
git add index.js tests/integration/hooks.test.js
git commit -m "feat(index): integrate v3 pipeline into OpenCode hooks"
```

---

## Phase 7: Legacy Mode & Backward Compatibility

### Task 14: Move Legacy Files

**Files:**
- Create: `legacy/compressor.js`, `legacy/pruner.js`, `legacy/history-manager.js`
- Modify: `index.js` (add legacy hooks)

**Step 1: Move files**

```bash
mkdir -p legacy
cp compressor.js legacy/compressor.js
cp pruner.js legacy/pruner.js
cp history-manager.js legacy/history-manager.js
```

**Step 2: Create legacy hooks function in index.js**

```js
function createLegacyHooks(config) {
  // Import dari legacy/
  const { pruneContext } = await import('./legacy/pruner.js');
  const { compressPrompt } = await import('./legacy/compressor.js');
  const { manageHistory } = await import('./legacy/history-manager.js');
  
  // ... return hooks sama seperti v2 ...
}
```

**Step 3: Commit**

```bash
git add legacy/ index.js
git commit -m "feat(legacy): move v2 modules to legacy/ folder for backward compat"
```

---

## Phase 8: Regression Tests

### Task 15: String Literal Bug Regression

**Files:**
- Test: `tests/regression/string-literal-bug.test.js`

```js
// tests/regression/string-literal-bug.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline } from '../../pipeline/index.js';

describe('regression: string literal bug', () => {
  it('should not break URLs in string literals', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const input = 'const url = "https://example.com";';
    const chunks = pipeline.run(input);
    
    const stringLit = chunks.find(c => c.type === 'string_literal');
    assert.ok(stringLit);
    assert.ok(stringLit.content.includes('https://'));
  });
});
```

Run: `node --test tests/regression/string-literal-bug.test.js`

Commit:
```bash
git add tests/regression/string-literal-bug.test.js
git commit -m "test(regression): add string literal bug regression test"
```

---

### Task 16: TODO Comment Regression

**Files:**
- Test: `tests/regression/todo-comment.test.js`

```js
// tests/regression/todo-comment.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline } from '../../pipeline/index.js';

describe('regression: TODO comment preservation', () => {
  it('should preserve TODO comments', () => {
    const pipeline = createPipeline({ compressionLevel: 0.9 });
    const input = 'const x = 1; // TODO: fix this';
    const chunks = pipeline.run(input);
    
    const comment = chunks.find(c => c.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.content.includes('TODO'));
    assert.ok(comment.score >= 0.8);
  });
});
```

Commit:
```bash
git add tests/regression/todo-comment.test.js
git commit -m "test(regression): add TODO comment preservation test"
```

---

## Phase 9: Benchmark

### Task 17: Compression Ratio Benchmark

**Files:**
- Create: `tests/benchmark/compression-ratio.test.js`
- Create: `tests/fixtures/sample-react-component.js`

**Step 1: Create fixture**

```js
// tests/fixtures/sample-react-component.js
export const fixture = `
import React, { useState } from 'react';

// TODO: Add prop types
function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  
  // IMPORTANT: Don't mutate state directly
  const increment = () => {
    setCount(count + 1);
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

export default Counter;
`;
```

**Step 2: Create benchmark test**

```js
// tests/benchmark/compression-ratio.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPipeline } from '../../pipeline/index.js';
import { fixture } from '../fixtures/sample-react-component.js';

describe('benchmark: compression ratio', () => {
  it('should reduce tokens while preserving meaning', () => {
    const pipeline = createPipeline({ compressionLevel: 0.5 });
    const chunks = pipeline.run(fixture);
    
    const output = chunks.map(c => c.content).join('');
    
    const originalTokens = Math.ceil(fixture.length / 4);
    const compressedTokens = Math.ceil(output.length / 4);
    const savings = originalTokens - compressedTokens;
    const ratio = savings / originalTokens;
    
    console.log(`Original: ${originalTokens} tokens`);
    console.log(`Compressed: ${compressedTokens} tokens`);
    console.log(`Savings: ${(ratio * 100).toFixed(1)}%`);
    
    // Should save at least 10%
    assert.ok(ratio > 0.1, `Expected >10% savings, got ${(ratio * 100).toFixed(1)}%`);
    
    // Should preserve IMPORTANT comment
    assert.ok(output.includes('IMPORTANT'));
    
    // Should preserve TODO comment
    assert.ok(output.includes('TODO'));
  });
});
```

**Step 3: Run benchmark**

Run: `node --test tests/benchmark/compression-ratio.test.js`

**Step 4: Commit**

```bash
git add tests/benchmark/compression-ratio.test.js tests/fixtures/sample-react-component.js
git commit -m "test(benchmark): add compression ratio benchmark"
```

---

## Phase 10: Final Integration & Documentation

### Task 18: Run All Tests

**Step 1: Run full test suite**

Run: `node --test tests/**/*.test.js`
Expected: All tests PASS

### Task 19: Update README

**Files:**
- Modify: `README.md`

Tambahkan section:
- v3 Pipeline Overview
- How it works (chunking, scoring, adaptive compression, dedup)
- Config reference
- Migration guide dari v2

### Task 20: Final Commit

```bash
git add README.md
git commit -m "docs: update README for v3 pipeline"
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `pipeline/chunker.js` | Create | Smart text parser |
| `pipeline/scorer.js` | Create | Importance scoring |
| `pipeline/compressor.js` | Create | Adaptive compression |
| `pipeline/dedup.js` | Create | Deduplication |
| `pipeline/index.js` | Create | Orchestrator |
| `config.js` | Modify | Add v3 config fields |
| `index.js` | Modify | Integrate pipeline |
| `legacy/*` | Create | Move v2 modules |
| `tests/unit/*.test.js` | Create | Unit tests |
| `tests/integration/*.test.js` | Create | Integration tests |
| `tests/regression/*.test.js` | Create | Regression tests |
| `tests/benchmark/*.test.js` | Create | Benchmarks |
| `tests/fixtures/*` | Create | Test fixtures |
| `README.md` | Modify | Documentation |

---

*Plan complete. Ready for execution.*
