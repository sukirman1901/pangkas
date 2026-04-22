// Definisi tipe data untuk plugin Pangkas
export interface PangkasConfig {
  similarityThreshold?: number;
  compactionThreshold?: number;
  maxMemories?: number;
  [key: string]: any;
}
