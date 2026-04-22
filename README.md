# Pangkas OpenCode Plugin

> Optimasi token & performa LLM di OpenCode dengan context pruning, kompresi, cache, dan smart routing.

---

## Fitur Utama
- Pruning context/kode sebelum dikirim ke LLM
- Kompresi prompt otomatis
- Semantic cache (vector DB, siap integrasi)
- Smart routing model (hemat biaya)
- Logging statistik token & cost

## Struktur Folder
- `.opencode/plugins/pangkas/` — Source utama plugin
- `docs/` — Dokumentasi fitur, plan, arsitektur
- `tests/` — Unit test
- `scripts/` — Script tambahan (opsional)

## Setup & Penggunaan
1. **Clone repo ini ke project OpenCode Anda**
2. **Install dependencies** (jika ada):
	```bash
	bun install
	```
3. **Pastikan struktur**:
	- `.opencode/plugins/pangkas/` berisi file index.ts, pruner.ts, dst.
	- `pangkas.jsonc` di root project untuk konfigurasi.
4. **Jalankan test** untuk validasi:
	```bash
	bun test
	```
5. **Aktifkan plugin** di OpenCode (otomatis jika di folder `.opencode/plugins/`).
6. **Gunakan seperti biasa** — pipeline optimasi berjalan otomatis sebelum eksekusi tool.

## Konfigurasi
Edit file `pangkas.jsonc` di root project:
```jsonc
{
  "similarityThreshold": 0.95,
  "compactionThreshold": 0.8,
  "maxMemories": 5,
  "compressionLevel": 0.6
}
```
Atau override lewat environment variable:
- `PANGKAS_SIMILARITY`, `PANGKAS_COMPACTION`, `PANGKAS_MAX_MEM`, `PANGKAS_COMPRESSION`

## Dokumentasi Lengkap
Lihat folder `docs/` untuk plan, fitur, dan arsitektur.

---

© 2026 Pangkas Team
