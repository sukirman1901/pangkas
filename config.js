// Helper baca konfigurasi Pangkas
import fs from "fs";
import path from "path";
import os from "os";

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
    
    // --- v3 Pipeline Settings ---
    // true = gunakan pipeline baru (chunker → scorer → compressor → dedup)
    usePipeline: true,
    // Threshold Jaccard similarity untuk deduplication (0.0 - 1.0)
    dedupThreshold: 0.85,
    // Batas maksimal chunks per message (safety limit)
    maxChunksPerMessage: 500,
    // true = aktifkan mode benchmark (hitung token savings)
    enableBenchmark: false,
    
    // --- Session Memory ---
    // true = simpan/load session memory antar restart
    enableSessionMemory: true,
    // Maksimal karakter summary yang di-inject ke prompt
    maxMemoryInjectLength: 500,
    // true = tampilkan indicator [Loaded context...]
    memoryInjectIndicator: true,

    // --- Dashboard ---
    // true = auto-start web dashboard di localhost
    enableDashboard: true,
    // Port untuk dashboard (default: 8765)
    dashboardPort: 8765,
    // Context limit model AI (default: 200000)
    contextLimit: 200000,
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
    usePipeline: process.env.PANGKAS_USE_PIPELINE === 'false' ? false : undefined,
    dedupThreshold: process.env.PANGKAS_DEDUP_THRESHOLD ? Number(process.env.PANGKAS_DEDUP_THRESHOLD) : undefined,
    maxChunksPerMessage: process.env.PANGKAS_MAX_CHUNKS ? Number(process.env.PANGKAS_MAX_CHUNKS) : undefined,
    enableBenchmark: process.env.PANGKAS_BENCHMARK === 'true' ? true : undefined,
    enableDashboard: process.env.PANGKAS_DASHBOARD === 'false' ? false : undefined,
    dashboardPort: process.env.PANGKAS_DASHBOARD_PORT ? Number(process.env.PANGKAS_DASHBOARD_PORT) : undefined,
    contextLimit: process.env.PANGKAS_CONTEXT_LIMIT ? Number(process.env.PANGKAS_CONTEXT_LIMIT) : undefined,
    enableSessionMemory: process.env.PANGKAS_SESSION_MEMORY === 'false' ? false : undefined,
    maxMemoryInjectLength: process.env.PANGKAS_MEMORY_LENGTH ? Number(process.env.PANGKAS_MEMORY_LENGTH) : undefined,
  };
  
  // 2. Cek file config di beberapa lokasi
  //    a. plugin dir    b. cwd    c. home dir
  const pluginDir = path.dirname(new URL(import.meta.url).pathname);
  const configPaths = [
    path.resolve(process.cwd(), "pangkas.jsonc"),
    path.resolve(pluginDir, "pangkas.jsonc"),
    path.resolve(os.homedir(), ".config/opencode/pangkas.jsonc"),
  ];

  let fileConfig = {};
  for (const p of configPaths) {
    fileConfig = readJSONC(p);
    if (Object.keys(fileConfig).length > 0) break;
  }
  
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
  
  // 6. Clamp v3 pipeline settings
  if (merged.dedupThreshold !== undefined) {
    merged.dedupThreshold = Math.max(0, Math.min(1, merged.dedupThreshold));
  }
  if (merged.maxChunksPerMessage !== undefined) {
    merged.maxChunksPerMessage = Math.max(10, Math.min(10000, merged.maxChunksPerMessage));
  }
  
  return merged;
}
