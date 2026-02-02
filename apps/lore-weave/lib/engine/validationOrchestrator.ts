/**
 * Validation Orchestrator
 *
 * Orchestrates framework validation and displays results.
 * Extracted from WorldEngine constructor for Single Responsibility.
 */

import { EngineConfig } from '../engine/types';
import { FrameworkValidator } from './frameworkValidator';

/**
 * Validation result with formatted output
 */
export interface ValidationResult {
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Orchestrates validation and console output
 */
export class ValidationOrchestrator {
  /**
   * Run validation and display results
   * @throws Error if validation fails
   */
  static validateAndDisplay(config: EngineConfig): ValidationResult {
    console.log('='.repeat(80));
    console.log('FRAMEWORK VALIDATION');
    console.log('='.repeat(80));

    const validator = new FrameworkValidator(config);
    const result = validator.validate();

    // Display errors
    if (result.errors.length > 0) {
      console.error('\n❌ VALIDATION ERRORS:');
      result.errors.forEach(error => console.error(`  - ${error}`));
      console.log('='.repeat(80));
      throw new Error(`Framework validation failed with ${result.errors.length} error(s)`);
    }

    console.log('✓ No validation errors');
    console.log('='.repeat(80));

    // Display warnings
    if (result.warnings.length > 0) {
      console.warn('\n⚠️  VALIDATION WARNINGS:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    return {
      hasErrors: result.errors.length > 0,
      hasWarnings: result.warnings.length > 0,
      errors: result.errors,
      warnings: result.warnings
    };
  }

  /**
   * Display service initialization status
   */
  static displayServiceStatus(
    metaEntityConfigs: any[],
    hasTargetSelector: boolean
  ): void {
    // Contract enforcement
    console.log('✓ Contract enforcement enabled');
    console.log('  - Template filtering by applicability rules');
    console.log('  - Automatic lineage relationship creation');
    console.log('  - Contract affects validation');

    // Target selection
    if (hasTargetSelector) {
      console.log('✓ Intelligent target selection enabled (anti-super-hub)');
    }

    // Meta-entity formation
    if (metaEntityConfigs && metaEntityConfigs.length > 0) {
      console.log('✓ Meta-entity formation system initialized');
      metaEntityConfigs.forEach((cfg: any) => {
        console.log(`  - Registered ${cfg.name} formation`);
      });
    }
  }
}
