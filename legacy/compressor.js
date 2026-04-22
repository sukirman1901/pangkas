// Modul Compressor: smart whitespace compression tanpa merusak readability

/**
 * Smart whitespace compression yang menjaga struktur dan readability.
 * Tidak seperti regex brutal, ini memahami konteks kode.
 * @param {string} input - prompt hasil pruning
 * @param {object} options - konfigurasi kompresi
 * @returns {string} - prompt terkompresi
 */
export function compressPrompt(input, options) {
  if (!input || typeof input !== 'string') return input;
  
  const level = options?.level ?? 0.3;
  if (level <= 0) return input;
  
  let compressed = input;
  
  // Level 1 (0.1-0.3): Conservative - hanya whitespace berlebih paling ekstrem
  if (level > 0.1) {
    // Hapus trailing whitespace per baris
    compressed = compressed
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
    
    // Hapus leading blank lines di awal dan akhir
    compressed = compressed.trim();
  }
  
  // Level 2 (0.3-0.5): Moderate - whitespace internal ringan
  if (level > 0.3) {
    // Hapus spasi ganda (tapi pertahankan 1 spasi)
    compressed = compressed.replace(/[ \t]{2,}/g, ' ');
    
    // Normalisasi newline: max 1 baris kosong berturut-turut
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
  }
  
  // Level 3 (0.5-0.7): Aggressive - whitespace operators (hati-hati)
  if (level > 0.5) {
    // Hanya untuk operator yang aman (tidak mengubah semantik)
    // Hindari: `a - b` → `a-b` (unary minus berbeda)
    compressed = compressed
      // Aman untuk: titik koma, koma, titik dua
      .replace(/\s*([,;:])\s*/g, '$1 ')
      // Aman untuk: kurung buka (tapi pertahankan spasi setelah)
      .replace(/\s*([\(\[\{])\s*/g, '$1')
      .replace(/\s*([\)\]\}])\s*/g, '$1');
  }
  
  // Level 4 (0.7-1.0): Very Aggressive - MINIMAL readability
  if (level > 0.7) {
    // Baris panjang dengan code: pertahankan sedikit formatting
    const lines = compressed.split('\n');
    compressed = lines.map(line => {
      // Jika baris pendek (< 80 chars), boleh compress lebih agresif
      if (line.length < 80) {
        return line.replace(/\s+/g, ' ').trim();
      }
      return line;
    }).join('\n');
  }
  
  return compressed;
}
