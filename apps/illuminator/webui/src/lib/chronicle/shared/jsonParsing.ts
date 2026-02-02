/**
 * JSON parsing helpers for LLM responses.
 * Keeps parsing logic shared between pipelines.
 */

function extractJsonBlock(response: string): string {
  let jsonStr = response.trim();

  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonStr = fenced[1].trim();
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?[\s\n]*/, '').replace(/```\s*$/, '').trim();
  }

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  return jsonStr;
}

function applyJsonFixes(raw: string): string {
  let fixed = raw;

  // Remove // comments
  fixed = fixed.replace(/\/\/[^\n]*/g, '');
  // Remove trailing commas
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  return fixed;
}

function applyAggressiveFixes(raw: string): string {
  let fixed = raw;

  // Double commas
  fixed = fixed.replace(/,\s*,/g, ',');
  // Missing commas between objects/arrays
  fixed = fixed.replace(/}(\s*){/g, '},$1{');
  fixed = fixed.replace(/](\s*)\[/g, '],$1[');
  // Missing commas after values
  fixed = fixed.replace(/"(\s*\n\s*)"/g, '",$1"');
  fixed = fixed.replace(/"(\s*\n\s*){/g, '",$1{');
  fixed = fixed.replace(/}(\s*\n\s*)"/g, '},$1"');
  fixed = fixed.replace(/](\s*\n\s*)"/g, '],$1"');
  fixed = fixed.replace(/](\s*\n\s*){/g, '],$1{');
  fixed = fixed.replace(/,\s*,/g, ',');
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Balance brackets
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i += 1) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i += 1) {
    fixed += '}';
  }

  return fixed;
}

export function parseJsonResponse<T>(response: string): T {
  const extracted = extractJsonBlock(response);
  let fixed = applyJsonFixes(extracted);

  try {
    return JSON.parse(fixed) as T;
  } catch (firstError) {
    fixed = applyAggressiveFixes(fixed);

    try {
      return JSON.parse(fixed) as T;
    } catch (secondError) {
      const message = (secondError as Error).message;
      const posMatch = message.match(/position (\d+)/);
      if (posMatch) {
        const errorPos = parseInt(posMatch[1], 10);
        const before = fixed.substring(0, errorPos);
        const after = fixed.substring(errorPos);
        const lastChar = before.trim().slice(-1);
        const firstChar = after.trim()[0];

        if ((lastChar === '"' || lastChar === '}' || lastChar === ']') &&
            (firstChar === '"' || firstChar === '{' || firstChar === '[')) {
          const patched = before + ',' + after;
          return JSON.parse(patched) as T;
        }
      }

      throw firstError;
    }
  }
}
