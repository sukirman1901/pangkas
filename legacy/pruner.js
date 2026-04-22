// Modul Pruner: semantic pruning yang membedakan komentar penting vs tidak penting

// Komentar penting yang harus DIPELIHARA
const IMPORTANT_COMMENT_PATTERNS = [
  /TODO|FIXME|HACK|XXX|BUG|WARN|WARNING|IMPORTANT|NOTE|CRITICAL|DEPRECATED/i,
  /@param|@returns|@throws|@example|@see/i,  // JSDoc/tsdoc
  /eslint-disable|noqa|pragma|prettier-ignore/i,
  /copyright|license|author|version/i,
  /^\s*[*#]\s+(?:step|phase|section|part)\s*\d+/i,  // Step markers
];

// Komentar "noise" yang bisa dihapus
const NOISE_PATTERNS = [
  /\/{2,}\s*$/,                    // Empty comment
  /\/{2,}\s*[-=]{3,}/,             // Separator comment
  /\/{2,}\s*(?:hi|hello|bye)/i,    // Greetings
  /^\s*\/\*\*?\s*\*\/\s*$/,       // Empty JSDoc block
];

/**
 * Cek apakah baris komentar mengandung informasi penting
 * @param {string} line - baris kode
 * @returns {boolean} true jika komentar penting
 */
function isImportantComment(line) {
  // Cari bagian komentarnya
  const commentMatch = line.match(/(\/{2,}|#)\s*(.+)/);
  if (!commentMatch) return false;
  
  const commentContent = commentMatch[2];
  
  // Cek noise pattern (langsung hapus)
  for (const noise of NOISE_PATTERNS) {
    if (noise.test(line)) return false;
  }
  
  // Cek important pattern
  for (const important of IMPORTANT_COMMENT_PATTERNS) {
    if (important.test(commentContent)) return true;
  }
  
  return false;
}

/**
 * Prune context/kode: hapus komentar noise tapi pelihara komentar penting.
 * Hapus baris kosong berlebih (max 1 baris kosong berturut-turut).
 * @param {string} input - kode atau context
 * @returns {string} - hasil pruning
 */
export function pruneContext(input) {
  if (!input || typeof input !== 'string') return input;
  
  const lines = input.split('\n');
  const result = [];
  let emptyLineCount = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Jika baris kosong
    if (trimmed === '') {
      if (emptyLineCount < 1) {
        result.push('');
        emptyLineCount++;
      }
      continue;
    }
    emptyLineCount = 0;
    
    // Jika baris mengandung komentar
    const hasLineComment = trimmed.startsWith('//') || trimmed.startsWith('#');
    
    if (hasLineComment) {
      // Pertahankan komentar penting
      if (isImportantComment(line)) {
        result.push(line);
      }
      // Hapus komentar noise (skip)
      continue;
    }
    
    // Jika kode mengandung trailing comment, pisah kode dan cek komentar
    const trailingCommentMatch = line.match(/^(.*?)(\s*\/{2,}.*|\s*#.*)$/);
    if (trailingCommentMatch) {
      const codePart = trailingCommentMatch[1];
      const commentPart = trailingCommentMatch[2].trim();
      
      // Cek apakah trailing comment penting
      if (isImportantComment(commentPart)) {
        result.push(line); // Pertahankan baris lengkap dengan komentar penting
      } else if (codePart.trim() !== '') {
        result.push(codePart); // Hanya kode, tanpa komentar noise
      }
      continue;
    }
    
    // Baris normal (tanpa komentar)
    result.push(line);
  }
  
  return result.join('\n').trim();
}
