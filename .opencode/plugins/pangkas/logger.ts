// Modul Logger: logging statistik token & cost
/**
 * Logger statistik token, cost, dan aktivitas plugin.
 * Placeholder: bisa diarahkan ke SQLite/log file.
 * @param stats object - statistik yang dicatat
 */
export function logStats(stats: Record<string, any>): void {
  // TODO: Integrasi SQLite/log file jika diperlukan
  // Contoh: simpan ke DB atau file
  console.log("[Pangkas][Stats]", JSON.stringify(stats));
}
