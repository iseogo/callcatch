/**
 * Strip markdown code fences before JSON.parse (Retell/LLM responses).
 */
export function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function safeJsonParse<T>(raw: string): T {
  const cleaned = stripMarkdownFences(raw);
  return JSON.parse(cleaned) as T;
}

export function safeJsonParseOptional<T>(raw: string | null | undefined): T | null {
  if (!raw) {
    return null;
  }
  try {
    return safeJsonParse<T>(raw);
  } catch {
    return null;
  }
}
