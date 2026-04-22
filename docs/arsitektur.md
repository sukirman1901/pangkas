# Arsitektur Pangkas OpenCode Plugin

## Komponen Utama
- **Pruner**: Memangkas context/kode sebelum dikirim ke LLM.
- **Compressor**: Mengkompres prompt hasil pruning.
- **Semantic Cache**: Menyimpan dan mencari response berbasis embedding (ChromaDB).
- **Router**: Memilih model LLM berdasarkan analisis prompt.
- **Logger**: Mencatat statistik token, cost, dan aktivitas plugin.
- **Config**: Pengaturan threshold, rules, dan integrasi.

## Alur Kerja
1. Input diterima dari OpenCode (format OpenAI-compatible).
2. Pruner memangkas context/kode.
3. Compressor mengkompres prompt.
4. Cek semantic cache:
   - Jika cache hit (>95% similarity), ambil response lama.
   - Jika miss, lanjut ke LLM.
5. Router memilih model LLM (hemat biaya/performa).
6. Response dikirim ke user, statistik dicatat oleh Logger.

## Integrasi
- **Supermemory**: Persistent memory lintas sesi/proyek.
- **ChromaDB**: Vector DB untuk semantic cache.
- **LLMLingua**: Library kompresi prompt.

## Diagram Sederhana

```
[Input] -> [Pruner] -> [Compressor] -> [Semantic Cache] --(miss)--> [Router] -> [LLM]
                                               |                              |
                                               +--(hit)--> [Response] <------+
```

## Catatan
- Semua modul terintegrasi di plugin index.ts
- Modular, mudah dikembangkan dan di-maintain
