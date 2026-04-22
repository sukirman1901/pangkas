# Pangkas OpenCode Plugin — Project Plan

## Fase Pengembangan

### Alpha (Core)
- Implementasi Proxy FastAPI (jika standalone)
- Logging token dasar

### Beta (Optimization)
- Integrasi semantic cache (ChromaDB)
- Modul pruning kode (pruner) untuk .py dan .js

### RC (Advanced)
- Kompresi prompt (LLMLingua)
- Smart routing (Ollama/Gemini/Claude)
- Dashboard monitoring (Next.js, opsional)

### Stable (Release)
- Dockerization (opsional)
- Publikasi plugin

---

## Fitur Utama
- Pruning context/kode sebelum dikirim ke LLM
- Kompresi prompt untuk menghemat token
- Semantic cache (vector DB) untuk cache response
- Smart routing model (hemat biaya)
- Logging statistik token & cost
- Konfigurasi threshold & rules

---

## Struktur Folder (Direkomendasikan)

```
.opencode/
  plugins/
    pangkas/
      index.ts
      pruner.ts
      compressor.ts
      semantic-cache.ts
      router.ts
      logger.ts
      types.ts
      config.ts
  package.json
README.md
docs/
  plan.md
  fitur.md
  arsitektur.md
tests/
scripts/
```

---

## Todo List
- [ ] Buat struktur folder dan file dasar
- [ ] Implementasi modul pruner (pruning context/kode)
- [ ] Implementasi modul compressor (kompresi prompt)
- [ ] Implementasi modul semantic cache
- [ ] Implementasi modul smart router
- [ ] Implementasi modul logger & statistik
- [ ] Integrasi semua modul di plugin index.ts
- [ ] Buat file konfigurasi dan helper
- [ ] Buat README dan dokumentasi setup
- [ ] Testing dan validasi plugin

---

## Catatan Penting
- Semua threshold dan rules bisa diatur lewat config
- Integrasi dengan Supermemory untuk persistent memory
- Context injection harus sudah dioptimasi tokennya
- Fitur modular, mudah dikembangkan
