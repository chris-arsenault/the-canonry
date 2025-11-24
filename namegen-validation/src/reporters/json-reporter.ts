import type { ValidationReport } from "../types/validation.js";
import { ValidationReportSchema } from "../types/schema.js";

/**
 * Serialize validation report to JSON string
 */
export function serializeReport(report: ValidationReport): string {
  // Validate before serializing
  const validated = ValidationReportSchema.parse(report);
  return JSON.stringify(validated, null, 2);
}

/**
 * Parse validation report from JSON string
 */
export function parseReport(json: string): ValidationReport {
  const parsed = JSON.parse(json);
  return ValidationReportSchema.parse(parsed);
}

/**
 * Save report to file-safe JSON string (minified)
 */
export function serializeReportCompact(report: ValidationReport): string {
  const validated = ValidationReportSchema.parse(report);
  return JSON.stringify(validated);
}
