# Pangkas

Plugin untuk menghemat token AI pada OpenCode — **ringkas tapi bermakna**.

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
## Tips Penggunaan

1. **Chat pendek** (< 10 messages): Gunakan default (conservative)
2. **Code review besar**: Naikkan ke `compressionLevel: 0.5`
3. **Conversation panjang**: Default sudah cukup (30 messages + summarize)
4. **Debugging kompleks**: Matikan pruning user messages jika perlu

## License

MIT
