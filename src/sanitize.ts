const SENSITIVE_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "bearer",
  "client_secret",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "private_key",
]);

const SECRET_PATTERNS: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/g, "Bearer [REDACTED]"],
  [/\bsk-[A-Za-z0-9._-]{16,}\b/g, "[REDACTED_OPENAI_KEY]"],
  [
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s,;]{8,}/gi,
    (match) => `${match.split(/[:=]/)[0]}=[REDACTED]`,
  ],
];

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return redactText(String(value));
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? "[REDACTED]" : sanitizeAuditValue(item, depth + 1);
    }
    return result;
  }
  return redactText(String(value));
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]/g, "_");
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("_token") || normalized.endsWith("_secret");
}

function redactText(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out =
      typeof replacement === "function"
        ? out.replace(pattern, (match) => replacement(match))
        : out.replace(pattern, replacement);
  }
  return out;
}
