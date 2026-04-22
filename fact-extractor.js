import { randomUUID } from 'crypto';

export const FACT_TYPES = {
  DECISION: 'decision',
  TODO: 'todo',
  DONE: 'done',
  FILE: 'file',
  BUG: 'bug',
  PREFERENCE: 'preference',
  QUESTION: 'question',
};

export const PRIORITY_ORDER = [
  FACT_TYPES.BUG,
  FACT_TYPES.TODO,
  FACT_TYPES.DECISION,
  FACT_TYPES.PREFERENCE,
  FACT_TYPES.QUESTION,
  FACT_TYPES.FILE,
  FACT_TYPES.DONE,
];

/**
 * Extract facts from conversation messages
 */
export function extractFacts(messages, existingFacts = []) {
  if (!messages || !Array.isArray(messages)) return [];
  
  const text = extractTextFromMessages(messages);
  const extracted = [];
  
  // Rule-based extraction
  extracted.push(...extractDecisions(text));
  extracted.push(...extractTodos(text));
  extracted.push(...extractFiles(text));
  extracted.push(...extractBugs(text));
  extracted.push(...extractPreferences(text));
  extracted.push(...extractQuestions(text));
  
  // Deduplicate within same batch (high similarity = same fact)
  const unique = [];
  for (const fact of extracted) {
    const isDuplicate = unique.some(existing => 
      existing.type === fact.type && 
      similarity(existing.content, fact.content) > 0.85
    );
    if (!isDuplicate) {
      unique.push(fact);
    }
  }
  
  return unique;
}

function extractTextFromMessages(messages) {
  return messages
    .filter(m => m.parts && Array.isArray(m.parts))
    .map(m => m.parts.map(p => typeof p === 'string' ? p : p.text || '').join(' '))
    .join('\n');
}

function extractDecisions(text) {
  const facts = [];
  const patterns = [
    /(?:kita\s+)?(?:putuskan|memutuskan|decide|pilih|gunakan|pakai|menggunakan)\s+(.{10,150})/gi,
    /(?:akan\s+)?(?:menggunakan|memakai|pakai)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.DECISION, match[1].trim()));
    }
  }
  return facts;
}

function extractTodos(text) {
  const facts = [];
  const patterns = [
    /(?:nanti|next|berikutnya|perlu|harus|should|need to)\s+(.{10,150})/gi,
    /(?:todo|task|fitur)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.TODO, match[1].trim()));
    }
  }
  return facts;
}

function extractFiles(text) {
  const facts = [];
  const filePattern = /[\w-]+\.(js|ts|jsx|tsx|py|go|rs|java|rb|php|css|html|json|md|yml|yaml)/gi;
  let match;
  
  while ((match = filePattern.exec(text)) !== null) {
    facts.push(createFact(FACT_TYPES.FILE, match[0]));
  }
  return facts;
}

function extractBugs(text) {
  const facts = [];
  const patterns = [
    /(?:bug|error|crash|fail|broken|issue)\s+(.{10,150})/gi,
    /(?:tidak\s+)?(?:berhasil|work|jalan|fungsi)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.BUG, match[1].trim()));
    }
  }
  return facts;
}

function extractPreferences(text) {
  const facts = [];
  const patterns = [
    /(?:saya\s+)?(?:prefer|suka|lebih\s+suka|preferensi)\s+(.{10,150})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      facts.push(createFact(FACT_TYPES.PREFERENCE, match[1].trim()));
    }
  }
  return facts;
}

function extractQuestions(text) {
  const facts = [];
  const pattern = /(?:\?|apakah|bagaimana|mengapa|kenapa|what|how|why)\s+(.{10,150}\?)/gi;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    facts.push(createFact(FACT_TYPES.QUESTION, match[1].trim()));
  }
  return facts;
}

function createFact(type, content) {
  return {
    id: randomUUID(),
    type,
    content: content.slice(0, 150),
    confidence: 0.7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionCount: 1,
    isLatest: true,
  };
}

/**
 * Merge extracted facts with existing, handling duplicates
 */
export function mergeFacts(existing, extracted) {
  const merged = [...existing];
  
  for (const newFact of extracted) {
    // Check for exact duplicate (same type + similar content)
    const duplicate = findDuplicate(newFact, merged);
    if (duplicate) {
      updateExisting(duplicate, newFact);
      continue;
    }
    
    // Check for state transition (todo → done)
    if (newFact.type === FACT_TYPES.DONE) {
      const todoVersion = findTodoVersion(newFact, merged);
      if (todoVersion) {
        todoVersion.isLatest = false;
        todoVersion.updatedAt = new Date().toISOString();
      }
    }
    
    merged.push(newFact);
  }
  
  return merged;
}

function findDuplicate(fact, existing) {
  return existing.find(e => 
    e.type === fact.type && 
    e.isLatest &&
    similarity(e.content, fact.content) > 0.8
  );
}

function findTodoVersion(doneFact, existing) {
  return existing.find(e => 
    e.type === FACT_TYPES.TODO && 
    e.isLatest &&
    similarity(e.content, doneFact.content) > 0.8
  );
}

function similarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return intersection.length / Math.max(wordsA.size, wordsB.size);
}

function updateExisting(existing, newFact) {
  existing.sessionCount += 1;
  existing.updatedAt = new Date().toISOString();
  existing.confidence = Math.max(existing.confidence, newFact.confidence);
}

/**
 * Get relevant facts for injection, sorted by priority
 */
export function getRelevantFacts(allFacts, options = {}) {
  const {
    limit = 7,
    types = null,
    excludeDone = true,
  } = options;
  
  let filtered = allFacts.filter(f => f.isLatest);
  
  if (excludeDone) {
    filtered = filtered.filter(f => f.type !== FACT_TYPES.DONE);
  }
  
  if (types) {
    filtered = filtered.filter(f => types.includes(f.type));
  }
  
  // Sort by priority order
  filtered.sort((a, b) => {
    const priorityA = PRIORITY_ORDER.indexOf(a.type);
    const priorityB = PRIORITY_ORDER.indexOf(b.type);
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // Then by confidence
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    
    // Then by recency
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  return filtered.slice(0, limit);
}

/**
 * Format facts for injection into system prompt
 */
export function formatFactsForPrompt(facts) {
  if (!facts || facts.length === 0) return '';
  
  const lines = facts.map(f => {
    const prefix = `[${f.type.toUpperCase()}]`;
    return `${prefix} ${f.content}`;
  });
  
  return '[Session Context]\n' + lines.join('\n');
}
