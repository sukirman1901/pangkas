// Modul History Manager: smart history dengan summarization, bukan brute truncate

/**
 * Buat ringkasan singkat dari satu message exchange (user + assistant)
 * @param {object} msg - message object
 * @returns {string|null} - summary atau null jika tidak bisa disummarize
 */
function summarizeMessage(msg) {
  if (!msg || !msg.parts) return null;
  
  const text = msg.parts
    .map(p => (p && typeof p.text === 'string') ? p.text : '')
    .join(' ')
    .trim();
  
  if (text.length < 50) return text; // Sudah ringkas, tidak perlu summarize
  
  // Extract key decisions/statements
  const lines = text.split('\n').filter(l => l.trim());
  const keyPoints = [];
  
  // Cari baris yang mengandung keputusan, instruksi, atau hasil
  for (const line of lines.slice(0, 5)) { // Ambil 5 baris pertama saja
    const trimmed = line.trim();
    if (
      /^\d+\.\s/.test(trimmed) || // Numbered list
      /^[-*]\s/.test(trimmed) || // Bullet
      /^(decided|approved|confirmed|using|created|added|fixed|refactored):/i.test(trimmed) ||
      /^(i will|let's|we should|the plan is)/i.test(trimmed)
    ) {
      keyPoints.push(trimmed.substring(0, 80));
    }
  }
  
  if (keyPoints.length === 0) {
    // Fallback: ambil kalimat pertama
    const firstSentence = text.match(/^[^.!?]{10,120}[.!?]/);
    if (firstSentence) return firstSentence[0].trim();
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  }
  
  return keyPoints.join('; ');
}

/**
 * Cek apakah message mengandung instruksi penting yang harus dipertahankan
 * @param {object} msg - message object
 * @returns {boolean}
 */
function containsImportantInstruction(msg) {
  if (!msg || !msg.parts) return false;
  
  const text = msg.parts
    .map(p => (p && typeof p.text === 'string') ? p.text : '')
    .join(' ');
  
  const importantPatterns = [
    /\b(don'?t|never|always|must|should|important|critical|remember to)\b.{0,100}(?:use|add|remove|change|keep|avoid)/i,
    /\b(context|standard|pattern|rule|guideline)\b.{0,50}(?:is|are|follow|use)/i,
    /\b(decided|agreed|approved|confirmed)\b.{0,100}(?:use|go with|choose|pick)/i,
  ];
  
  return importantPatterns.some(p => p.test(text));
}

/**
 * Smart history management:
 * 1. Pertahankan message awal (biasanya berisi instruksi/state awal)
 * 2. Pertahankan message terakhir (current context)
 * 3. Summarize messages di tengah yang tidak penting
 * 4. Jangan pernah hapus message dengan instruksi penting
 * 
 * @param {Array} messages - array messages
 * @param {number} maxMessages - batas maksimal
 * @returns {Array} - messages yang sudah di-manage
 */
export function manageHistory(messages, maxMessages = 30) {
  if (!messages || messages.length <= maxMessages) return messages;
  
  const total = messages.length;
  const keepFirst = 2;  // Simpan 2 message pertama (biasanya instruksi)
  const keepLast = Math.min(8, Math.floor(maxMessages * 0.4)); // Simpan 8 terakhir atau 40%
  const middleAvailable = maxMessages - keepFirst - keepLast;
  
  const firstMessages = messages.slice(0, keepFirst);
  const lastMessages = messages.slice(-keepLast);
  
  // Messages di tengah yang akan disummarize atau di-drop
  const middleMessages = messages.slice(keepFirst, -keepLast);
  
  // Identifikasi message penting di tengah
  const importantMiddle = middleMessages.filter(containsImportantInstruction);
  
  // Sisakan slot untuk summarize dari yang tidak penting
  const summarySlot = 1;
  const importantSlots = Math.min(importantMiddle.length, middleAvailable - summarySlot);
  
  const keptImportant = importantMiddle.slice(0, importantSlots);
  
  // Summarize messages yang di-drop
  const droppedCount = middleMessages.length - keptImportant.length;
  if (droppedCount > 0) {
    const summaries = middleMessages
      .slice(0, Math.min(5, droppedCount)) // Summarize max 5 yang paling awal
      .map(summarizeMessage)
      .filter(Boolean);
    
    if (summaries.length > 0) {
      const summaryText = `[Previous context: ${droppedCount} messages summarized] ` + 
        summaries.join('; ');
      
      const summaryMessage = {
        role: 'system',
        parts: [{ text: summaryText }],
        _pangkas_summary: true,
      };
      
      return [
        ...firstMessages,
        summaryMessage,
        ...keptImportant,
        ...lastMessages,
      ];
    }
  }
  
  return [
    ...firstMessages,
    ...keptImportant,
    ...lastMessages,
  ];
}
