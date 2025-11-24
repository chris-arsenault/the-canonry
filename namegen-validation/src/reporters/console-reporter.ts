import type {
  CapacityReport,
  DiffusenessReport,
  SeparationReport,
  ValidationReport,
} from "../types/validation.js";

/**
 * Format capacity report for console output
 */
export function formatCapacityReport(report: CapacityReport): string {
  const lines: string[] = [];

  lines.push(`\n=== Capacity Report: ${report.domainId} ===\n`);
  lines.push(`Sample size: ${report.sampleSize}`);
  lines.push(`Unique names: ${report.uniqueCount} (${((report.uniqueCount / report.sampleSize) * 100).toFixed(1)}%)`);
  lines.push(`Collision rate: ${(report.collisionRate * 100).toFixed(2)}%`);
  lines.push(`Shannon entropy: ${report.entropy.toFixed(3)} bits/char`);
  lines.push(`Name length: ${report.avgLength.toFixed(1)} chars (${report.minLength}-${report.maxLength})`);

  lines.push(`\nStatus: ${report.passed ? "✓ PASSED" : "✗ FAILED"}`);

  if (report.issues.length > 0) {
    lines.push("\nIssues:");
    for (const issue of report.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format diffuseness report for console output
 */
export function formatDiffusenessReport(report: DiffusenessReport): string {
  const lines: string[] = [];

  lines.push(`\n=== Diffuseness Report: ${report.domainId} ===\n`);
  lines.push(`Sample size: ${report.sampleSize}`);

  lines.push("\nLevenshtein nearest-neighbor distances:");
  lines.push(`  Min:    ${report.levenshteinNN.min.toFixed(3)}`);
  lines.push(`  p1:     ${report.levenshteinNN.p1.toFixed(3)}`);
  lines.push(`  p5:     ${report.levenshteinNN.p5.toFixed(3)}`);
  lines.push(`  Median: ${report.levenshteinNN.median.toFixed(3)}`);
  lines.push(`  Mean:   ${report.levenshteinNN.mean.toFixed(3)}`);

  lines.push("\nShape nearest-neighbor distances:");
  lines.push(`  Min:    ${report.shapeNN.min.toFixed(3)}`);
  lines.push(`  p5:     ${report.shapeNN.p5.toFixed(3)}`);
  lines.push(`  Median: ${report.shapeNN.median.toFixed(3)}`);

  lines.push(`\nStatus: ${report.passed ? "✓ PASSED" : "✗ FAILED"}`);

  if (report.issues.length > 0) {
    lines.push("\nIssues:");
    for (const issue of report.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format separation report for console output
 */
export function formatSeparationReport(report: SeparationReport): string {
  const lines: string[] = [];

  lines.push(`\n=== Separation Report ===\n`);
  lines.push(`Domains: ${report.domains.join(", ")}`);
  lines.push(`Sample size per domain: ${report.sampleSize}`);
  lines.push(`Classifier accuracy: ${(report.classifierAccuracy * 100).toFixed(1)}%`);

  lines.push("\nPairwise centroid distances:");
  for (const [pair, distance] of Object.entries(report.pairwiseDistances)) {
    lines.push(`  ${pair}: ${distance.toFixed(3)}`);
  }

  lines.push("\nConfusion matrix:");
  for (const actual of report.domains) {
    const row = report.domains
      .map((predicted) => {
        const count = report.confusionMatrix[actual]?.[predicted] ?? 0;
        return count.toString().padStart(4);
      })
      .join(" ");
    lines.push(`  ${actual.padEnd(20)} ${row}`);
  }

  lines.push(`\nStatus: ${report.passed ? "✓ PASSED" : "✗ FAILED"}`);

  if (report.issues.length > 0) {
    lines.push("\nIssues:");
    for (const issue of report.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format full validation report for console output
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push(`\n====================================`);
  lines.push(`    Validation Report`);
  lines.push(`    ${report.timestamp}`);
  lines.push(`====================================`);

  if (report.capacity) {
    lines.push(formatCapacityReport(report.capacity));
  }

  if (report.diffuseness) {
    lines.push(formatDiffusenessReport(report.diffuseness));
  }

  if (report.separation) {
    lines.push(formatSeparationReport(report.separation));
  }

  lines.push(`\n====================================`);
  lines.push(`Overall: ${report.overallPassed ? "✓ ALL PASSED" : "✗ SOME FAILED"}`);
  lines.push(`====================================\n`);

  return lines.join("\n");
}
