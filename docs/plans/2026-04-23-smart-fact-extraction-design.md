# Smart Fact Extraction for Pangkas Session Memory

**Date:** 2026-04-23
**Status:** Approved
**Author:** OpenCode / Pangkas Team

---

## 1. Overview & Goals

### Problem
The current Session Memory stores flat text summaries (300-500 chars) that are:
- **Token-inefficient**: All-or-nothing injection, no filtering
- **Unstructured**: AI must parse natural language to understand context
- **Redundant**: Same info repeated across sessions
- **Not actionable**: No distinction between decisions, todos, bugs, etc.

### Solution
Replace flat summaries with **structured, typed facts** that are:
- **Token-efficient**: Inject only relevant fact types (5-7 facts ≈ 100-200 tokens vs 300-500)
- **Structured**: Machine-readable, no parsing needed
- **Deduplicated**: Update existing facts instead of creating duplicates
- **Actionable**: Typed facts (decision, todo, bug, file) tell AI exactly what to do

### Success Criteria
- [ ] Token usage for memory injection reduced by 40-60%
- [ ] AI understands context faster (no parsing needed)
- [ ] Zero duplicate information across sessions
- [ ] Backward compatible memory reset (old format ignored gracefully)

---

## 2. Fact Types

```typescript
enum FactType {
  DECISION    = 'decision',   // Architecture/technical decisions made
  TODO        = 'todo',       // Open tasks not yet completed
  DONE        = 'done',       // Completed tasks (auto-archived after N sessions)
  FILE        = 'file',       // Files being modified
  BUG         = 'bug',        // Known bugs or issues
  PREFERENCE  = 'preference', // User preferences (style, approach, config)
  QUESTION    = 'question',   // Open questions awaiting answers
}
```

### Fact Schema
```typescript
interface Fact {
  id: string;           // UUID v4
  type: FactType;
  content: string;      // Max 150 chars
  confidence: number;   // 0.0 - 1.0
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  sessionCount: number; // How many sessions this fact appeared
  isLatest: boolean;    // false if superseded by newer fact
}
```

---

## 3. Architecture

### 3.1 Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Message   │────▶│  AI Response     │────▶│ Plugin Hook     │
└─────────────────┘     └──────────────────┘     │ (messages.transform)
                                                  └────────┬────────┘
                                                           │
                              ┌────────────────────────────┘
                              ▼
                  ┌─────────────────────┐
                  │  extractFacts()     │  ← NEW MODULE
                  │  fact-extractor.js  │
                  └──────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐   ┌──────────┐   ┌──────────┐
        │ Rule-   │   │ AI-Prompt│   │ Merge &  │
        │ Based   │   │ Based    │   │ Score    │
        │ Extract │   │ (Optional│   │          │
        └─────────┘   │ Future)  │   └────┬─────┘
                      └──────────┘        │
                                          ▼
                              ┌─────────────────────┐
                              │  saveMemory()       │
                              │  (memory.js v2)     │
                              └──────────┬──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │  .pangkas/memory.json│
                              │  {version: "2.0"}   │
                              └─────────────────────┘
```

### 3.2 Injection Flow

```
OpenCode Start
     │
     ▼
loadMemory(projectRoot)
     │
     ▼
┌─────────────────────────────┐
│  getRelevantFacts()         │
│  - Filter: isLatest = true  │
│  - Exclude: done (optional) │
│  - Sort: priority + recency │
│  - Limit: max 7 facts       │
└─────────────┬───────────────┘
              │
              ▼
formatFactsForPrompt(facts)
     │
     ▼
"Context from previous sessions:
 • [TODO] Fix memory persistence bug
 • [DECISION] Use .pangkas/ folder for storage
 • [BUG] Dashboard crashes on null pointer"
     │
     ▼
Inject as system message
```

---

## 4. Implementation Plan

### 4.1 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `fact-extractor.js` | **CREATE** | Core fact extraction engine |
| `fact-prompt.txt` | **CREATE** | Prompt template for AI extraction (future) |
| `memory.js` | **REFACTOR** | Change summary-based → fact-based |
| `index.js` | **UPDATE** | Inject facts instead of summary |
| `config.js` | **UPDATE** | Add fact extraction settings |
| `dashboard.js` | **UPDATE** | Memory tab show facts grid |
| `sanitize.js` | **VERIFY** | Ensure facts are also sanitized |

### 4.2 Module: `fact-extractor.js`

```javascript
// Core API
export function extractFacts(messages, existingFacts = []);
export function mergeFacts(existing, extracted);
export function getRelevantFacts(allFacts, options = {});
export function formatFactsForPrompt(facts);

// Rule-based extraction (Phase 1)
function ruleBasedExtract(text);
function detectDecision(text);
function detectTodo(text);
function detectFile(text);
function detectBug(text);

// Scoring
function scoreFact(fact, context);
function priorityScore(fact);

// Deduplication
function findDuplicate(fact, existingFacts);
function updateExisting(existing, newFact);
```

### 4.3 Module: `memory.js` (Refactored)

```javascript
// BEFORE (v1.x)
export function saveMemory(projectRoot, data); // data = {sessionSummary, recentFocus}
export function loadMemory(projectRoot); // returns {sessionSummary, ...}

// AFTER (v2.0)
export function saveFacts(projectRoot, facts);
export function loadFacts(projectRoot); // returns {version: "2.0", facts: [...]}
export function getRelevantFacts(projectRoot, options);
export function archiveOldFacts(projectRoot, maxAgeSessions);
```

### 4.4 Configuration

```javascript
// config.js additions
const defaults = {
  // ... existing config ...
  
  // Fact Extraction (NEW)
  enableFactExtraction: true,
  maxFactsToInject: 7,
  minFactConfidence: 0.6,
  factPriorityOrder: ['bug', 'todo', 'decision', 'preference', 'question', 'file', 'done'],
  archiveDoneAfterSessions: 3,
  maxFactContentLength: 150,
};
```

---

## 5. Token Budgeting

### Comparison: Summary vs Facts

| Metric | Summary (v1) | Facts (v2) | Savings |
|--------|--------------|------------|---------|
| Avg injection size | 350 chars | 140 chars | **60%** |
| Max facts injected | 1 summary | 7 facts | More granular |
| Relevance | All-or-nothing | Filter by type | Higher precision |
| Parse overhead | AI parses NL | Structured | Zero parse |

### Injection Format

```
// v1 (summary)
[Loaded context from previous session]
Sesi sebelumnya kita implementasi fitur memory 
dengan folder .pangkas/, nambah tab Memory ke 
dashboard, dan fix bug penyimpanan... (300 chars)

// v2 (facts)
[Session Context]
• [BUG] Memory only saved on assistant response
• [DONE] Fix: persist on every message transform  
• [DECISION] Use .pangkas/ folder for local storage
• [TODO] Add dark mode to dashboard
• [FILE] dashboard.js, index.js modified (140 chars)
```

---

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| Corrupted memory file | Reset to empty facts, log warning |
| Fact extraction fails | Fallback to last known good facts |
| Too many facts (>50) | Archive oldest `done` facts |
| Duplicate facts | Update existing, increment sessionCount |
| Fact content too long | Truncate to maxFactContentLength |
| Invalid fact type | Default to 'decision', log warning |

---

## 7. Dashboard Updates

### Memory Tab (Updated)

```
┌─────────────────────────────────────┐
│  Session Memory                     │
├─────────────────────────────────────┤
│  Status: Active | Facts: 12         │
├─────────────────────────────────────┤
│  🔴 BUGS (2)                        │
│  • Memory race condition            │
│  • Dashboard null pointer           │
├─────────────────────────────────────┤
│  🟡 TODOS (3)                       │
│  • Add dark mode                    │
│  • Optimize token usage             │
│  • Write tests                      │
├─────────────────────────────────────┤
│  🟢 DECISIONS (4)                   │
│  • Use .pangkas/ folder             │
│  • SQLite for local DB              │
├─────────────────────────────────────┤
│  📄 FILES (3)                       │
│  • dashboard.js • index.js          │
└─────────────────────────────────────┘
```

---

## 8. Testing Strategy

### Unit Tests
```javascript
describe('fact-extractor', () => {
  test('detects decisions', () => {
    const facts = extractFacts("Kita putuskan pakai SQLite");
    expect(facts[0]).toMatchObject({type: 'decision', confidence: expect.any(Number)});
  });

  test('merges duplicates', () => {
    const existing = [{id: '1', type: 'todo', content: 'Fix A', sessionCount: 1}];
    const extracted = [{type: 'todo', content: 'Fix A'}];
    const merged = mergeFacts(existing, extracted);
    expect(merged[0].sessionCount).toBe(2);
  });

  test('limits injection count', () => {
    const facts = Array(20).fill({type: 'todo', content: 'Task'});
    const relevant = getRelevantFacts(facts, {limit: 7});
    expect(relevant.length).toBe(7);
  });
});
```

### Integration Tests
- Full conversation → extract facts → save → restart → inject → verify context

---

## 9. Migration Path

1. **Phase 1 (This PR)**: Implement fact extraction, ignore old summary format
2. **Phase 2 (Future)**: Add AI-powered extraction (OpenAI/Claude prompt-based)
3. **Phase 3 (Future)**: Cross-session fact relationships

### Backward Compatibility
- Old memory files (v1.x) → Ignored, start fresh with v2.0
- Config `enableFactExtraction: false` → Use old summary mode (deprecated)

---

## 10. Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| AI Fact Extraction | Medium | Use LLM to extract facts instead of rule-based |
| Fact Relationships | Low | Link related facts (decision → todo → done) |
| Auto-Archive | Medium | Archive `done` facts after N sessions |
| Fact Search | Low | Search facts by type/content in dashboard |
| Export/Import | Low | Export session context as markdown |

---

**Approved by:** OpenCode / User  
**Next Step:** Invoke `writing-plans` skill to create implementation tasks
