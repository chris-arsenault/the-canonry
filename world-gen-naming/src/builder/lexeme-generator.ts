/**
 * Lexeme Generator (Phase 5)
 *
 * Generates lexeme lists using LLM based on specifications.
 */

import type {
  LexemeSlotSpec,
  LexemeGenerationResult,
  PosTag,
} from "../types/builder-spec.js";
import type { LLMClient } from "./llm-client.js";
import { applyAllFilters } from "./quality-filter.js";

/**
 * POS tag descriptions for LLM prompts
 */
const POS_DESCRIPTIONS: Record<PosTag, string> = {
  noun: "common noun (person, place, thing)",
  noun_proper: "proper noun (name of specific person, place)",
  noun_abstract: "abstract noun (concept, idea, quality)",
  verb: "base form verb (infinitive)",
  verb_3sg: "third-person singular present verb (walks, runs, hides)",
  verb_past: "past tense verb (walked, ran, hid)",
  verb_gerund: "-ing form verb (walking, running, hiding)",
  adj: "adjective (describing word)",
  adv: "adverb (modifies verbs/adjectives)",
  prep: "preposition (in, on, under, through)",
  ordinal: "ordinal number (first, second, third)",
  any: "any part of speech",
};

/**
 * Generate lexeme list using LLM
 */
export async function generateLexemeList(
  spec: LexemeSlotSpec,
  llmClient: LLMClient,
  options?: { verbose?: boolean }
): Promise<LexemeGenerationResult> {
  const startTime = Date.now();
  const verbose = options?.verbose ?? false;

  if (verbose) {
    console.log(`\nGenerating lexeme list: ${spec.id}`);
    console.log(`  Culture: ${spec.cultureId}`);
    console.log(`  POS: ${spec.pos}`);
    console.log(`  Target count: ${spec.targetCount}`);
  }

  // Build the prompt
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(spec);

  if (verbose) {
    console.log(`  Calling LLM...`);
  }

  // Call LLM
  const { data, tokensUsed, attempts } = await llmClient.generateWithRetries(
    systemPrompt,
    userPrompt,
    validateLexemeResponse,
    3 // Max 3 retries
  );

  if (verbose) {
    console.log(`  Received ${data.entries.length} entries (${attempts} attempts, ${tokensUsed} tokens)`);
  }

  // Apply quality filters
  const filterResult = await applyAllFilters(
    data.entries,
    spec.qualityFilter,
    spec.style,
    spec.cultureId,
    spec.qualityFilter?.llmCritic ? llmClient : undefined
  );

  if (verbose) {
    console.log(`  After filtering: ${filterResult.passed.length} kept, ${filterResult.rejected.length} rejected`);
    if (filterResult.rejected.length > 0 && filterResult.rejected.length <= 5) {
      console.log(`  Rejected:`, filterResult.rejected);
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    spec,
    entries: filterResult.passed,
    filtered: filterResult.rejected.length,
    source: "llm",
    metadata: {
      promptUsed: userPrompt,
      tokensUsed,
      durationMs,
    },
  };
}

/**
 * Build system prompt for lexeme generation
 */
function buildSystemPrompt(): string {
  return `You are a lexeme generator for a fantasy world name generation system.

Your job is to generate thematically appropriate word lists for different cultures and contexts.

Guidelines:
- Generate words that match the specified style and culture
- Ensure all words match the specified part of speech
- Avoid modern/Earth-specific terms that break immersion
- Avoid proper nouns unless specifically requested
- Aim for variety (don't repeat similar words)
- Keep words appropriate for a game/fantasy setting

Return your response as a JSON object with this structure:
{
  "entries": ["word1", "word2", "word3", ...],
  "notes": "optional notes about your choices"
}`;
}

/**
 * Build user prompt for a specific lexeme spec
 */
function buildUserPrompt(spec: LexemeSlotSpec): string {
  const posDescription = POS_DESCRIPTIONS[spec.pos] || spec.pos;

  let prompt = `Generate a lexeme list with the following specifications:

**Culture**: ${spec.cultureId}
**Style**: ${spec.style}
**Part of Speech**: ${spec.pos} (${posDescription})
**Target Count**: ${spec.targetCount} words`;

  if (spec.description) {
    prompt += `\n**Description**: ${spec.description}`;
  }

  if (spec.examples && spec.examples.length > 0) {
    prompt += `\n\n**Example words** (for style reference):\n${spec.examples.map((e) => `- ${e}`).join("\n")}`;
  }

  // Add quality filter hints
  if (spec.qualityFilter) {
    const constraints: string[] = [];

    if (spec.qualityFilter.minLength) {
      constraints.push(`minimum ${spec.qualityFilter.minLength} characters`);
    }
    if (spec.qualityFilter.maxLength) {
      constraints.push(`maximum ${spec.qualityFilter.maxLength} characters`);
    }
    if (spec.qualityFilter.requireCapitalized) {
      constraints.push(`must be capitalized`);
    }
    if (spec.qualityFilter.allowedPattern) {
      constraints.push(`must match pattern: ${spec.qualityFilter.allowedPattern}`);
    }

    if (constraints.length > 0) {
      prompt += `\n\n**Constraints**: ${constraints.join(", ")}`;
    }

    if (spec.qualityFilter.bannedWords && spec.qualityFilter.bannedWords.length > 0) {
      prompt += `\n\n**Banned words**: ${spec.qualityFilter.bannedWords.join(", ")}`;
    }
  }

  prompt += `\n\nGenerate ${spec.targetCount} words that match these specifications. Return as JSON.`;

  return prompt;
}

/**
 * Validate LLM response for lexeme generation
 */
function validateLexemeResponse(data: unknown): { entries: string[]; notes?: string } {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response must be an object");
  }

  if (!("entries" in data) || !Array.isArray((data as any).entries)) {
    throw new Error("Response must have 'entries' array");
  }

  const entries = (data as any).entries;

  // Validate all entries are strings
  for (const entry of entries) {
    if (typeof entry !== "string") {
      throw new Error(`Invalid entry type: ${typeof entry}`);
    }
  }

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const entry of entries) {
    const normalized = entry.toLowerCase().trim();
    if (!seen.has(normalized) && entry.trim().length > 0) {
      seen.add(normalized);
      unique.push(entry.trim());
    }
  }

  return {
    entries: unique,
    notes: (data as any).notes,
  };
}

/**
 * Generate multiple lexeme lists in batch
 */
export async function generateLexemeLists(
  specs: LexemeSlotSpec[],
  llmClient: LLMClient,
  options?: { verbose?: boolean; continueOnError?: boolean }
): Promise<{
  results: LexemeGenerationResult[];
  errors: Array<{ spec: LexemeSlotSpec; error: Error }>;
}> {
  const results: LexemeGenerationResult[] = [];
  const errors: Array<{ spec: LexemeSlotSpec; error: Error }> = [];
  const verbose = options?.verbose ?? false;
  const continueOnError = options?.continueOnError ?? true;

  if (verbose) {
    console.log(`\n=== Generating ${specs.length} lexeme lists ===`);
  }

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];

    if (verbose) {
      console.log(`\n[${i + 1}/${specs.length}] ${spec.id}`);
    }

    try {
      const result = await generateLexemeList(spec, llmClient, options);
      results.push(result);
    } catch (error) {
      errors.push({ spec, error: error as Error });

      if (verbose) {
        console.error(`  ❌ Failed: ${(error as Error).message}`);
      }

      if (!continueOnError) {
        throw error;
      }
    }

    // Small delay between requests to avoid rate limiting
    if (i < specs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (verbose) {
    console.log(`\n=== Summary ===`);
    console.log(`  Successful: ${results.length}`);
    console.log(`  Failed: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`  Errors:`);
      errors.forEach(({ spec, error }) => {
        console.log(`    - ${spec.id}: ${error.message}`);
      });
    }
  }

  return { results, errors };
}
