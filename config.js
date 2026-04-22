// Helper baca konfigurasi Pangkas
import fs from "fs";
import path from "path";

// Helper: baca file JSONC (abaikan komentar)
function readJSONC(filePath) {
  try {
    let raw = fs.readFileSync(filePath, "utf-8");
    raw = raw.replace(/\/\/.*$/gm, ""); // hapus komentar //
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getPangkasConfig() {
  // Nilai DEFAULT yang KONSERVATIF
  // Prinsip: hemat token tapi jangan rusak context quality
  const defaults = {
    // --- Pruning Settings ---
    // true = hapus komentar noise, tapi PERTAHANKAN komentar penting
    pruneSystemPrompt: true,
    pruneUserMessages: true,
    pruneAssistantMessages: true,
    
    // --- Compression Settings ---
    // Level 0.0 - 1.0 (0 = no compression, 1 = max)
    // 0.3 = conservative: hanya trailing whitespace, normalize newline
    // 0.5 = moderate: juga hapus spasi ganda
    // 0.7 = aggressive: whitespace operators
    // 0.9 = very aggressive: minimal readability
    compressionLevel: 0.3,
    
    // --- History Management ---
    // maxHistoryMessages: batas total messages (termasuk summary)
    // 0 = tidak ada batas
    maxHistoryMessages: 30,
    
    // --- Summary Settings ---
    // true = summarize messages yang di-drop, bukan hapus mentah-mentah
    useSummarization: true,
    
    // --- Logging ---
    // true = log ke console dan file
    enableLogging: true,
  };
  
  // 1. Cek env
  const env = {
    pruneSystemPrompt: process.env.PANGKAS_PRUNE_SYSTEM === 'false' ? false : undefined,
    pruneUserMessages: process.env.PANGKAS_PRUNE_USER === 'false' ? false : undefined,
    pruneAssistantMessages: process.env.PANGKAS_PRUNE_ASSISTANT === 'false' ? false : undefined,
    compressionLevel: process.env.PANGKAS_COMPRESSION ? Number(process.env.PANGKAS_COMPRESSION) : undefined,
    maxHistoryMessages: process.env.PANGKAS_MAX_HISTORY ? Number(process.env.PANGKAS_MAX_HISTORY) : undefined,
    useSummarization: process.env.PANGKAS_SUMMARIZE === 'false' ? false : undefined,
    enableLogging: process.env.PANGKAS_LOG === 'false' ? false : undefined,
  };
  
  // 2. Cek file config (pangkas.jsonc di root project)
  const configPath = path.resolve(process.cwd(), "pangkas.jsonc");
  const fileConfig = readJSONC(configPath);
  
  // 3. Merge (env > file > default)
  const merged = {
    ...defaults,
    ...fileConfig,
    ...env,
  };
  
  // 4. Pastikan field penting tidak undefined
  for (const key of Object.keys(defaults)) {
    if (merged[key] === undefined) merged[key] = defaults[key];
  }
  
  // 5. Clamp compression level
  merged.compressionLevel = Math.max(0, Math.min(1, merged.compressionLevel));
  
  return merged;
}
