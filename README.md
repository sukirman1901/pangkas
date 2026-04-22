# Pangkas

Plugin to **save AI tokens in OpenCode** — *concise but meaningful*.

Pangkas works behind the scenes to reduce the number of tokens sent to the AI model, without losing important context. Lower costs, faster responses, without sacrificing response quality.

---

## What is Pangkas?

When chatting with AI in OpenCode, all messages, system prompts, and context are sent to the model as tokens. The longer the context, the higher the cost and response time.

**Pangkas** solves this with three main strategies:

| Strategy | Description | Result |
|----------|-------------|--------|
| **Semantic Pruning** | Removes "noise" comments (empty comments, separators, greetings), but **preserves** important comments like `TODO`, `FIXME`, `@param`, `eslint-disable`, etc. | Code stays readable and informative |
| **Smart Compression** | Compresses whitespace gradually based on the chosen level. Conservative level only removes trailing whitespace; aggressive level can minimize further. | Reduces tokens without breaking structure |
| **Smart History** | No brute truncate! Older unimportant messages are *summarized*, messages with important instructions are preserved. First and last messages are always safe. | Long context stays relevant |
| **v3 Pipeline** | *Context-aware* pipeline with chunker → scorer → compressor → dedup. Important instructions are not compressed, string literals are safe, redundancy across messages is removed. | Save 15%+ tokens without losing context |

---

## v3 Pipeline (Context-Aware)

Pangkas v3 uses a smarter new pipeline:

### Stages

1. **Chunker** — Understands text structure (string literals, comments, instructions, separators)
2. **Scorer** — Assigns importance score to each chunk (0.0 = noise, 1.0 = critical)
3. **Compressor** — Adaptive compression based on score (important = not compressed, noise = aggressive)
4. **Dedup** — Detects and removes redundancy across messages

### v3 Advantages

- **Smart**: Important instructions (TODO, FIXME, IMPORTANT) are not compressed
- **Safe**: String literals are not damaged by compression
- **Efficient**: Save 15%+ tokens without losing important context
- **Backward Compatible**: Can fallback to v2 with `usePipeline: false`

---

## Installation

1. **Clone or copy** this plugin to the OpenCode plugins folder:

   ```bash
   # Clone into OpenCode plugins folder
   git clone https://github.com/sukirman1901/pangkas.git ~/.config/opencode/plugins/pangkas
   ```

2. **Create a wrapper file** `pangkas.js` in the plugins folder (so OpenCode can load the plugin):

   ```bash
   cd ~/.config/opencode/plugins/
   ln -s pangkas/pangkas.js pangkas.js
   ```

   Or copy the wrapper file:
   ```bash
   cp ~/.config/opencode/plugins/pangkas/pangkas.js ~/.config/opencode/plugins/pangkas.js
   ```

3. **Register the plugin** in OpenCode config (`~/.config/opencode/config.json`):

   ```json
   {
     "plugin": ["pangkas"]
   }
   ```

4. **(Optional) Create config** `pangkas.jsonc` in the project root:

   ```jsonc
   {
     // Compression level: 0.0 (none) to 1.0 (maximum)
     "compressionLevel": 0.3,

     // Maximum messages in history
     "maxHistoryMessages": 30,

     // Use summarization for old messages
     "useSummarization": true,

     // Token statistics logging
     "enableLogging": true,

     // v3 Pipeline
     "usePipeline": true,         // enable new pipeline
     "dedupThreshold": 0.85,      // deduplication threshold
     "maxChunksPerMessage": 500   // safety limit
   }
   ```

---

## Configuration

Pangkas can be configured via **file** (`pangkas.jsonc`) or **environment variable**:

| File Key | Environment Variable | Default | Description |
|----------|---------------------|---------|-------------|
| `compressionLevel` | `PANGKAS_COMPRESSION` | `0.3` | Compression level (0.0 - 1.0) |
| `maxHistoryMessages` | `PANGKAS_MAX_HISTORY` | `30` | History message limit |
| `useSummarization` | `PANGKAS_SUMMARIZE` | `true` | Summarize old messages (not delete) |
| `pruneSystemPrompt` | `PANGKAS_PRUNE_SYSTEM` | `true` | Prune system prompt |
| `pruneUserMessages` | `PANGKAS_PRUNE_USER` | `true` | Prune user messages |
| `pruneAssistantMessages` | `PANGKAS_PRUNE_ASSISTANT` | `true` | Prune assistant messages |
| `enableLogging` | `PANGKAS_LOG` | `true` | Log statistics to console |
| `usePipeline` | — | `true` | Use v3 pipeline (chunker→scorer→compressor→dedup) |
| `dedupThreshold` | — | `0.85` | Jaccard similarity threshold for deduplication (0.0-1.0) |
| `maxChunksPerMessage` | — | `500` | Safety limit for chunks per message |

**Environment variables** will override values in the config file.

### Compression Levels

- **0.0 - 0.3** (`conservative`): Only remove trailing whitespace and normalize newlines. Safe for all cases.
- **0.3 - 0.5** (`moderate`): Remove double spaces, max 1 empty line. Still very readable.
- **0.5 - 0.7** (`aggressive`): Compress whitespace around safe operators (`,`, `;`, `(`, `)`). Be careful for code that highly depends on formatting.
- **0.7 - 1.0** (`very aggressive`): Minimal readability, only for emergency token saving.

---

## File Structure

```
pangkas/
├── pangkas.js            # Plugin wrapper (entry point for OpenCode)
├── index.js              # Plugin entry point & hooks
├── config.js             # Configuration loader (env + file)
├── logger.js             # Statistics logging
├── dashboard.js          # Real-time token dashboard (v3)
├── start-dashboard.js    # Dashboard startup script
├── package.json          # Package metadata & test scripts
├── pipeline/             # v3: Context-Aware Pipeline
│   ├── index.js          # Pipeline orchestrator
│   ├── chunker.js        # Smart text chunking
│   ├── scorer.js         # Importance scoring
│   ├── compressor.js     # Adaptive compression
│   └── dedup.js          # Deduplication
├── legacy/               # v2 modules (backward compat)
│   ├── compressor.js
│   ├── pruner.js
│   └── history-manager.js
├── tests/                # Test suites
├── types.ts              # TypeScript type definitions
└── README.md             # This file
```

---

## Usage Tips

| Scenario | Recommendation |
|----------|----------------|
| **Short chat** (< 10 messages) | Use default (`compressionLevel: 0.3`) |
| **Large code review** | Increase to `compressionLevel: 0.5` |
| **Long conversation** | Default is enough (30 messages + auto summarize) |
| **Complex debugging** | Disable `pruneUserMessages` if needed (`PANGKAS_PRUNE_USER=false`) |
| **Maximum token saving** | Increase to `0.7`, but watch readability |
| **Project with lots of JSDoc** | Keep `pruneSystemPrompt: true` — important comments will stay |
| **v3 Pipeline issues** | Fallback to v2: `usePipeline: false` |
| **Monitor savings** | Run dashboard: `node start-dashboard.js` |

---

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:regression
npm run test:benchmark
```

---

## License

MIT
