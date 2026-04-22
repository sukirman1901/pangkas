# Pangkas

Plugin untuk menghemat token AI pada OpenCode — **ringkas tapi bermakna**.

## File Structure

```
pangkas/
├── index.js              # Plugin entry point
├── config.js             # Configuration loader
├── logger.js             # Statistics logging
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
├── types.ts              # TypeScript types
└── README.md             # This file
```

## v3 Pipeline (Context-Aware)

Pangkas v3 menggunakan pipeline baru yang mengadopsi prinsip dari Supermemory:

### Stages

1. **Chunker** — Memahami struktur teks (string literal, komentar, instruksi, separator)
2. **Scorer** — Memberi skor pentingnya setiap chunk (0.0 = noise, 1.0 = critical)
3. **Compressor** — Kompresi adaptif berdasarkan skor (penting = tidak di-compress, noise = agresif)
4. **Dedup** — Deteksi dan hapus redundansi antar messages

### Keunggulan v3

- **Smart**: Instruksi penting (TODO, FIXME, IMPORTANT) tidak di-compress
- **Aman**: String literal tidak di-rusak oleh compression
- **Efisien**: Hemat token 15%+ tanpa kehilangan konteks penting
- **Backward Compatible**: Bisa fallback ke v2 dengan `usePipeline: false`

## Configuration

```jsonc
// pangkas.jsonc
{
  // v2 config (tetap valid)
  "compressionLevel": 0.3,
  "maxHistoryMessages": 30,
  "useSummarization": true,
  
  // v3 config
  "usePipeline": true,         // aktifkan pipeline baru
  "dedupThreshold": 0.85,      // threshold deduplication
  "maxChunksPerMessage": 500   // safety limit
}
```

## Tips Penggunaan

1. **Chat pendek** (< 10 messages): Gunakan default (conservative)
2. **Code review besar**: Naikkan ke `compressionLevel: 0.5`
3. **Conversation panjang**: Default sudah cukup (30 messages + summarize)
4. **Debugging kompleks**: Matikan pruning user messages jika perlu
5. **v3 Pipeline**: Default aktif, gunakan `usePipeline: false` kalau ada masalah

## Testing

```bash
# Run all tests
node --test tests/**/*.test.js

# Run specific test
node --test tests/unit/chunker.test.js
```

## License

MIT
