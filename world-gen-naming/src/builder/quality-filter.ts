/**
 * Quality Filter (Phase 5)
 *
 * Automatic filtering for generated lexemes and templates.
 */

import type { QualityFilter } from "../types/builder-spec.js";
import type { LLMClient } from "./llm-client.js";

/**
 * Filter result
 */
export interface FilterResult {
  passed: string[]; // Entries that passed all filters
  rejected: string[]; // Entries that were rejected
  reasons: Record<string, string>; // Entry → rejection reason
}

/**
 * Apply quality filters to a list of entries
 */
export function applyQualityFilter(
  entries: string[],
  filter?: QualityFilter
): FilterResult {
  if (!filter) {
    return {
      passed: entries,
      rejected: [],
      reasons: {},
    };
  }

  const passed: string[] = [];
  const rejected: string[] = [];
  const reasons: Record<string, string> = {};

  for (const entry of entries) {
    const reason = checkEntry(entry, filter);

    if (reason) {
      rejected.push(entry);
      reasons[entry] = reason;
    } else {
      passed.push(entry);
    }
  }

  return { passed, rejected, reasons };
}

/**
 * Check if an entry passes all filters
 * Returns rejection reason if failed, null if passed
 */
function checkEntry(entry: string, filter: QualityFilter): string | null {
  // Length checks
  if (filter.minLength && entry.length < filter.minLength) {
    return `Too short (${entry.length} < ${filter.minLength})`;
  }

  if (filter.maxLength && entry.length > filter.maxLength) {
    return `Too long (${entry.length} > ${filter.maxLength})`;
  }

  // Forbidden substrings
  if (filter.forbiddenSubstrings) {
    for (const forbidden of filter.forbiddenSubstrings) {
      if (entry.toLowerCase().includes(forbidden.toLowerCase())) {
        return `Contains forbidden substring: "${forbidden}"`;
      }
    }
  }

  // Banned words (exact match, case-insensitive)
  if (filter.bannedWords) {
    const lowerEntry = entry.toLowerCase();
    for (const banned of filter.bannedWords) {
      if (lowerEntry === banned.toLowerCase()) {
        return `Banned word: "${banned}"`;
      }
    }
  }

  // Allowed pattern
  if (filter.allowedPattern) {
    const regex = new RegExp(filter.allowedPattern);
    if (!regex.test(entry)) {
      return `Does not match allowed pattern: ${filter.allowedPattern}`;
    }
  }

  // Capitalization check
  if (filter.requireCapitalized) {
    if (entry[0] !== entry[0].toUpperCase()) {
      return "Not capitalized";
    }
  }

  return null; // Passed all filters
}

/**
 * Use LLM as a critic to filter out-of-place entries
 */
export async function applyLLMCritic(
  entries: string[],
  style: string,
  cultureId: string,
  llmClient: LLMClient
): Promise<FilterResult> {
  const systemPrompt = `You are a quality filter for a name generation system.
Your job is to identify words that feel out of place for the given style/culture.

Be strict about:
- Modern or Earth-specific terms that break immersion
- Words that clash with the cultural style
- Overly silly or meme-like words

Be lenient about:
- Slight stylistic variations
- Words that might work in context`;

  const userPrompt = `Culture: ${cultureId}
Style: ${style}

Here are ${entries.length} generated words. Return a JSON object with:
{
  "keep": ["word1", "word2", ...],
  "remove": ["word3", "word4", ...],
  "reasons": {
    "word3": "reason for removal",
    "word4": "reason for removal"
  }
}

Words:
${entries.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;

  const validator = (data: unknown) => {
    if (
      typeof data !== "object" ||
      data === null ||
      !("keep" in data) ||
      !("remove" in data)
    ) {
      throw new Error("Invalid response format");
    }

    const result = data as {
      keep: string[];
      remove: string[];
      reasons?: Record<string, string>;
    };

    // Validate that all entries are accounted for
    const allWords = new Set([...result.keep, ...result.remove]);
    for (const entry of entries) {
      if (!allWords.has(entry)) {
        console.warn(`LLM critic did not account for: "${entry}" - keeping it`);
        result.keep.push(entry);
      }
    }

    return result;
  };

  try {
    const { data } = await llmClient.generateWithRetries(
      systemPrompt,
      userPrompt,
      validator,
      2 // Max 2 retries for critic
    );

    return {
      passed: data.keep,
      rejected: data.remove,
      reasons: data.reasons || {},
    };
  } catch (error) {
    console.warn("LLM critic failed, keeping all entries:", error);
    // On failure, keep everything
    return {
      passed: entries,
      rejected: [],
      reasons: {},
    };
  }
}

/**
 * Apply all filters (automatic + optional LLM critic)
 */
export async function applyAllFilters(
  entries: string[],
  filter: QualityFilter | undefined,
  style: string,
  cultureId: string,
  llmClient?: LLMClient
): Promise<FilterResult> {
  // First, apply automatic filters
  const automaticResult = applyQualityFilter(entries, filter);

  // If LLM critic is enabled and client is provided, apply it
  if (filter?.llmCritic && llmClient && automaticResult.passed.length > 0) {
    const criticResult = await applyLLMCritic(
      automaticResult.passed,
      style,
      cultureId,
      llmClient
    );

    return {
      passed: criticResult.passed,
      rejected: [...automaticResult.rejected, ...criticResult.rejected],
      reasons: { ...automaticResult.reasons, ...criticResult.reasons },
    };
  }

  return automaticResult;
}

/**
 * Default quality filters for common use cases
 */
export const defaultFilters = {
  /**
   * Standard filter for single-word lexemes
   */
  singleWord: {
    minLength: 2,
    maxLength: 20,
    forbiddenSubstrings: ["http", "www", "@"],
    allowedPattern: "^[a-zA-Z'-]+$", // Only letters, hyphens, apostrophes
  } as QualityFilter,

  /**
   * Filter for phrase names (allows spaces and dashes)
   */
  phrase: {
    minLength: 3,
    maxLength: 40,
    allowedPattern: "^[a-zA-Z '-]+$",
  } as QualityFilter,

  /**
   * Filter for proper nouns (requires capitalization)
   */
  properNoun: {
    minLength: 2,
    maxLength: 25,
    requireCapitalized: true,
    allowedPattern: "^[A-Z][a-zA-Z'-]*$",
  } as QualityFilter,
};
