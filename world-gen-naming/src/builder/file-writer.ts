/**
 * File Writer (Phase 5)
 *
 * Write generated lexemes and templates to JSON files.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type {
  LexemeGenerationResult,
  TemplateGenerationResult,
} from "../types/builder-spec.js";
import type { LexemeList, NamingProfile } from "../types/profile.js";

/**
 * Write options
 */
export interface WriteOptions {
  metaDomain?: string; // Meta-domain (test, penguin, etc.)
  outputDir?: string; // Base output directory (overrides metaDomain if set)
  overwrite?: boolean; // Overwrite existing files
  prettyPrint?: boolean; // Format JSON with indentation
  verbose?: boolean; // Log file writes
}

/**
 * Write lexeme generation result to JSON file
 */
export function writeLexemeResult(
  result: LexemeGenerationResult,
  options?: WriteOptions
): string {
  const metaDomain = options?.metaDomain || 'test';
  const opts = {
    outputDir: options?.outputDir || `./data/${metaDomain}/lexemes`,
    overwrite: true,
    prettyPrint: true,
    verbose: false,
    ...options,
  };

  // Create LexemeList structure
  const lexemeList: { lexemeLists: LexemeList[] } = {
    lexemeLists: [
      {
        id: result.spec.id,
        description: result.spec.description,
        entries: result.entries,
      },
    ],
  };

  // Determine filename
  const filename = `${result.spec.cultureId}-${result.spec.pos}.json`;
  const filepath = `${opts.outputDir}/${filename}`;

  // Ensure directory exists
  ensureDirectoryExists(filepath);

  // Check if file exists
  if (!opts.overwrite && existsSync(filepath)) {
    throw new Error(`File already exists: ${filepath} (use --overwrite to replace)`);
  }

  // Write file
  const content = opts.prettyPrint
    ? JSON.stringify(lexemeList, null, 2)
    : JSON.stringify(lexemeList);

  writeFileSync(filepath, content + "\n", "utf-8");

  if (opts.verbose) {
    console.log(`  Written to: ${filepath}`);
  }

  return filepath;
}

/**
 * Write template generation result to JSON file
 * This writes a NamingProfile with the generated strategies
 */
export function writeTemplateResult(
  result: TemplateGenerationResult,
  options?: WriteOptions
): string {
  const metaDomain = options?.metaDomain || 'test';
  const opts = {
    outputDir: options?.outputDir || `./data/${metaDomain}/profiles`,
    overwrite: true,
    prettyPrint: true,
    verbose: false,
    ...options,
  };

  // Create NamingProfile structure
  const profile: { profiles: NamingProfile[] } = {
    profiles: [
      {
        id: `${result.spec.cultureId}:${result.spec.type}`,
        cultureId: result.spec.cultureId,
        type: result.spec.type,
        strategies: result.templates.map((t, index) => ({
          id: t.id,
          kind: "templated" as const,
          weight: 1.0 / result.templates.length, // Equal weights
          template: t.template,
          slots: Object.fromEntries(
            Object.entries(t.slots).map(([slotName, slotConfig]) => [
              slotName,
              {
                kind: slotConfig.kind as any,
                // Map to actual config based on kind
                ...(slotConfig.kind === "lexemeList"
                  ? { listId: `${result.spec.cultureId}_${slotName.toLowerCase()}` }
                  : slotConfig.kind === "phonotactic"
                    ? { domainId: result.spec.cultureId }
                    : {}),
              },
            ])
          ),
        })),
      },
    ],
  };

  // Determine filename
  const filename = `${result.spec.cultureId}-${result.spec.type}.json`;
  const filepath = `${opts.outputDir}/${filename}`;

  // Ensure directory exists
  ensureDirectoryExists(filepath);

  // Check if file exists
  if (!opts.overwrite && existsSync(filepath)) {
    throw new Error(`File already exists: ${filepath} (use --overwrite to replace)`);
  }

  // Write file
  const content = opts.prettyPrint
    ? JSON.stringify(profile, null, 2)
    : JSON.stringify(profile);

  writeFileSync(filepath, content + "\n", "utf-8");

  if (opts.verbose) {
    console.log(`  Written to: ${filepath}`);
  }

  return filepath;
}

/**
 * Write multiple lexeme results to a single file
 */
export function writeLexemeResults(
  results: LexemeGenerationResult[],
  outputPath: string,
  options?: WriteOptions
): string {
  const opts = {
    overwrite: true,
    prettyPrint: true,
    verbose: false,
    ...options,
  };

  // Combine into single structure
  const combined: { lexemeLists: LexemeList[] } = {
    lexemeLists: results.map((r) => ({
      id: r.spec.id,
      description: r.spec.description,
      entries: r.entries,
    })),
  };

  // Ensure directory exists
  ensureDirectoryExists(outputPath);

  // Check if file exists
  if (!opts.overwrite && existsSync(outputPath)) {
    throw new Error(`File already exists: ${outputPath} (use --overwrite to replace)`);
  }

  // Write file
  const content = opts.prettyPrint
    ? JSON.stringify(combined, null, 2)
    : JSON.stringify(combined);

  writeFileSync(outputPath, content + "\n", "utf-8");

  if (opts.verbose) {
    console.log(`  Written ${results.length} lexeme lists to: ${outputPath}`);
  }

  return outputPath;
}

/**
 * Ensure directory exists for a file path
 */
function ensureDirectoryExists(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate summary report for generation results
 */
export function generateSummaryReport(
  lexemeResults: LexemeGenerationResult[],
  templateResults: TemplateGenerationResult[]
): string {
  let report = "=== Generation Summary ===\n\n";

  // Lexeme stats
  if (lexemeResults.length > 0) {
    report += "Lexeme Lists:\n";
    let totalEntries = 0;
    let totalFiltered = 0;
    let totalTokens = 0;

    for (const result of lexemeResults) {
      totalEntries += result.entries.length;
      totalFiltered += result.filtered;
      totalTokens += result.metadata?.tokensUsed || 0;

      report += `  - ${result.spec.id}: ${result.entries.length} entries`;
      if (result.filtered > 0) {
        report += ` (${result.filtered} filtered)`;
      }
      report += "\n";
    }

    report += `\nTotal: ${totalEntries} entries, ${totalFiltered} filtered, ${totalTokens} tokens\n\n`;
  }

  // Template stats
  if (templateResults.length > 0) {
    report += "Template Sets:\n";
    let totalTemplates = 0;
    let totalFiltered = 0;
    let totalTokens = 0;

    for (const result of templateResults) {
      totalTemplates += result.templates.length;
      totalFiltered += result.filtered;
      totalTokens += result.metadata?.tokensUsed || 0;

      report += `  - ${result.spec.id}: ${result.templates.length} templates`;
      if (result.filtered > 0) {
        report += ` (${result.filtered} invalid)`;
      }
      report += "\n";
    }

    report += `\nTotal: ${totalTemplates} templates, ${totalFiltered} invalid, ${totalTokens} tokens\n`;
  }

  return report;
}
