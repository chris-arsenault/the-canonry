export function stripLeadingWrapper(text: string): string {
  if (!text) return text;
  return text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*JSON\s*:\s*/i, '')
    .replace(/^\s*Here\s+is\s+the\s+JSON\s*:\s*/i, '')
    .replace(/^\s*Here\s+is\s+the\s+response\s*:\s*/i, '')
    .trim();
}

export function extractFirstJsonObject(text: string): string | null {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonValue<T>(text: string, label?: string): T {
  const cleaned = stripLeadingWrapper(text);
  const candidate = extractFirstJsonObject(cleaned) || cleaned;
  const labelName = label || 'json';

  try {
    const parsed = JSON.parse(candidate) as T;
    console.log('[Parser] Parsed JSON', {
      label: labelName,
      inputChars: text.length,
      candidateChars: candidate.length,
    });
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const prefix = label ? `Failed to parse ${label}: ` : 'Failed to parse JSON: ';
    console.warn('[Parser] JSON parse failed', {
      label: labelName,
      inputChars: text.length,
      candidateChars: candidate.length,
      error: message,
      snippet: candidate.slice(0, 240),
    });
    throw new Error(`${prefix}${message}`);
  }
}

export function parseJsonObject<T extends Record<string, unknown>>(text: string, label?: string): T {
  const parsed = parseJsonValue<T>(text, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const name = label ? ` for ${label}` : '';
    console.warn('[Parser] JSON parse failed - expected object', {
      label: label || 'json',
      parsedType: Array.isArray(parsed) ? 'array' : typeof parsed,
    });
    throw new Error(`Expected JSON object${name}`);
  }
  return parsed;
}
