// Modul Router: smart routing ke LLM
/**
 * Pilih model LLM berdasarkan analisis task/prompt.
 * Sederhana: jika ada kata "ringan" -> ollama, "cepat" -> gemini, selain itu -> claude.
 * @param task string - prompt/task user
 * @returns string - nama model
 */
export function routeModel(task: string): string {
  const t = task.toLowerCase();
  if (t.includes("ringan")) return "ollama";
  if (t.includes("cepat")) return "gemini";
  // Bisa tambah logika lain sesuai kebutuhan
  return "claude";
}
