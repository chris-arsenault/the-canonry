#!/usr/bin/env node
/**
 * CLI for automated content generation (Phase 5)
 *
 * Usage:
 *   npm run generate -- lexeme <spec-file>
 *   npm run generate -- template <spec-file>
 *   npm run generate -- batch <spec-file>
 */

import { Command } from "commander";
import { createLLMClient } from "./builder/llm-client.js";
import { generateLexemeList, generateLexemeLists } from "./builder/lexeme-generator.js";
import { generateTemplates, generateMultipleTemplates } from "./builder/template-generator.js";
import {
  loadLexemeSlotSpec,
  loadTemplateSpec,
  loadBatchSpec,
} from "./builder/spec-loader.js";
import {
  writeLexemeResult,
  writeTemplateResult,
  writeLexemeResults,
  generateSummaryReport,
} from "./builder/file-writer.js";
import type { LLMConfig } from "./types/builder-spec.js";

const program = new Command();

program
  .name("namegen-generate")
  .description("Automated content generation for world-gen-naming")
  .version("0.1.0");

/**
 * Generate lexeme list from spec
 */
program
  .command("lexeme")
  .description("Generate a lexeme list from a spec file")
  .argument("<spec-file>", "Path to lexeme slot spec JSON file")
  .option("-o, --output <dir>", "Output directory", "./lexemes")
  .option("--no-overwrite", "Don't overwrite existing files")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env)")
  .option("--model <name>", "Model to use", "claude-haiku-4-5-20251001")
  .option("--temperature <temp>", "Temperature (0-1)", "1.0")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (specFile, options) => {
    try {
      console.log(`Loading spec from: ${specFile}`);
      const spec = loadLexemeSlotSpec(specFile);

      const llmConfig: LLMConfig = {
        provider: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
        temperature: parseFloat(options.temperature),
      };

      const client = createLLMClient(llmConfig);

      const result = await generateLexemeList(spec, client, {
        verbose: options.verbose,
      });

      const filepath = writeLexemeResult(result, {
        outputDir: options.output,
        overwrite: options.overwrite,
        verbose: options.verbose,
      });

      console.log(`\n✅ Generated ${result.entries.length} entries`);
      console.log(`   Written to: ${filepath}`);

      if (result.filtered > 0) {
        console.log(`   Filtered: ${result.filtered} entries`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

/**
 * Generate templates from spec
 */
program
  .command("template")
  .description("Generate templates from a spec file")
  .argument("<spec-file>", "Path to template spec JSON file")
  .option("-o, --output <dir>", "Output directory", "./profiles")
  .option("--no-overwrite", "Don't overwrite existing files")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env)")
  .option("--model <name>", "Model to use", "claude-haiku-4-5-20251001")
  .option("--temperature <temp>", "Temperature (0-1)", "1.0")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (specFile, options) => {
    try {
      console.log(`Loading spec from: ${specFile}`);
      const spec = loadTemplateSpec(specFile);

      const llmConfig: LLMConfig = {
        provider: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
        temperature: parseFloat(options.temperature),
      };

      const client = createLLMClient(llmConfig);

      const result = await generateTemplates(spec, client, {
        verbose: options.verbose,
      });

      const filepath = writeTemplateResult(result, {
        outputDir: options.output,
        overwrite: options.overwrite,
        verbose: options.verbose,
      });

      console.log(`\n✅ Generated ${result.templates.length} templates`);
      console.log(`   Written to: ${filepath}`);

      if (result.filtered > 0) {
        console.log(`   Filtered: ${result.filtered} invalid templates`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

/**
 * Generate batch (multiple lexemes + templates)
 */
program
  .command("batch")
  .description("Generate multiple lexemes and templates from a batch spec")
  .argument("<spec-file>", "Path to batch spec JSON file")
  .option("--lexeme-output <dir>", "Lexeme output directory", "./lexemes")
  .option("--template-output <dir>", "Template output directory", "./profiles")
  .option("--no-overwrite", "Don't overwrite existing files")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env)")
  .option("--model <name>", "Model to use", "claude-haiku-4-5-20251001")
  .option("--temperature <temp>", "Temperature (0-1)", "1.0")
  .option("-v, --verbose", "Verbose output", false)
  .option("--continue-on-error", "Continue even if some generations fail", true)
  .action(async (specFile, options) => {
    try {
      console.log(`Loading batch spec from: ${specFile}`);
      const batch = loadBatchSpec(specFile);

      const llmConfig: LLMConfig = {
        provider: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
        temperature: parseFloat(options.temperature),
      };

      const client = createLLMClient(llmConfig);

      const startTime = Date.now();

      // Generate lexemes
      const lexemeResults = await generateLexemeLists(
        batch.lexemeSpecs,
        client,
        {
          verbose: options.verbose,
          continueOnError: options.continueOnError,
        }
      );

      // Write lexeme results
      for (const result of lexemeResults.results) {
        writeLexemeResult(result, {
          outputDir: options.lexemeOutput,
          overwrite: options.overwrite,
          verbose: options.verbose,
        });
      }

      // Generate templates
      const templateResults = await generateMultipleTemplates(
        batch.templateSpecs,
        client,
        {
          verbose: options.verbose,
          continueOnError: options.continueOnError,
        }
      );

      // Write template results
      for (const result of templateResults.results) {
        writeTemplateResult(result, {
          outputDir: options.templateOutput,
          overwrite: options.overwrite,
          verbose: options.verbose,
        });
      }

      const duration = Date.now() - startTime;

      // Print summary
      console.log("\n" + generateSummaryReport(
        lexemeResults.results,
        templateResults.results
      ));

      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

      // Report errors
      const totalErrors =
        lexemeResults.errors.length + templateResults.errors.length;

      if (totalErrors > 0) {
        console.log(`\n⚠️  ${totalErrors} generation(s) failed`);
        process.exit(1);
      } else {
        console.log(`\n✅ Batch generation complete!`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
