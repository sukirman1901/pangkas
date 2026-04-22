const IMPORTANT_COMMENT_PATTERNS = [
  /TODO|FIXME|HACK|XXX|BUG|WARN|WARNING|IMPORTANT|NOTE|CRITICAL|DEPRECATED/i,
  /@param|@returns|@throws|@example|@see/i,
  /eslint-disable|noqa|pragma|prettier-ignore/i,
  /copyright|license|author|version/i,
  /^\s*[*#]\s+(?:step|phase|section|part)\s*\d+/i,
];

const NOISE_PATTERNS = [
  /\/{2,}\s*$/,
  /\/{2,}\s*[-=]{3,}/,
  /\/{2,}\s*(?:hi|hello|bye)/i,
  /^\s*\/\*\*?\s*\*\/\s*$/,
];

const INSTRUCTION_PATTERNS = [
  /\b(must|always|never|don't|do not|should|important|critical|remember to)\b.{0,100}(?:use|add|remove|change|keep|avoid)/i,
  /\b(context|standard|pattern|rule|guideline)\b.{0,50}(?:is|are|follow|use)/i,
  /\b(decided|agreed|approved|confirmed)\b.{0,100}(?:use|go with|choose|pick)/i,
];

function isImportantComment(text) {
  return IMPORTANT_COMMENT_PATTERNS.some(p => p.test(text));
}

function isNoiseComment(text) {
  return NOISE_PATTERNS.some(p => p.test(text));
}

export function scoreChunks(chunks) {
  if (!Array.isArray(chunks)) return [];

  return chunks.map(chunk => {
    let score = 0.5;

    switch (chunk.type) {
      case 'instruction':
        score = 1.0;
        break;
      case 'comment':
        if (isImportantComment(chunk.content)) {
          score = 0.85;
        } else if (isNoiseComment(chunk.content)) {
          score = 0.15;
        } else {
          score = 0.4;
        }
        break;
      case 'string_literal':
        score = 0.7;
        break;
      case 'code':
        score = 0.6;
        if (INSTRUCTION_PATTERNS.some(p => p.test(chunk.content))) {
          score = 0.9;
        }
        break;
      case 'separator':
        score = 0.05;
        break;
      default:
        score = 0.5;
    }

    return {
      ...chunk,
      score,
      isImportant: score >= 0.8
    };
  });
}
