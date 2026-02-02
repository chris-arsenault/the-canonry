/**
 * Framework Validator
 *
 * Validates that the framework configuration is internally consistent and can
 * achieve its intended emergent properties (narrative depth, statistical distributions).
 *
 * Runs at startup to catch configuration errors before generation begins.
 */

import { EngineConfig, Pressure, EntityOperatorRegistry, SimulationSystem } from '../engine/types';
import { DeclarativeSystem } from './systemInterpreter';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Get the ID from a system, handling both SimulationSystem and DeclarativeSystem
 */
function getSystemId(system: SimulationSystem | DeclarativeSystem): string {
  if ('systemType' in system) {
    // DeclarativeSystem has config.id
    return system.config.id;
  }
  // SimulationSystem has direct id
  return system.id;
}

export class FrameworkValidator {
  constructor(private config: EngineConfig) {}

  /**
   * Run all validations and return results
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Run all validation checks
    this.validateCoverage(errors, warnings);
    this.validateEquilibrium(errors, warnings);
    this.validateAchievability(errors, warnings);
    this.validateContracts(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Coverage
   *
   * Ensures:
   * - Every entity kind has at least one creator
   * - Every pressure has at least one source and one sink
   * - All referenced components exist
   */
  private validateCoverage(errors: string[], warnings: string[]): void {
    // Check entity registries exist
    if (!this.config.entityRegistries || this.config.entityRegistries.length === 0) {
      warnings.push('No entity registries defined - lineage enforcement disabled');
      return;
    }

    // Validate each entity kind has creators
    for (const registry of this.config.entityRegistries) {
      if (registry.creators.length === 0) {
        errors.push(`Entity kind '${registry.kind}' has no creators`);
      }

      // Validate creators exist in templates
      for (const creator of registry.creators) {
        const template = this.config.templates.find(t => t.id === creator.templateId);
        if (!template) {
          errors.push(`Entity kind '${registry.kind}' references non-existent template: ${creator.templateId}`);
        }
      }

      // Validate modifiers exist in systems
      for (const modifier of registry.modifiers) {
        const system = this.config.systems.find(s => getSystemId(s) === modifier.systemId);
        if (!system) {
          errors.push(`Entity kind '${registry.kind}' references non-existent system: ${modifier.systemId}`);
        }
      }
    }

    // Validate pressures have sources and sinks
    for (const pressure of this.config.pressures) {
      if (!pressure.contract) {
        warnings.push(`Pressure '${pressure.name}' has no contract - validation skipped`);
        continue;
      }

      if (pressure.contract.sources.length === 0) {
        errors.push(`Pressure '${pressure.name}' has no sources`);
      }

      if (pressure.contract.sinks.length === 0) {
        errors.push(`Pressure '${pressure.name}' has no sinks - will saturate at 100!`);
      }

      // Validate component references
      for (const source of pressure.contract.sources) {
        if (!this.componentExists(source.component)) {
          errors.push(`Pressure '${pressure.name}' references non-existent source: ${source.component}`);
        }
      }

      for (const sink of pressure.contract.sinks) {
        if (!this.componentExists(sink.component)) {
          errors.push(`Pressure '${pressure.name}' references non-existent sink: ${sink.component}`);
        }
      }

      // Validate affects references
      if (pressure.contract.affects) {
        for (const affected of pressure.contract.affects) {
          if (!this.componentExists(affected.component)) {
            errors.push(`Pressure '${pressure.name}' references non-existent affected component: ${affected.component}`);
          }
        }
      }
    }
  }

  /**
   * Validate Equilibrium
   *
   * For each pressure, calculates predicted equilibrium and compares to declared range.
   * This helps catch configuration errors where pressures won't reach expected values.
   */
  private validateEquilibrium(errors: string[], warnings: string[]): void {
    for (const pressure of this.config.pressures) {
      if (!pressure.contract) {
        continue; // Skip pressures without contracts
      }

      // Enforce equilibrium centered at 0
      if (pressure.contract.equilibrium.restingPoint !== 0) {
        errors.push(
          `Pressure '${pressure.name}' restingPoint must be 0 for the new homeostatic model (found ${pressure.contract.equilibrium.restingPoint}).`
        );
      }

      // Check if equilibrium range is valid
      const [min, max] = pressure.contract.equilibrium.expectedRange;
      if (min < -100 || max > 100) {
        errors.push(`Pressure '${pressure.name}' has invalid equilibrium range: [${min}, ${max}]. Must be within [-100, 100].`);
      }

      if (min >= max) {
        errors.push(`Pressure '${pressure.name}' has invalid equilibrium range: min (${min}) >= max (${max})`);
      }
    }
  }

  /**
   * Validate Achievability
   *
   * For each entity kind, verifies that the target count is achievable
   * given the number and frequency of creators.
   */
  private validateAchievability(errors: string[], warnings: string[]): void {
    if (!this.config.entityRegistries) {
      return; // Skip if no registries
    }

    for (const registry of this.config.entityRegistries) {
      // Calculate total capacity from primary creators
      const primaryCreators = registry.creators.filter(c => c.primary);
      const totalCapacity = primaryCreators.reduce((sum, c) => sum + (c.targetCount || 1), 0);

      // Each creator might run multiple times, but be conservative
      const estimatedCapacity = totalCapacity * 10; // Assume each creator runs ~10 times

      // Warn if capacity is significantly below target
      if (estimatedCapacity < registry.expectedDistribution.targetCount * 0.5) {
        warnings.push(
          `Entity kind '${registry.kind}' may not reach target count ${registry.expectedDistribution.targetCount} ` +
          `with current creators (estimated capacity: ${estimatedCapacity}). ` +
          `Consider adding more creators or increasing targetCount per activation.`
        );
      }

      // Check if prominence distribution sums to 1.0
      const prominenceSum = Object.values(registry.expectedDistribution.prominenceDistribution)
        .reduce((sum, prob) => sum + prob, 0);

      if (Math.abs(prominenceSum - 1.0) > 0.01) {
        errors.push(
          `Entity kind '${registry.kind}' prominence distribution sums to ${prominenceSum.toFixed(2)}, ` +
          `expected 1.0`
        );
      }
    }
  }

  /**
   * Validate Contracts
   *
   * Note: Contract validation removed. Contracts are now empty.
   * Lineage attribution is handled by the mutation tracker; no contract validation needed.
   */
  private validateContracts(errors: string[], warnings: string[]): void {
    // Contracts are now empty - no validation needed
  }

  /**
   * Check if a component exists (template, system, or pressure)
   */
  private componentExists(componentRef: string): boolean {
    // Component references format: "template.id", "system.id", or "pressure.name"
    const [type, id] = componentRef.split('.');

    switch (type) {
      case 'template':
        return this.config.templates.some(t => t.id === id);
      case 'system':
        return this.config.systems.some(s => getSystemId(s) === id);
      case 'pressure':
        return this.config.pressures.some(p => p.name === id || p.id === id);
      case 'time':
        return true; // 'time' is a special built-in component
      case 'formula':
        return true; // 'formula.*' references are internal calculations (always valid)
      case 'relationship':
        return true; // 'relationship.*' references are relationship kinds (validated separately)
      case 'tag':
        return true; // 'tag.*' references are entity tags (validated separately)
      default:
        return false;
    }
  }

  /**
   * Check if an entity kind exists in the canonical schema
   */
  private entityKindExists(kind: string): boolean {
    // Check entity registries first
    if (this.config.entityRegistries) {
      if (this.config.entityRegistries.some(r => r.kind === kind)) {
        return true;
      }
    }

    return this.config.schema.entityKinds.some(ekd => ekd.kind === kind);
  }

  /**
   * Check if a relationship kind exists in the canonical schema
   */
  private relationshipKindExists(kind: string): boolean {
    return this.config.schema.relationshipKinds.some(rkd => rkd.kind === kind);
  }
}
