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
 * Menyimpan ke file log saja (tidak ke console/terminal).
 * @param {object} stats - statistik yang dicatat
 */
export function logStats(stats) {
  const line = `[${new Date().toISOString()}] ${JSON.stringify(stats)}`;

  // Simpan ke file log (tidak ditampilkan di console agar terminal bersih)
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (err) {
    // Abaikan error write file
  }
}
