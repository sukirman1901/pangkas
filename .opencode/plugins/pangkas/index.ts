// Pangkas Plugin Entry Point
// Integrasi semua modul utama di sini

import { pruneContext } from "./pruner";
import { compressPrompt } from "./compressor";
import { checkSemanticCache } from "./semantic-cache";
import { routeModel } from "./router";
import { logStats } from "./logger";
import { getPangkasConfig } from "./config";

// Plugin utama Pangkas
export default async function PangkasPlugin(ctx) {
  // Hook: sebelum tool dieksekusi, optimasi context
  return {
    "tool.execute.before": async (input, output) => {
      const config = getPangkasConfig();
      // 1. Pruning context/kode
      let pruned = pruneContext(input.prompt || input.content || "");
      // 2. Kompresi prompt
      let compressed = await compressPrompt(pruned, { level: config.compressionLevel });
      // 3. Cek semantic cache
      const cached = await checkSemanticCache(compressed, config.similarityThreshold || 0.95);
      if (cached) {
        output.result = cached;
        logStats({ event: "cache_hit", tokens: compressed.length, ...input });
        return;
      }
      // 4. Routing model (opsional, bisa diintegrasi lebih lanjut)
      const model = routeModel(compressed);
      output.model = model;
      // 5. Logging statistik
      logStats({ event: "execute", tokens: compressed.length, model, ...input });
      // 6. Update prompt untuk eksekusi berikutnya
      output.prompt = compressed;
    },
  };
}
