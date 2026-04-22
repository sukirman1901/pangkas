# Fitur Pangkas OpenCode Plugin

## Fitur Utama
- **Pruning & Compression**: Otomatis memangkas context yang tidak relevan dan mengkompres prompt sebelum dikirim ke LLM.
- **Semantic Cache**: Menyimpan response untuk prompt yang mirip, mengurangi pemanggilan LLM yang tidak perlu.
- **Smart Routing**: Memilih model LLM berdasarkan tingkat kesulitan tugas (hemat biaya dan waktu).
- **Token Logging & Monitoring**: Mencatat statistik token sebelum/sesudah optimasi.
- **Configurable Thresholds**: Semua ambang batas (similarity, compaction, dsb) bisa diatur di config.

## Fitur Teknis
- Pruner module: Hapus komentar, baris kosong, fungsi tidak relevan dari kode.
- Compressor module: Kompres prompt hasil pruning.
- Semantic cache: Cek cache sebelum memanggil LLM, gunakan similarity >95%.
- Routing engine: Pilih model hemat biaya.
- Token usage logging: Catat statistik token dan cost.
- Configurable: Semua threshold dan rules bisa diatur lewat config.

## Integrasi
- Supermemory untuk persistent memory.
- ChromaDB untuk semantic cache.
- LLMLingua untuk kompresi prompt.

## Catatan
- Fitur modular, mudah dikembangkan.
- Bisa diintegrasikan dengan dashboard monitoring.
- Context injection harus sudah dioptimasi tokennya.
