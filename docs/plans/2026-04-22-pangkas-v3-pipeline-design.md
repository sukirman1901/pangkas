# Pangkas v3: Context-Aware Pipeline Design

> **Status**: Approved  
> **Date**: 2026-04-22  
> **Author**: OpenCode AI Agent  
> **Scope**: Refactor Pangkas dari modul terpisah menjadi Unified Context-Aware Pipeline, mengadopsi prinsip dari Supermemory (Smart Chunking, Importance Scoring, Deduplication)

---

## 1. Project Context

### 1.1 Pangkas Saat Ini (v2)
Pangkas adalah plugin OpenCode untuk menghemat token AI. Arsitektur saat ini:
- `pruner.js` — Hapus komentar noise (regex sederhana)
- `compressor.js` — Kompres whitespace (satu level global)
- `history-manager.js` — Truncate + summarize messages
- `index.js` — Hooks OpenCode

**Problem v2:**
- Compression "one size fits all" — instruksi penting dan komentar noise di-compress sama
- Pruner tidak memahami struktur kode (bisa merusak string literal)
- Tidak ada deduplication antar messages
- 0% test coverage

### 1.2 Inspirasi dari Supermemory
Supermemory memiliki 5 lapisan context engineering. Tiga yang paling relevan untuk diadopsi ke Pangkas:

| Supermemory Layer | Prinsip | Adopsi ke Pangkas |
|---|---|---|
| **Extractors** | Memahami format dokumen (PDF, web, gambar) dan smart chunking | Smart Chunker: pecah teks jadi unit bermakna (function, comment, string literal) |
| **Retrieval** | Context-aware reranking — skor pentingnya informasi | Importance Scorer: setiap chunk punya skor 0.0-1.0, compression disesuaikan |
| **Memory Graph** | Knowledge merge & deduplication | Deduplicator: hapus redundansi antar messages sebelum summarize |

---

## 2. Architecture Overview

### 2.1 Unified Pipeline

Pangkas v3 menggunakan **satu pipeline tunggal** yang menggantikan logika tersebar di modul lama.

```
Raw Input
    │
    ▼
┌─────────────┐
│   CHUNKER   │  ← Pecah teks jadi "unit bermakna"
│  (Parser)   │    (function, paragraph, string literal, etc.)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   SCORER    │  ← Beri skor 0.0-1.0 per chunk
│ (Importance)│    (penting = jangan di-compress brutal)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  COMPRESSOR │  ← Compress per chunk, level tergantung skor
│  (Adaptive) │    (bukan global 0.3 untuk semua teks)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   DEDUP     │  ← Hapus redundansi antar messages
│ (Merge/     │    (sebelum summarize history)
│  Contradict)│
└──────┬──────┘
       │
       ▼
   Output
```

### 2.2 File Structure

```
pangkas/
├── index.js              # Entry point (minimal change)
├── config.js             # Tambah config pipeline
├── pipeline/
│   ├── index.js          # Orchestrator pipeline
│   ├── chunker.js        # Smart chunking
│   ├── scorer.js         # Importance scoring
│   ├── compressor.js     # Adaptive compression
│   └── dedup.js          # Deduplication
├── legacy/               # Modul lama (backward compatible)
│   ├── compressor.js
│   ├── pruner.js
│   └── history-manager.js
├── types.ts              # Update interfaces
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   └── benchmark/
└── README.md
```

### 2.3 Key Principles
- **Pure JS, zero dependency** — Tidak butuh vector DB atau embedding model
- **Graceful degradation** — Kalau pipeline gagal, fallback ke original text
- **Backward compatible** — Config lama tetap valid, bisa disable pipeline
- **Per-chunk compression** — Skor tinggi = compress ringan, skor rendah = compress agresif

---

## 3. Pipeline Stages

### 3.1 Data Format: Chunk

Pipeline menggunakan format **Chunks** — array of typed chunks.

```typescript
interface Chunk {
  type: 'code' | 'comment' | 'string_literal' | 'instruction' | 'separator' | 'unknown';
  content: string;
  score: number;          // 0.0 - 1.0 (di-set oleh Scorer)
  compressLevel: number;  // 0.0 - 1.0 (di-set oleh Compressor)
  metadata: {
    lineStart: number;
    lineEnd: number;
    language?: string;     // 'js', 'py', 'html', etc.
    isImportant?: boolean; // flag dari Scorer
    isRedundant?: boolean; // flag dari Dedup
  };
}
```

### 3.2 Stage 1: Chunker

**Input:** String mentah  
**Output:** `Chunk[]`

Chunker mengenali struktur bahasa pemrograman & natural language:

| Pattern | Type | Contoh |
|---------|------|--------|
| `function foo() { ... }` | `code` | Semua block code |
| `// TODO: ...` | `comment` | Komentar (di-split dari code) |
| `"string literal"` | `string_literal` | String dalam code |
| `1. **Instruksi**` | `instruction` | List/instruksi eksplisit |
| `---` / `===` | `separator` | Divider visual |
| Sisanya | `unknown` | Paragraf biasa |

**Heuristic:**
- Regex + bracket matching sederhana (tidak butuh full parser)
- String literal di-isolate supaya Compressor tidak merusaknya
- Komentar di-isolate supaya bisa di-process secara terpisah

**Edge cases:**
- Escaped quotes: `"hello \"world\""` tetap 1 chunk
- Nested brackets: `function() { if() { ... } }` tetap 1 chunk code
- Bracket mismatch: fallback ke single `unknown` chunk

### 3.3 Stage 2: Scorer

**Input:** `Chunk[]`  
**Output:** `Chunk[]` (dengan `score` & `isImportant`)

Setiap chunk diberi skor 0.0 (bisa di-compress agresif) sampai 1.0 (jangan di-touch):

| Signal | Skor | Penjelasan |
|--------|------|------------|
| Instruksi eksplisit (`must`, `always`, `don't`) | 0.9 - 1.0 | Jangan pernah di-compress |
| TODO / FIXME / JSDoc | 0.8 - 0.9 | Penting untuk context |
| Function signature / API call | 0.7 - 0.8 | Struktur kode |
| Komentar noise / greetings | 0.1 - 0.2 | Hapus atau compress max |
| Separator / blank lines | 0.0 - 0.1 | Boleh hilang |
| Paragraf biasa | 0.4 - 0.6 | Moderate compression |

**Rules:**
```js
if (chunk.type === 'instruction') score = 1.0;
if (chunk.type === 'comment' && isImportantComment(chunk.content)) score = 0.85;
if (chunk.type === 'separator') score = 0.1;
```

### 3.4 Stage 3: Adaptive Compressor

**Input:** `Chunk[]` (dengan score)  
**Output:** `Chunk[]` (dengan compressed content)

Bukan lagi "satu level untuk semua teks". Sekarang **per-chunk compression**:

```js
function getCompressionLevel(chunkScore, globalLevel) {
  // Skor tinggi = compress ringan, skor rendah = compress agresif
  const adjusted = globalLevel * (1 - chunkScore);
  return Math.max(0, Math.min(1, adjusted));
}
```

| Chunk Score | Global Level 0.3 | Hasil Compress |
|-------------|------------------|----------------|
| 1.0 (instruksi) | 0.3 | 0.0 → **tidak di-compress** |
| 0.5 (paragraf) | 0.3 | 0.15 → moderate |
| 0.1 (separator) | 0.3 | 0.27 → hampir max |

**Compression levels per chunk:**
- `0.0` — No compression
- `0.1-0.3` — Conservative: trim trailing whitespace, trim edges
- `0.3-0.5` — Moderate: collapse multiple spaces, normalize newlines
- `0.5-0.7` — Aggressive: whitespace around operators (safe ones only)
- `0.7-1.0` — Very aggressive: minimal readability

### 3.5 Stage 4: Dedup

**Input:** `Chunk[][]` — array of chunk arrays (dari semua messages)  
**Output:** `Chunk[][]` — dengan redundansi dihapus

Sebelum history-manager summarize, Dedup membandingkan antar messages:

```js
// Simple dedup: Jaccard similarity antar chunk
// Jika chunk di message N 85%+ mirip dengan chunk di message N-k,
// tandai sebagai redundant.
```

**Heuristic (zero dependency):**
- Gunakan **n-gram overlap** atau **Jaccard similarity** antar chunk
- Threshold: `0.85` (configurable)
- Scope: hanya dedup antar message berbeda, jangan dedup dalam 1 message
- Kalau redundant: tandai `isRedundant = true`, bisa dihapus atau diganti `[...same as above...]`

**Edge cases:**
- Message terlalu pendek (< 3 chunks): skip dedup
- False positive (kode mirip tapi beda fungsi): context window + threshold tuning

---

## 4. Integration with OpenCode Hooks

### 4.1 Hook: `experimental.chat.system.transform`

```js
"experimental.chat.system.transform": async (_input, output) => {
  if (!config.pruneSystemPrompt || !output.system) return;
  
  const pipeline = createPipeline(config);
  output.system = output.system.map(str => {
    const chunks = pipeline.run(str);
    return reconstructText(chunks);
  });
}
```

### 4.2 Hook: `experimental.chat.messages.transform`

```js
"experimental.chat.messages.transform": async (_input, output) => {
  if (!output.messages || !Array.isArray(output.messages)) return;
  
  const pipeline = createPipeline(config);
  
  // Process each message
  const processedMessages = output.messages.map(msg => {
    if (!msg || !msg.parts) return msg;
    
    const text = extractText(msg.parts);
    const chunks = pipeline.run(text);
    msg.parts = reconstructParts(chunks);
    msg._chunks = chunks; // Simpan untuk dedup stage
    return msg;
  });
  
  // Dedup antar messages (batch processing)
  const allChunks = processedMessages.map(m => m._chunks);
  pipeline.deduplicate(allChunks);
  
  // History management setelah dedup
  if (config.maxHistoryMessages > 0 && processedMessages.length > config.maxHistoryMessages) {
    if (config.useSummarization) {
      processedMessages = manageHistory(processedMessages, config.maxHistoryMessages);
    } else {
      processedMessages = processedMessages.slice(-config.maxHistoryMessages);
    }
  }
  
  output.messages = processedMessages;
}
```

### 4.3 Hook: `chat.message`

```js
"chat.message": async (input, output) => {
  if (!output.parts || !Array.isArray(output.parts)) return;
  
  const pipeline = createPipeline(config);
  const text = extractText(output.parts);
  const chunks = pipeline.run(text);
  output.parts = reconstructParts(chunks);
}
```

---

## 5. Error Handling & Edge Cases

### 5.1 Graceful Degradation

```js
// pipeline/index.js
export function runPipeline(text, config) {
  try {
    const chunks = chunker.parse(text);
    const scored = scorer.score(chunks);
    const compressed = compressor.compress(scored, config);
    return compressed;
  } catch (err) {
    // Fallback: return original text sebagai single chunk
    logStats({ event: 'pipeline_error', error: err.message, fallback: 'original_text' });
    return [{ type: 'unknown', content: text, score: 1.0, compressLevel: 0.0 }];
  }
}
```

### 5.2 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Chunker gagal parse (nested brackets mismatch) | Fallback: treat entire text as single `unknown` chunk |
| String literal dengan escaped quotes | Regex handle `\"` dan `\'` |
| Code block tanpa language identifier | Default type = `code`, gunakan generic heuristik |
| Semua chunk score tinggi | Compression tetap dilakukan tapi ringan. Jangan skip. |
| Dedup false positive | Gunakan context window + threshold tuning |
| Message terlalu pendek | Skip dedup |
| Pipeline lambat (1000+ chunks) | Batasi max 500 chunks per message, truncate dan log warning |

### 5.3 Performance Budget

| Metric | Target |
|--------|--------|
| Pipeline latency per message | < 50ms untuk teks < 10KB |
| Memory usage | O(n) chunks, max 500 chunks per message |
| Deduplication batch size | Max 30 messages (sesuai `maxHistoryMessages`) |

---

## 6. Backward Compatibility

### 6.1 Config Mapping

Config lama tetap valid. Pipeline otomatis map config lama ke config baru:

```js
// config.js
const defaults = {
  // Config lama
  pruneSystemPrompt: true,
  pruneUserMessages: true,
  pruneAssistantMessages: true,
  compressionLevel: 0.3,
  maxHistoryMessages: 30,
  useSummarization: true,
  enableLogging: true,
  
  // Config baru (v3)
  usePipeline: true,           // Enable/disable pipeline baru
  dedupThreshold: 0.85,        // Jaccard similarity threshold
  maxChunksPerMessage: 500,    // Safety limit
  enableBenchmark: false,      // Mode benchmark
};
```

### 6.2 Legacy Mode

User bisa disable pipeline dan pakai legacy mode:

```jsonc
{
  "usePipeline": false  // fallback ke compressor.js & pruner.js lama
}
```

### 6.3 Legacy Folder

Modul lama dipindahkan ke `legacy/` tetap bisa dipakai kalau pipeline disabled.

---

## 7. Testing Strategy

### 7.1 Test Categories

| Category | Scope | Contoh |
|----------|-------|--------|
| **Unit Tests** | Setiap stage pipeline secara isolasi | Chunker mengenali `function` block |
| **Integration Tests** | Pipeline end-to-end | Input kode → output compressed yang benar |
| **Regression Tests** | Kasus bug yang pernah terjadi | String literal `"https://"` tidak di-split |
| **Benchmark Tests** | Efisiensi compression | Token before/after untuk sample teks |

### 7.2 Test Structure

```
tests/
├── unit/
│   ├── chunker.test.js
│   ├── scorer.test.js
│   ├── compressor.test.js
│   └── dedup.test.js
├── integration/
│   └── pipeline.test.js
├── regression/
│   └── string-literal-bug.test.js
└── benchmark/
    └── compression-ratio.test.js
```

### 7.3 Key Test Cases

**Chunker:**
- Parse function block → 1 chunk type `code`
- String literal dengan escaped quotes → 1 chunk, tidak pecah
- Mixed: code + comment + string → 3 chunks terpisah

**Scorer:**
- `// TODO: fix this` → score 0.9
- `// hello world` → score 0.2
- `IMPORTANT: jangan ubah ini` → score 1.0

**Compressor:**
- Chunk score 1.0 + global level 0.5 → compress level 0.0 (no change)
- Chunk score 0.0 + global level 0.5 → compress level 0.5 (aggressive)

**Dedup:**
- Message 1 dan Message 3 punya chunk identikal → Message 3 ditandai redundant

### 7.4 Fixtures

```
tests/fixtures/
├── sample-react-component.js
├── sample-python-script.py
├── sample-system-prompt.md
└── sample-conversation.json
```

---

## 8. Success Criteria

Pangkas v3 dianggap sukses jika:

1. **Compression lebih pintar**: Instruksi penting tidak di-compress, noise di-compress agresif
2. **Zero breaking changes**: Config lama tetap berfungsi
3. **Tidak merusak konteks**: Semua regression test pass (string literal, komentar penting, dll)
4. **Performance**: Latency pipeline < 50ms per message (< 10KB)
5. **Test coverage**: Minimal 80% untuk pipeline/
6. **Token savings**: Hemat token ≥ v2 untuk semua sample fixtures

---

## 9. Future Roadmap (Post-v3)

| Feature | Deskripsi |
|---------|-----------|
| **User Profiling** | Belajar preferensi user dari waktu ke waktu (butuh persistence) |
| **Multi-language Chunker** | Support lebih banyak bahasa pemrograman (Go, Rust, Java) |
| **Diff-based Compression** | Kirim diff antar message untuk code yang sama |
| **Semantic Cache** | Implementasi lokal tanpa ChromaDB (in-memory similarity) |
| **Model Router** | Smart routing berdasarkan complexity task (bukan keyword) |

---

## 10. References

- Supermemory: https://supermemory.ai
- Supermemory Pricing: https://supermemory.ai/pricing
- Supermemory llms.txt: https://supermemory.ai/llms.txt
- Pangkas v2 Source: `/pangkas/legacy/`

---

*Design approved. Ready for implementation planning.*
