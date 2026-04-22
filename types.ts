// Definisi tipe data untuk plugin Pangkas v2
export interface PangkasConfig {
  /** Hapus komentar noise dari system prompt */
  pruneSystemPrompt: boolean;
  /** Hapus komentar noise dari user messages */
  pruneUserMessages: boolean;
  /** Hapus komentar noise dari assistant messages */
  pruneAssistantMessages: boolean;
  /** Level kompresi: 0.0 (none) - 1.0 (max) */
  compressionLevel: number;
  /** Batas maksimal messages dalam history (0 = unlimited) */
  maxHistoryMessages: number;
  /** Gunakan summarization untuk messages yang di-drop */
  useSummarization: boolean;
  /** Aktifkan logging ke console dan file */
  enableLogging: boolean;
}
