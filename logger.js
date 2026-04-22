// Modul Logger: logging statistik token & cost
import fs from "fs";
import path from "path";
import os from "os";

const LOG_FILE = path.join(os.homedir(), ".config/opencode/pangkas.log");

// Pastikan direktori ada
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Logger statistik token, cost, dan aktivitas plugin.
 * Menyimpan ke console dan file log.
 * @param {object} stats - statistik yang dicatat
 */
export function logStats(stats) {
  const line = `[${new Date().toISOString()}] ${JSON.stringify(stats)}`;
  
  // 1. Tampilkan di console (muncul di terminal)
  console.log("[Pangkas]", line);
  
  // 2. Simpan ke file (append)
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (err) {
    // Abaikan error write file
  }
}
