# Pangkas Plugin v2

Plugin untuk menghemat token AI pada OpenCode — **ringkas tapi bermakna**.

## Prinsip

Tidak seperti plugin token-saver yang hanya menghapus komentar dan whitespace secara brutal, Pangkas v2 menggunakan pendekatan **semantic-aware** yang terinspirasi dari **Superpowers**:

- **Jaga komentar penting**: TODO, FIXME, WARNING, IMPORTANT, COPYRIGHT tetap ada
- **Hapus noise**: Komentar obvious dan kosong dihapus
- **Smart history**: Summarize conversation panjang, jangan hapus mentah-mentah
- **Pertahankan struktur**: Kode tetap readable, hanya whitespace berlebih yang dihapus

## Cara Kerja

### 1. Semantic Pruning
Membedakan komentar yang **penting** vs **noise**:

| Dihapus | Dipertahankan |
|---------|---------------|
| `// This is a helper function` | `// TODO: Add error handling` |
| `// Just a simple check` | `// WARNING: Jangan hapus ini!` |
| `// hi there` | `// Copyright 2024 Company` |
| `// =======` | `// FIXME: Memory leak here` |

### 2. Smart History Management
Dari 50 messages → 30 messages:

```
Pesan 1-2:  Dipertahankan (instruksi awal)
Pesan 3-42: Disummarize → "[Previous context: 40 messages summarized] ..."
Pesan 43-50: Dipertahankan (recent context)
```

### 3. Level Compression
- **0.0 - 0.3**: Conservative — hanya trailing whitespace
- **0.3 - 0.5**: Moderate — juga spasi ganda
- **0.5 - 0.7**: Aggressive — whitespace sekitar operators
- **0.7 - 1.0**: Very Aggressive — minimal readability

## Konfigurasi

### Via File (pangkas.jsonc di root project)

```jsonc
{
  "compressionLevel": 0.3,        // Default: conservative
  "maxHistoryMessages": 30,       // Default: 30 messages
  "useSummarization": true,       // Default: true
  "pruneSystemPrompt": true,      // Default: true
  "pruneUserMessages": true,      // Default: true
  "pruneAssistantMessages": true, // Default: true
  "enableLogging": true           // Default: true
}
```

### Via Environment Variables

```bash
export PANGKAS_COMPRESSION=0.5      # Level kompresi
export PANGKAS_MAX_HISTORY=40       # Batas history
export PANGKAS_SUMMARIZE=true       # Aktifkan summarization
export PANGKAS_PRUNE_USER=true      # Prune user messages
export PANGKAS_LOG=true             # Aktifkan logging
```

### Via opencode.json

```json
{
  "plugin": ["pangkas"]
}
```

## Perbandingan: v1 vs v2

| Fitur | v1 (Lama) | v2 (Baru) |
|-------|-----------|-----------|
| Komentar | Hapus SEMUA | Hapus noise, jaga penting |
| History | Potong dari depan | Summarize + inject summary |
| Compression | Regex brutal | Smart, context-aware |
| Default | Agresif (0.6) | Konservatif (0.3) |
| Hasil | Context rusak | Context terjaga |

## Log

Log tersimpan di: `~/.config/opencode/pangkas.log`

Contoh log:
```
[2026-04-22T10:59:08.832Z] {"event":"history_managed","originalCount":50,"newCount":30,"removedMessages":20,"summarization":true}
[2026-04-22T10:59:08.833Z] {"event":"messages_compressed","messagesProcessed":1,"originalTokens":75,"compressedTokens":68,"savedTokens":7}
```

## Tips Penggunaan

1. **Chat pendek** (< 10 messages): Gunakan default (conservative)
2. **Code review besar**: Naikkan ke `compressionLevel: 0.5`
3. **Conversation panjang**: Default sudah cukup (30 messages + summarize)
4. **Debugging kompleks**: Matikan pruning user messages jika perlu

## File Structure

```
pangkas/
├── index.js           # Plugin entry point
├── index.ts           # TypeScript source
├── pruner.js          # Semantic comment pruning
├── compressor.js      # Smart whitespace compression
├── history-manager.js # Smart history with summarization
├── config.js          # Configuration loader
├── logger.js          # Statistics logging
├── router.js          # Model routing (placeholder)
├── semantic-cache.js  # Semantic cache (placeholder)
├── types.ts           # TypeScript types
└── README.md          # This file
```

## License

MIT
