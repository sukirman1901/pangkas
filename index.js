// Pangkas Plugin v3 - Hemat Token AI untuk OpenCode
// Prinsip: Ringkas tapi bermakna (seperti Superpowers)
// Tidak menghapus context secara brutal, tapi summarize dan compress smart

import { logStats } from "./logger.js";
import { getPangkasConfig } from "./config.js";
import { createPipeline, reconstructText } from "./pipeline/index.js";

// Legacy imports (for backward compatibility when usePipeline: false)
import { pruneContext as legacyPrune } from "./legacy/pruner.js";
import { compressPrompt as legacyCompress } from "./legacy/compressor.js";
import { manageHistory as legacyManageHistory } from "./legacy/history-manager.js";

// Estimasi token sederhana (1 token ~ 4 karakter rata-rata)
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Helper untuk compress array of strings (system prompts) - legacy mode
function compressStrings(arr, config) {
  if (!arr || !Array.isArray(arr)) return arr;
  return arr.map(str => {
    if (typeof str !== 'string') return str;
    const pruned = legacyPrune(str);
    return legacyCompress(pruned, { level: config.compressionLevel });
  });
}

// Helper untuk compress parts dalam sebuah message (legacy mode)
function compressPartsLegacy(parts, config) {
  if (!parts || !Array.isArray(parts)) return parts;
  
  return parts.map(part => {
    if (!part) return part;
    
    if (typeof part.text === 'string') {
      const pruned = legacyPrune(part.text);
      const compressed = legacyCompress(pruned, { level: config.compressionLevel });
      return { ...part, text: compressed };
    }
    
    if (typeof part === 'string') {
      const pruned = legacyPrune(part);
      return legacyCompress(pruned, { level: config.compressionLevel });
    }
    
    return part;
  });
}

// Helper untuk compress parts menggunakan pipeline baru
function compressPartsPipeline(parts, pipeline) {
  if (!parts || !Array.isArray(parts)) return parts;
  
  return parts.map(part => {
    if (!part) return part;
    
    if (typeof part.text === 'string') {
      const chunks = pipeline.run(part.text);
      const compressed = reconstructText(chunks);
      return { ...part, text: compressed };
    }
    
    if (typeof part === 'string') {
      const chunks = pipeline.run(part);
      return reconstructText(chunks);
    }
    
    return part;
  });
}

// Helper untuk extract text dari parts
function extractText(parts) {
  if (!parts || !Array.isArray(parts)) return '';
  return parts.map(p => {
    if (p && typeof p.text === 'string') return p.text;
    if (typeof p === 'string') return p;
    return '';
  }).join('');
}

// Plugin utama Pangkas v3
export const PangkasPlugin = async (ctx) => {
  const config = getPangkasConfig();
  
  // Create pipeline if v3 mode is enabled
  const pipeline = config.usePipeline ? createPipeline(config) : null;

  return {
    // Hook 1: Transform system prompts
    "experimental.chat.system.transform": async (_input, output) => {
      if (!config.pruneSystemPrompt || !output.system || !Array.isArray(output.system)) {
        return;
      }
      
      const originalText = output.system.join('\n');
      const originalTokens = estimateTokens(originalText);
      
      if (pipeline) {
        // v3: use pipeline
        output.system = output.system.map(str => {
          if (typeof str !== 'string') return str;
          const chunks = pipeline.run(str);
          return reconstructText(chunks);
        });
      } else {
        // Legacy mode
        output.system = compressStrings(output.system, config);
      }
      
      const compressedText = output.system.join('\n');
      const compressedTokens = estimateTokens(compressedText);
      const saved = originalTokens - compressedTokens;
      
      if (saved > 0 && config.enableLogging) {
        logStats({ 
          event: "system_prompt_compressed", 
          originalTokens, 
          compressedTokens, 
          savedTokens: saved 
        });
      }
    },

    // Hook 2: Transform chat messages dengan smart history management
    "experimental.chat.messages.transform": async (_input, output) => {
      if (!output.messages || !Array.isArray(output.messages)) {
        return;
      }
      
      let totalOriginalTokens = 0;
      let totalCompressedTokens = 0;
      let messagesProcessed = 0;
      
      // Salin array messages
      let messages = [...output.messages];
      
      // Smart history management (bukan brute truncate)
      const originalCount = messages.length;
      if (config.maxHistoryMessages > 0 && messages.length > config.maxHistoryMessages) {
        if (config.useSummarization) {
          messages = legacyManageHistory(messages, config.maxHistoryMessages);
        } else {
          // Fallback: brute truncate jika summarization dimatikan
          const keepCount = config.maxHistoryMessages;
          messages = messages.slice(-keepCount);
        }
        
        const removed = originalCount - messages.length;
        if (config.enableLogging && removed > 0) {
          logStats({
            event: "history_managed",
            originalCount,
            newCount: messages.length,
            removedMessages: removed,
            summarization: config.useSummarization,
          });
        }
      }
      
      // Compress setiap message
      messages = messages.map(msg => {
        if (!msg) return msg;
        
        // Skip summary messages (sudah ringkas)
        if (msg._pangkas_summary) return msg;
        
        // Hitung original tokens
        const originalContent = extractText(msg.parts);
        totalOriginalTokens += estimateTokens(originalContent);
        
        // Compress parts
        if (msg.parts && Array.isArray(msg.parts)) {
          if (pipeline) {
            msg.parts = compressPartsPipeline(msg.parts, pipeline);
          } else {
            msg.parts = compressPartsLegacy(msg.parts, config);
          }
        }
        
        // Hitung compressed tokens
        const compressedContent = extractText(msg.parts);
        totalCompressedTokens += estimateTokens(compressedContent);
        messagesProcessed++;
        
        return msg;
      });
      
      output.messages = messages;
      
      const saved = totalOriginalTokens - totalCompressedTokens;
      if (saved > 0 && config.enableLogging) {
        logStats({ 
          event: "messages_compressed", 
          messagesProcessed,
          originalTokens: totalOriginalTokens, 
          compressedTokens: totalCompressedTokens, 
          savedTokens: saved 
        });
      }
    },

    // Hook 3: Saat pesan baru diterima, compress sebelum diproses
    "chat.message": async (input, output) => {
      if (!output.parts || !Array.isArray(output.parts)) return;
      
      const originalParts = extractText(output.parts);
      
      if (pipeline) {
        output.parts = compressPartsPipeline(output.parts, pipeline);
      } else {
        output.parts = compressPartsLegacy(output.parts, config);
      }
      
      const compressedParts = extractText(output.parts);
      
      const saved = estimateTokens(originalParts) - estimateTokens(compressedParts);
      if (saved > 0 && config.enableLogging) {
        logStats({
          event: "incoming_message_compressed",
          savedTokens: saved
        });
      }
    }
  };
};
