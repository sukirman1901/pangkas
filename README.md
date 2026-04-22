# Pangkas

Plugin untuk **menghemat token AI pada OpenCode** — *ringkas tapi bermakna*.

Pangkas bekerja di balik layar untuk mengurangi jumlah token yang dikirim ke model AI, tanpa menghilangkan konteks penting. Lebih hemat biaya, lebih cepat, tanpa mengorbankan kualitas respons.

---

## Apa itu Pangkas?

Saat chat dengan AI di OpenCode, semua pesan, system prompt, dan konteks dikirim ke model dalam bentuk token. Semakin panjang konteks, semakin besar biaya dan waktu responsnya.

**Pangkas** menyelesaikan masalah ini dengan tiga strategi utama:

| Strategi | Deskripsi | Hasil |
|----------|-----------|-------|
| **Semantic Pruning** | Hapus komentar "noise" (komentar kosong, separator, sapaan), tapi **pertahankan** komentar penting seperti `TODO`, `FIXME`, `@param`, `eslint-disable`, dsb. | Kode tetap readable dan informatif |
| **Smart Compression** | Kompres whitespace secara bertahap sesuai level yang dipilih. Level konservatif hanya hapus trailing whitespace; level agresif bisa minimalis lebih jauh. | Mengurangi token tanpa merusak struktur |
| **Smart History** | Bukan brute truncate! Pesan lama yang tidak penting di-*summarize*, pesan dengan instruksi penting tetap dipertahankan. Pesan pertama dan terakhir selalu aman. | Konteks panjang tetap relevan |

---

## Instalasi

1. **Clone atau copy** plugin ini ke folder `.pangkas/` di dalam workspace OpenCode kamu, atau ke lokasi yang kamu inginkan.

2. **Daftarkan plugin** di konfigurasi OpenCode (`mcpServers` atau setup plugin lokal):

   ```json
   {
     "mcpServers": {
       "pangkas": {
         "command": "node",
         "args": ["/path/to/pangkas/index.js"]
       }
     }
   }
   ```

   Atau sesuaikan dengan cara plugin OpenCode yang kamu pakai.

3. **(Opsional) Buat konfigurasi** `pangkas.jsonc` di root project:

   ```jsonc
   {
     // Level kompresi: 0.0 (tidak ada) sampai 1.0 (maksimal)
     "compressionLevel": 0.3,

     // Maksimal pesan dalam history
     "maxHistoryMessages": 30,

     // Gunakan summarization untuk pesan lama
     "useSummarization": true,

     // Logging statistik token
     "enableLogging": true
   }
   ```

---

## Konfigurasi

Pangkas bisa dikonfigurasi melalui **file** (`pangkas.jsonc`) atau **environment variable**:

| File Key | Environment Variable | Default | Keterangan |
|----------|---------------------|---------|------------|
| `compressionLevel` | `PANGKAS_COMPRESSION` | `0.3` | Level kompresi (0.0 - 1.0) |
| `maxHistoryMessages` | `PANGKAS_MAX_HISTORY` | `30` | Batas jumlah pesan history |
| `useSummarization` | `PANGKAS_SUMMARIZE` | `true` | Summarize pesan lama (bukan hapus) |
| `pruneSystemPrompt` | `PANGKAS_PRUNE_SYSTEM` | `true` | Prune system prompt |
| `pruneUserMessages` | `PANGKAS_PRUNE_USER` | `true` | Prune pesan user |
| `pruneAssistantMessages` | `PANGKAS_PRUNE_ASSISTANT` | `true` | Prune pesan assistant |
| `enableLogging` | `PANGKAS_LOG` | `true` | Log statistik ke console |

**Environment variable** akan menimpa nilai di file config.

### Level Kompresi

- **0.0 - 0.3** (`conservative`): Hanya hapus trailing whitespace dan normalize newline. Aman untuk semua kasus.
- **0.3 - 0.5** (`moderate`): Hapus spasi ganda, max 1 baris kosong. Masih sangat readable.
- **0.5 - 0.7** (`aggressive`): Kompres whitespace di sekitar operator aman (`,`, `;`, `(`, `)`). Hati-hati untuk kode yang sangat bergantung pada formatting.
- **0.7 - 1.0** (`very aggressive`): Minimal readability, hanya untuk emergency token saving.

---

## File Structure

```
pangkas/
├── index.js           # Plugin entry point & hooks
├── config.js          # Configuration loader (env + file)
├── pruner.js          # Semantic comment pruning
├── compressor.js      # Smart whitespace compression
├── history-manager.js # Smart history with summarization
├── logger.js          # Statistics logging
├── router.js          # Model routing (placeholder)
├── semantic-cache.js  # Semantic cache (placeholder)
├── types.ts           # TypeScript type definitions
└── README.md          # This file
```

---

## Tips Penggunaan

| Skenario | Rekomendasi |
|----------|-------------|
| **Chat pendek** (< 10 pesan) | Gunakan default (`compressionLevel: 0.3`) |
| **Code review besar** | Naikkan ke `compressionLevel: 0.5` |
| **Conversation panjang** | Default sudah cukup (30 pesan + summarize otomatis) |
| **Debugging kompleks** | Matikan `pruneUserMessages` jika perlu (`PANGKAS_PRUNE_USER=false`) |
| **Hemat token maksimal** | Naikkan ke `0.7`, tapi perhatikan readability |
| **Project dengan banyak JSDoc** | Biarkan `pruneSystemPrompt: true` — komentar penting akan tetap ada |

---

## License

MIT
