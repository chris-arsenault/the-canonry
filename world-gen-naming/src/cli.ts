#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  NamingDomainSchema,
  DomainCollectionSchema,
  GenerationRequestSchema,
} from "./types/schema.js";
import type { NamingDomain, GenerationRequest } from "./types/domain.js";
import {
  generateNames,
  generateUniqueNames,
  explainGeneration,
  testDomain,
} from "./lib/generator.js";
import { optimizeDomain, optimizeBatch } from "./lib/optimizer.js";
import {
  OptimizationSettingsSchema,
  FitnessWeightsSchema,
  ValidationSettingsSchema,
} from "./types/optimization.js";
import { writeFileSync } from "fs";

const program = new Command();

program
  .name("namegen")
  .description("Domain-aware procedural name generation CLI")
  .version("0.1.0");

/**
 * Load domain(s) from a JSON file
 */
function loadDomains(path: string): NamingDomain[] {
  const fullPath = resolve(path);
  const content = readFileSync(fullPath, "utf-8");
  const json = JSON.parse(content);

  // Try parsing as single domain
  const singleResult = NamingDomainSchema.safeParse(json);
  if (singleResult.success) {
    return [singleResult.data];
  }

  // Try parsing as domain collection
  const collectionResult = DomainCollectionSchema.safeParse(json);
  if (collectionResult.success) {
    return collectionResult.data.domains;
  }

  // Neither worked, show errors
  throw new Error(
    `Invalid domain file format:\n${JSON.stringify(singleResult.error.errors, null, 2)}`
  );
}

/**
 * Generate command - create names from domains
 */
program
  .command("generate")
  .description("Generate names from domain configs")
  .requiredOption("-d, --domains <path>", "Path to domain config JSON file")
  .requiredOption("-k, --kind <kind>", "Entity kind (e.g., npc, location)")
  .option("-s, --subkind <subkind>", "Entity subkind")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .option("-c, --count <count>", "Number of names to generate", "10")
  .option("--seed <seed>", "Random seed for deterministic generation")
  .option("--unique", "Ensure all generated names are unique")
  .option("--debug", "Show debug information for each name")
  .action((options) => {
    try {
      // Load domains
      const domains = loadDomains(options.domains);
      console.log(`Loaded ${domains.length} domain(s)\n`);

      // Parse request
      const tags = options.tags
        ? options.tags.split(",").map((t: string) => t.trim())
        : [];
      const count = parseInt(options.count, 10);

      const request: GenerationRequest = {
        kind: options.kind,
        subKind: options.subkind,
        tags,
        count,
        seed: options.seed,
      };

      // Validate request
      const validatedRequest = GenerationRequestSchema.parse(request);

      // Generate names
      const results = options.unique
        ? generateUniqueNames(domains, validatedRequest)
        : generateNames(domains, validatedRequest);

      if (results.length === 0) {
        console.log("No names generated (no matching domain found)");
        process.exit(1);
      }

      // Display results
      console.log(
        `Generated ${results.length} name(s) using domain: ${results[0].domainId}\n`
      );

      for (const result of results) {
        console.log(result.name);

        if (options.debug && result.debug) {
          console.log(`  Syllables: ${result.debug.syllables?.join("-")}`);
          console.log(`  Phonology: ${result.debug.phonology}`);
          console.log(`  Morphology: ${result.debug.morphology}`);
          console.log(`  Style: ${result.debug.style}`);
          console.log();
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Test command - test domain generation with statistics
 */
program
  .command("test")
  .description("Test a domain config with sample generation")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON file")
  .option("-c, --count <count>", "Number of samples to generate", "100")
  .option("--seed <seed>", "Random seed for deterministic generation")
  .option("--show-samples", "Display all generated samples")
  .action((options) => {
    try {
      // Load domain (expect single domain for testing)
      const domains = loadDomains(options.domain);
      if (domains.length === 0) {
        console.error("No domains found in file");
        process.exit(1);
      }

      const domain = domains[0];
      const count = parseInt(options.count, 10);

      console.log(`Testing domain: ${domain.id}`);
      console.log(`Generating ${count} samples...\n`);

      // Run test
      const stats = testDomain(domain, count, options.seed);

      // Display statistics
      console.log("Statistics:");
      console.log(`  Total samples: ${stats.samples.length}`);
      console.log(`  Unique names: ${stats.uniqueCount}`);
      console.log(
        `  Collision rate: ${((1 - stats.uniqueCount / stats.samples.length) * 100).toFixed(2)}%`
      );
      console.log(`  Avg length: ${stats.avgLength.toFixed(1)} chars`);
      console.log(`  Length range: ${stats.minLength}-${stats.maxLength}`);

      if (options.showSamples) {
        console.log("\nSamples:");
        stats.samples.slice(0, 20).forEach((name) => console.log(`  ${name}`));
        if (stats.samples.length > 20) {
          console.log(`  ... and ${stats.samples.length - 20} more`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Explain command - show domain selection logic
 */
program
  .command("explain")
  .description("Explain which domain would be selected for an entity")
  .requiredOption("-d, --domains <path>", "Path to domain config JSON file")
  .requiredOption("-k, --kind <kind>", "Entity kind")
  .option("-s, --subkind <subkind>", "Entity subkind")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .action((options) => {
    try {
      const domains = loadDomains(options.domains);
      const tags = options.tags
        ? options.tags.split(",").map((t: string) => t.trim())
        : [];

      const explanation = explainGeneration(
        domains,
        options.kind,
        options.subkind,
        tags
      );

      console.log(explanation);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Validate command - validate domain config format
 */
program
  .command("validate")
  .description("Validate domain config file format")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domain);

      console.log(`✓ Domain config is valid`);
      console.log(`  Loaded ${domains.length} domain(s):`);

      for (const domain of domains) {
        console.log(`  - ${domain.id}`);
        console.log(
          `    Applies to: kind=${domain.appliesTo.kind.join(",")}`
        );

        if (domain.appliesTo.subKind && domain.appliesTo.subKind.length > 0) {
          console.log(`    SubKinds: ${domain.appliesTo.subKind.join(",")}`);
        }

        if (domain.appliesTo.tags && domain.appliesTo.tags.length > 0) {
          console.log(`    Tags: ${domain.appliesTo.tags.join(",")}`);
        }

        console.log(
          `    Phonemes: ${domain.phonology.consonants.length}C + ${domain.phonology.vowels.length}V`
        );
        console.log(
          `    Syllable templates: ${domain.phonology.syllableTemplates.length}`
        );
        console.log(
          `    Length range: ${domain.phonology.lengthRange[0]}-${domain.phonology.lengthRange[1]} syllables`
        );
        console.log();
      }
    } catch (error) {
      console.error("✗ Validation failed:", error);
      process.exit(1);
    }
  });

/**
 * Optimize command - optimize domain parameters using ML
 */
program
  .command("optimize")
  .description("Optimize domain parameters using ML-based fitness function")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON file")
  .option("-o, --output <path>", "Output path for optimized config")
  .option(
    "-a, --algorithm <algorithm>",
    "Optimization algorithm (hillclimb, sim_anneal)",
    "hillclimb"
  )
  .option("-i, --iterations <iterations>", "Number of iterations", "100")
  .option(
    "--sample-size <size>",
    "Validation sample size",
    "1000"
  )
  .option(
    "--capacity-weight <weight>",
    "Fitness weight for capacity metric",
    "1.0"
  )
  .option(
    "--diffuseness-weight <weight>",
    "Fitness weight for diffuseness metric",
    "1.0"
  )
  .option(
    "--separation-weight <weight>",
    "Fitness weight for separation metric",
    "0.0"
  )
  .option(
    "--pronounceability-weight <weight>",
    "Fitness weight for pronounceability metric",
    "0.0"
  )
  .option(
    "--length-weight <weight>",
    "Fitness weight for length deviation metric",
    "0.0"
  )
  .option("--verbose", "Show detailed progress", false)
  .action(async (options) => {
    try {
      // Load domain
      const domains = loadDomains(options.domain);
      if (domains.length === 0) {
        console.error("No domains found in file");
        process.exit(1);
      }
      const domain = domains[0];

      // Parse optimization settings
      const optimizationSettings = OptimizationSettingsSchema.parse({
        algorithm: options.algorithm,
        iterations: parseInt(options.iterations, 10),
        verbose: options.verbose,
      });

      // Parse fitness weights
      const fitnessWeights = FitnessWeightsSchema.parse({
        capacity: parseFloat(options.capacityWeight),
        diffuseness: parseFloat(options.diffusenessWeight),
        separation: parseFloat(options.separationWeight),
        pronounceability: parseFloat(options.pronounceabilityWeight),
        length: parseFloat(options.lengthWeight),
      });

      // Parse validation settings
      const validationSettings = ValidationSettingsSchema.parse({
        requiredNames: parseInt(options.sampleSize, 10),
        sampleFactor: 1,
        maxSampleSize: parseInt(options.sampleSize, 10),
      });

      // Run optimization
      const result = await optimizeDomain(
        domain,
        validationSettings,
        fitnessWeights,
        optimizationSettings
      );

      // Save optimized config
      if (options.output) {
        const outputPath = resolve(options.output);
        writeFileSync(
          outputPath,
          JSON.stringify(result.optimizedConfig, null, 2)
        );
        console.log(`\nOptimized config saved to: ${outputPath}`);
      }

      // Display summary
      console.log("\n" + "=".repeat(60));
      console.log("OPTIMIZATION SUMMARY");
      console.log("=".repeat(60));
      console.log(`Domain: ${domain.id}`);
      console.log(`Algorithm: ${optimizationSettings.algorithm}`);
      console.log(`Iterations: ${result.iterations}`);
      console.log(`Initial fitness: ${result.initialFitness.toFixed(4)}`);
      console.log(`Final fitness: ${result.finalFitness.toFixed(4)}`);
      console.log(`Improvement: +${(result.improvement * 100).toFixed(1)}%`);
      console.log("=".repeat(60));
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Optimize-batch command - optimize multiple domains
 */
program
  .command("optimize-batch")
  .description("Optimize multiple domains in batch")
  .requiredOption("-d, --domains <path>", "Path to domains collection JSON file")
  .requiredOption("-o, --output-dir <dir>", "Output directory for optimized configs")
  .option(
    "-a, --algorithm <algorithm>",
    "Optimization algorithm (hillclimb, sim_anneal)",
    "hillclimb"
  )
  .option("-i, --iterations <iterations>", "Number of iterations per domain", "100")
  .option("--sample-size <size>", "Validation sample size", "1000")
  .option("--verbose", "Show detailed progress", false)
  .action(async (options) => {
    try {
      // Load domains
      const domains = loadDomains(options.domains);
      if (domains.length === 0) {
        console.error("No domains found in file");
        process.exit(1);
      }

      console.log(`Loaded ${domains.length} domains for batch optimization\n`);

      // Parse settings
      const optimizationSettings = OptimizationSettingsSchema.parse({
        algorithm: options.algorithm,
        iterations: parseInt(options.iterations, 10),
        verbose: options.verbose,
      });

      const fitnessWeights = FitnessWeightsSchema.parse({
        capacity: 1.0,
        diffuseness: 1.0,
        separation: 0.0,
      });

      const validationSettings = ValidationSettingsSchema.parse({
        requiredNames: parseInt(options.sampleSize, 10),
        sampleFactor: 1,
        maxSampleSize: parseInt(options.sampleSize, 10),
      });

      // Run batch optimization
      const results = await optimizeBatch(
        domains,
        validationSettings,
        fitnessWeights,
        optimizationSettings
      );

      // Save results
      const outputDir = resolve(options.outputDir);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const outputPath = `${outputDir}/${result.optimizedConfig.id}.json`;
        writeFileSync(
          outputPath,
          JSON.stringify(result.optimizedConfig, null, 2)
        );
        console.log(`Saved optimized config: ${outputPath}`);
      }

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("BATCH OPTIMIZATION COMPLETE");
      console.log("=".repeat(60));
      for (const result of results) {
        console.log(
          `${result.optimizedConfig.id}: ` +
            `${result.initialFitness.toFixed(4)} → ${result.finalFitness.toFixed(4)} ` +
            `(+${(result.improvement * 100).toFixed(1)}%)`
        );
      }
      console.log("=".repeat(60));
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
