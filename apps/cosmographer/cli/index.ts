#!/usr/bin/env node
/**
 * Cosmographer CLI
 *
 * Command-line interface for generating plane hierarchies.
 *
 * Usage:
 *   cosmographer generate <input.yaml> [-o output.json]
 *   cosmographer analyze <term>
 *   cosmographer categories [--domain <type>]
 *   cosmographer vocabulary
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { resolve, extname } from 'path';

import {
  generateManifold,
  analyzeTerm,
  getCategoriesForDomain,
  getAllCategoryIds,
  getVocabularyStats,
  VERSION
} from '../lib/index.js';

import type { CosmographerInput, CosmographerOutput, DomainClass } from '../lib/types/index.js';

function parseInputFile(inputPath: string): CosmographerInput {
  const fullPath = resolve(inputPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Input file not found: ${fullPath}`);
  }

  const content = readFileSync(fullPath, 'utf-8');
  const ext = extname(fullPath).toLowerCase();

  let raw: Record<string, unknown>;
  if (ext === '.yaml' || ext === '.yml') {
    raw = parseYaml(content) as Record<string, unknown>;
  } else if (ext === '.json') {
    raw = JSON.parse(content) as Record<string, unknown>;
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .yaml, .yml, or .json`);
  }

  const rawOptions = (raw.options ?? {}) as Record<string, unknown>;
  return {
    ...raw,
    distanceHints: (raw.distanceHints as CosmographerInput['distanceHints']) ?? [],
    customCategories: (raw.customCategories as CosmographerInput['customCategories']) ?? [],
    options: {
      weights: rawOptions.weights as CosmographerInput['options']['weights'],
      saturationStrategy: rawOptions.saturationStrategy as CosmographerInput['options']['saturationStrategy'],
      densityThreshold: rawOptions.densityThreshold as CosmographerInput['options']['densityThreshold'],
      includeMetadata: rawOptions.includeMetadata as CosmographerInput['options']['includeMetadata'],
    },
  } as CosmographerInput;
}

function validateInput(input: CosmographerInput): void {
  if (!input.domainId) throw new Error('Input must have a domainId');
  if (!input.planes || input.planes.length === 0) throw new Error('Input must have at least one plane');
}

function printSummary(output: CosmographerOutput): void {
  console.error('\nGeneration Summary:');
  console.error(`  Planes: ${output.planeHierarchy.length}`);
  console.error(`  Primary: ${output.planeHierarchy.find(p => p.priority === 1)?.planeId}`);
  console.error(`  Strategy: ${output.saturationStrategy}`);
  if (!output.classifications) return;
  console.error('\nClassifications:');
  for (const [planeId, cls] of Object.entries(output.classifications)) {
    console.error(`  ${planeId}: ${cls.category} (${(cls.confidence * 100).toFixed(1)}%)`);
  }
}

const program = new Command();

program
  .name('cosmographer')
  .description('Semantic plane hierarchy generator for world structure mapping')
  .version(VERSION);

// ============================================================================
// GENERATE COMMAND
// ============================================================================

program
  .command('generate <input>')
  .description('Generate manifold configuration from input specification')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--no-metadata', 'Exclude classification metadata from output')
  .option('--strategy <type>', 'Saturation strategy: density, count, or failures', 'density')
  .option('--threshold <number>', 'Density threshold (0.0-1.0)', '0.7')
  .action((inputPath: string, options: { metadata: boolean; strategy: string; threshold: string; output?: string }) => {
    try {
      const input = parseInputFile(inputPath);
      validateInput(input);

      input.options = {
        ...input.options,
        includeMetadata: options.metadata !== false,
        saturationStrategy: options.strategy as 'density' | 'count' | 'failures',
        densityThreshold: parseFloat(options.threshold)
      };

      console.error(`Generating manifold for domain: ${input.domainId}`);
      console.error(`Space type: ${input.spaceType}`);
      console.error(`Planes: ${input.planes.length}`);

      const output = generateManifold(input);
      const json = JSON.stringify(output, null, 2);

      if (options.output) {
        writeFileSync(resolve(options.output), json);
        console.error(`\nManifold written to: ${resolve(options.output)}`);
      } else {
        console.log(json);
      }

      printSummary(output);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// ANALYZE COMMAND
// ============================================================================

program
  .command('analyze <term>')
  .description('Analyze a term and show its likely categories')
  .option('-d, --domain <type>', 'Domain class: spatial, metaphysical, conceptual, hybrid', 'hybrid')
  .action((term: string, options: { domain: string }) => {
    try {
      console.log(`Analyzing: "${term}"`);
      console.log(`Domain: ${options.domain}\n`);

      const results = analyzeTerm(term, options.domain as DomainClass);

      if (results.length === 0) {
        console.log('No matching categories found.');
        return;
      }

      console.log('Category Matches:');
      for (const result of results.slice(0, 10)) {
        const bar = '█'.repeat(Math.round(result.confidence * 20));
        const pct = (result.confidence * 100).toFixed(1);
        console.log(`  ${result.category.padEnd(20)} ${bar.padEnd(20)} ${pct}%`);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// CATEGORIES COMMAND
// ============================================================================

program
  .command('categories')
  .description('List available categories')
  .option('-d, --domain <type>', 'Filter by domain class: spatial, metaphysical, conceptual, hybrid')
  .option('--verbose', 'Show full category details')
  .action((options: { domain?: string; verbose?: boolean }) => {
    try {
      if (options.domain) {
        const categories = getCategoriesForDomain(options.domain as DomainClass);
        console.log(`Categories for domain: ${options.domain}\n`);

        for (const cat of categories) {
          if (options.verbose) {
            console.log(`${cat.id}:`);
            console.log(`  Label: ${cat.label}`);
            console.log(`  Description: ${cat.description}`);
            console.log(`  Priority: ${cat.basePriority}`);
            console.log(`  Saturation: ${cat.defaultSaturation}`);
            console.log(`  Keywords: ${cat.keywords.slice(0, 5).join(', ')}...`);
            console.log();
          } else {
            console.log(`  ${cat.id.padEnd(25)} ${cat.label}`);
          }
        }

        console.log(`\nTotal: ${categories.length} categories`);
      } else {
        const allIds = getAllCategoryIds();
        console.log('All Categories:\n');

        for (const id of allIds) {
          console.log(`  ${id}`);
        }

        console.log(`\nTotal: ${allIds.length} categories`);
        console.log('\nUse --domain <type> to filter, or --verbose for details');
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// VOCABULARY COMMAND
// ============================================================================

program
  .command('vocabulary')
  .alias('vocab')
  .description('Show word embedding vocabulary statistics')
  .action(() => {
    try {
      const stats = getVocabularyStats();

      console.log('Word Embedding Vocabulary:');
      console.log(`  Loaded: ${stats.loaded ? 'Yes' : 'No'}`);
      console.log(`  Words: ${stats.wordCount}`);
      console.log(`  Dimensions: ${stats.dimensions}`);

      if (!stats.loaded) {
        console.log('\nEmbeddings not loaded. Place vectors.json in lib/embeddings/data/');
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// MAIN
// ============================================================================

program.parse();
