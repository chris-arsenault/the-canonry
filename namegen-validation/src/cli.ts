#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  NamingDomainSchema,
  DomainCollectionSchema,
} from "world-gen-naming";
import type { NamingDomain } from "world-gen-naming";
import type { ValidationReport } from "./index.js";
import { validateCapacity } from "./metrics/capacity.js";
import { validateDiffuseness } from "./metrics/diffuseness.js";
import { validateSeparation } from "./metrics/separation.js";
import {
  formatCapacityReport,
  formatDiffusenessReport,
  formatSeparationReport,
  formatValidationReport,
  serializeReport,
} from "./reporters/index.js";

const program = new Command();

program
  .name("validate-names")
  .description("Validation metrics for name generation domains")
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

  throw new Error(`Invalid domain file format`);
}

/**
 * Capacity command
 */
program
  .command("capacity")
  .description("Validate capacity (can domain generate enough unique names?)")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON")
  .option("-s, --sample <size>", "Sample size", "1000")
  .option("--seed <seed>", "Random seed for deterministic testing")
  .option("--json", "Output JSON instead of formatted text")
  .option("-o, --output <path>", "Save report to file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domain);
      if (domains.length === 0) {
        console.error("No domains found");
        process.exit(1);
      }

      const domain = domains[0];
      const sampleSize = parseInt(options.sample, 10);

      console.log(`Validating capacity for domain: ${domain.id}`);
      console.log(`Sample size: ${sampleSize}\n`);

      const report = validateCapacity(domain, {
        sampleSize,
        seed: options.seed,
      });

      if (options.json) {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const output = formatCapacityReport(report);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      }

      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Diffuseness command
 */
program
  .command("diffuseness")
  .description(
    "Validate diffuseness (are names within domain distinct enough?)"
  )
  .requiredOption("-d, --domain <path>", "Path to domain config JSON")
  .option("-s, --sample <size>", "Sample size", "500")
  .option("--seed <seed>", "Random seed")
  .option("--json", "Output JSON")
  .option("-o, --output <path>", "Save report to file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domain);
      if (domains.length === 0) {
        console.error("No domains found");
        process.exit(1);
      }

      const domain = domains[0];
      const sampleSize = parseInt(options.sample, 10);

      console.log(`Validating diffuseness for domain: ${domain.id}`);
      console.log(`Sample size: ${sampleSize}\n`);

      const report = validateDiffuseness(domain, {
        sampleSize,
        seed: options.seed,
      });

      if (options.json) {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const output = formatDiffusenessReport(report);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      }

      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Separation command
 */
program
  .command("separation")
  .description("Validate separation (can domains be distinguished by shape?)")
  .requiredOption("-d, --domains <path>", "Path to domain collection JSON")
  .option("-s, --sample <size>", "Sample size per domain", "200")
  .option("--seed <seed>", "Random seed")
  .option("--json", "Output JSON")
  .option("-o, --output <path>", "Save report to file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domains);
      if (domains.length < 2) {
        console.error("Need at least 2 domains for separation testing");
        process.exit(1);
      }

      const sampleSize = parseInt(options.sample, 10);

      console.log(`Validating separation between domains:`);
      domains.forEach((d) => console.log(`  - ${d.id}`));
      console.log(`Sample size per domain: ${sampleSize}\n`);

      const report = validateSeparation(domains, {
        sampleSize,
        seed: options.seed,
      });

      if (options.json) {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const output = formatSeparationReport(report);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      }

      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * All command - run all validations
 */
program
  .command("all")
  .description("Run all validation metrics")
  .requiredOption("-d, --domains <path>", "Path to domain(s) JSON")
  .option("--capacity-sample <size>", "Capacity sample size", "1000")
  .option("--diffuseness-sample <size>", "Diffuseness sample size", "500")
  .option("--separation-sample <size>", "Separation sample size", "200")
  .option("--seed <seed>", "Random seed")
  .option("--json", "Output JSON")
  .option("-o, --output <path>", "Save report to file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domains);
      if (domains.length === 0) {
        console.error("No domains found");
        process.exit(1);
      }

      console.log(`Running all validations on ${domains.length} domain(s)\n`);

      const report: ValidationReport = {
        timestamp: new Date().toISOString(),
        overallPassed: true,
      };

      // Capacity (first domain only)
      const capacitySample = parseInt(options.capacitySample, 10);
      const capacityReport = validateCapacity(domains[0], {
        sampleSize: capacitySample,
        seed: options.seed,
      });
      report.capacity = capacityReport;
      if (!capacityReport.passed) report.overallPassed = false;

      // Diffuseness (first domain only)
      const diffusenessSample = parseInt(options.diffusenessSample, 10);
      const diffusenessReport = validateDiffuseness(domains[0], {
        sampleSize: diffusenessSample,
        seed: options.seed,
      });
      report.diffuseness = diffusenessReport;
      if (!diffusenessReport.passed) report.overallPassed = false;

      // Separation (if multiple domains)
      if (domains.length > 1) {
        const separationSample = parseInt(options.separationSample, 10);
        const separationReport = validateSeparation(domains, {
          sampleSize: separationSample,
          seed: options.seed,
        });
        report.separation = separationReport;
        if (!separationReport.passed) report.overallPassed = false;
      }

      if (options.json) {
        const output = serializeReport(report);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const output = formatValidationReport(report);
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Report saved to ${options.output}`);
        } else {
          console.log(output);
        }
      }

      process.exit(report.overallPassed ? 0 : 1);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
