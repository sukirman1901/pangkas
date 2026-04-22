// Redacts common secret patterns before persisting memory to disk

const SECRET_PATTERNS = [
  // OpenAI / Anthropic API keys
  { regex: /sk-[a-zA-Z0-9]{10,}/g, label: 'API_KEY' },
  // Generic bearer tokens
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, label: 'BEARER_TOKEN' },
  // JWT-ish tokens
  { regex: /eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*/g, label: 'JWT_TOKEN' },
  // Password assignments
  { regex: /password\s*[:=]\s*\S+/gi, label: 'PASSWORD' },
  // AWS keys
  { regex: /AKIA[0-9A-Z]{16}/g, label: 'AWS_KEY' },
  // Private keys (beginning marker)
  { regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g, label: 'PRIVATE_KEY' },
];

export function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text;
  for (const { regex, label } of SECRET_PATTERNS) {
    cleaned = cleaned.replace(regex, `[REDACTED_${label}]`);
  }
  return cleaned;
}

export function sanitizeObject(obj) {
  if (typeof obj === 'string') return sanitizeText(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeObject(v);
    }
    return out;
  }
  return obj;
}
