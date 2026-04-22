// Modul Router: smart routing ke LLM
/**
 * Pilih model LLM berdasarkan analisis task/prompt.
 * Sederhana: jika ada kata "ringan" -> ollama, "cepat" -> gemini, selain itu -> claude.
 * @param {string} task - prompt/task user
 * @returns {string} - nama model
 */
export function routeModel(task) {
  const t = task.toLowerCase();
  if (t.includes("ringan")) return "ollama";
  if (t.includes("cepat")) return "gemini";
  return "claude";
}
