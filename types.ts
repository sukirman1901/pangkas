// Definisi tipe data untuk plugin Pangkas v3

export interface ChunkMetadata {
  lineStart: number;
  lineEnd: number;
  language?: string;
  isImportant?: boolean;
  isRedundant?: boolean;
}

export interface Chunk {
  type: 'code' | 'comment' | 'string_literal' | 'instruction' | 'separator' | 'unknown';
  content: string;
  score: number;
  compressLevel: number;
  metadata: ChunkMetadata;
}

export interface PangkasConfig {
  // --- Pruning Settings ---
  /** Hapus komentar noise dari system prompt */
  pruneSystemPrompt: boolean;
  /** Hapus komentar noise dari user messages */
  pruneUserMessages: boolean;
  /** Hapus komentar noise dari assistant messages */
  pruneAssistantMessages: boolean;

  // --- Compression Settings ---
  /** Level kompresi: 0.0 (none) - 1.0 (max) */
  compressionLevel: number;

  // --- History Management ---
  /** Batas maksimal messages dalam history (0 = unlimited) */
  maxHistoryMessages: number;
  /** Gunakan summarization untuk messages yang di-drop */
  useSummarization: boolean;

  // --- Logging ---
  /** Aktifkan logging ke console dan file */
  enableLogging: boolean;

  // --- v3 Pipeline Settings ---
  /** Gunakan pipeline baru (chunker → scorer → compressor → dedup) */
  usePipeline: boolean;
  /** Threshold Jaccard similarity untuk deduplication (0.0 - 1.0) */
  dedupThreshold: number;
  /** Batas maksimal chunks per message (safety limit) */
  maxChunksPerMessage: number;
  /** Aktifkan mode benchmark (hitung token savings) */
  enableBenchmark: boolean;
}
