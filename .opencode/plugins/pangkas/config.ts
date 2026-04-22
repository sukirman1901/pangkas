// Helper baca konfigurasi Pangkas
import type { PangkasConfig } from "./types";
import fs from "fs";
import path from "path";

// Helper: baca file JSONC (abaikan komentar)
function readJSONC(filePath: string): any {
  try {
    let raw = fs.readFileSync(filePath, "utf-8");
    raw = raw.replace(/\/\/.*$/gm, ""); // hapus komentar //
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getPangkasConfig(): PangkasConfig {
  // Nilai default
  const defaults: PangkasConfig = {
    similarityThreshold: 0.95,
    compactionThreshold: 0.8,
    maxMemories: 5,
    compressionLevel: 0.6,
  };
  // 1. Cek env
  const env: PangkasConfig = {
    similarityThreshold: process.env.PANGKAS_SIMILARITY ? Number(process.env.PANGKAS_SIMILARITY) : undefined,
    compactionThreshold: process.env.PANGKAS_COMPACTION ? Number(process.env.PANGKAS_COMPACTION) : undefined,
    maxMemories: process.env.PANGKAS_MAX_MEM ? Number(process.env.PANGKAS_MAX_MEM) : undefined,
    compressionLevel: process.env.PANGKAS_COMPRESSION ? Number(process.env.PANGKAS_COMPRESSION) : undefined,
  };
  // 2. Cek file config (pangkas.jsonc di root project)
  const configPath = path.resolve(process.cwd(), "pangkas.jsonc");
  const fileConfig = readJSONC(configPath);
  // 3. Merge (env > file > default)
  const merged: PangkasConfig = {
    ...defaults,
    ...fileConfig,
    ...env,
  };
  // 4. Pastikan field penting tidak undefined
  if (merged.similarityThreshold === undefined) merged.similarityThreshold = defaults.similarityThreshold;
  if (merged.compactionThreshold === undefined) merged.compactionThreshold = defaults.compactionThreshold;
  if (merged.maxMemories === undefined) merged.maxMemories = defaults.maxMemories;
  if (merged.compressionLevel === undefined) merged.compressionLevel = defaults.compressionLevel;
  return merged;
}
