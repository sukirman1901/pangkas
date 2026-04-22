// Modul Pruner: pruning context/kode
/**
 * Prune context/kode: hapus komentar, baris kosong, dan whitespace berlebih.
 * Sederhana untuk Python/JavaScript.
 * @param input string - kode atau context
 * @returns string - hasil pruning
 */
export function pruneContext(input: string): string {
  // Hapus komentar baris (// ... atau # ...)
  let pruned = input
    .split('\n')
    .map(line => line.replace(/(\/\/.*|#.*)$/g, '').trim())
    .filter(line => line.length > 0)
    .join('\n');
  return pruned;
}
