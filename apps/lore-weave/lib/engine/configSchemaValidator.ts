/**
 * Config Schema Validator - STRUCTURE VALIDATION
 *
 * Validates JSON configuration files against JSON Schema definitions.
 * Uses ajv for standards-compliant JSON Schema validation.
 *
 * BOUNDARY: This validator handles STRUCTURE validation:
 * - Required fields present
 * - Correct types (string, number, object, array)
 * - Valid shapes (CultureSpec, SubtypeSpec, PlacementSpec, etc.)
 * - Enum constraints (prominence values, strategy types, etc.)
 *
 * DOES NOT handle (see coherence-engine for these):
 * - Reference validation (does entity kind "warrior" exist in schema?)
 * - Balance analysis (pressure has sources and sinks?)
 * - Dead code detection (orphan generators not in any era?)
 * - Semantic coherence (conflicting tags, relationship compatibility)
 *
 * Schemas are defined in lib/schemas/*.schema.json
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import generatorSchema from '../schemas/generator.schema.json';
import pressureSchema from '../schemas/pressure.schema.json';
import systemSchema from '../schemas/system.schema.json';
import eraSchema from '../schemas/era.schema.json';
import actionSchema from '../schemas/action.schema.json';
import entitySchema from '../schemas/entity.schema.json';

// =============================================================================
// TYPES
// =============================================================================

export interface SchemaError {
  path: string;
  message: string;
  value: unknown;
  expected: string;
  suggestion?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaError[];
}

// =============================================================================
// AJV SETUP
// =============================================================================

const ajv = new Ajv({
  allErrors: true,        // Collect all errors, not just the first
  verbose: true,          // Include validated data in errors
  strict: false,          // Allow additional properties by default
});

addFormats(ajv);

// Compile schemas
const validateGenerator = ajv.compile(generatorSchema);
const validatePressure = ajv.compile(pressureSchema);
const validateSystem = ajv.compile(systemSchema);
const validateEra = ajv.compile(eraSchema);
const validateAction = ajv.compile(actionSchema);
const validateEntity = ajv.compile(entitySchema);

// =============================================================================
// ERROR FORMATTING
// =============================================================================

/**
 * Convert ajv errors to our SchemaError format
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined, itemId?: string): SchemaError[] {
  if (!errors) return [];

  return errors.map(error => {
    // Build a human-readable path
    let path = error.instancePath || '/';
    if (itemId) {
      path = `"${itemId}"${path}`;
    }

    // Build expected description
    let expected = '';
    if (error.keyword === 'type') {
      expected = `type: ${error.params.type}`;
    } else if (error.keyword === 'enum') {
      expected = `one of: ${(error.params.allowedValues as string[]).join(', ')}`;
    } else if (error.keyword === 'required') {
      expected = `required property: ${error.params.missingProperty}`;
    } else if (error.keyword === 'additionalProperties') {
      expected = `no additional property: ${error.params.additionalProperty}`;
    } else if (error.keyword === 'const') {
      expected = `value: ${JSON.stringify(error.params.allowedValue)}`;
    } else if (error.keyword === 'oneOf') {
      expected = 'match one of the allowed schemas';
    } else if (error.keyword === 'minimum' || error.keyword === 'maximum') {
      expected = `${error.keyword}: ${error.params.limit}`;
    } else {
      expected = error.message || 'valid value';
    }

    // Get the invalid value
    const value = error.data;

    // Build suggestion based on error type
    let suggestion: string | undefined;
    if (error.keyword === 'required') {
      suggestion = `Add the missing "${error.params.missingProperty}" property`;
    } else if (error.keyword === 'type') {
      suggestion = `Change the value to be a ${error.params.type}`;
    } else if (error.keyword === 'enum') {
      suggestion = `Use one of the allowed values`;
    }

    return {
      path,
      message: error.message || 'Validation error',
      value,
      expected,
      suggestion,
    };
  });
}

/**
 * Get ID from an object for better error messages
 */
function getItemId(item: unknown): string | undefined {
  if (typeof item === 'object' && item !== null) {
    if ('id' in item && typeof (item as { id: unknown }).id === 'string') {
      return (item as { id: string }).id;
    }
    if ('config' in item) {
      const config = (item as { config: unknown }).config;
      if (typeof config === 'object' && config !== null && 'id' in config) {
        return (config as { id: string }).id;
      }
    }
  }
  return undefined;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateTemplates(templates: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(templates)) {
    errors.push({
      path: 'templates',
      message: 'Expected array',
      value: templates,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  templates.forEach((template, index) => {
    // Skip disabled templates
    if (typeof template === 'object' && template !== null &&
        'enabled' in template && (template as { enabled: unknown }).enabled === false) {
      return;
    }

    const itemId = getItemId(template) || `[${index}]`;

    if (!validateGenerator(template)) {
      errors.push(...formatAjvErrors(validateGenerator.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validatePressures(pressures: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(pressures)) {
    errors.push({
      path: 'pressures',
      message: 'Expected array',
      value: pressures,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  pressures.forEach((pressure, index) => {
    const itemId = getItemId(pressure) || `[${index}]`;

    if (!validatePressure(pressure)) {
      errors.push(...formatAjvErrors(validatePressure.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateSystems(systems: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(systems)) {
    errors.push({
      path: 'systems',
      message: 'Expected array',
      value: systems,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  systems.forEach((system, index) => {
    // Skip disabled systems
    if (typeof system === 'object' && system !== null &&
        'enabled' in system && (system as { enabled?: unknown }).enabled === false) {
      return;
    }

    const itemId = getItemId(system) || `[${index}]`;

    if (!validateSystem(system)) {
      errors.push(...formatAjvErrors(validateSystem.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEras(eras: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(eras)) {
    errors.push({
      path: 'eras',
      message: 'Expected array',
      value: eras,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  eras.forEach((era, index) => {
    const itemId = getItemId(era) || `[${index}]`;

    if (!validateEra(era)) {
      errors.push(...formatAjvErrors(validateEra.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateActions(actions: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(actions)) {
    errors.push({
      path: 'actions',
      message: 'Expected array',
      value: actions,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  actions.forEach((action, index) => {
    // Skip disabled actions
    if (typeof action === 'object' && action !== null &&
        'enabled' in action && (action as { enabled: unknown }).enabled === false) {
      return;
    }

    const itemId = getItemId(action) || `[${index}]`;

    if (!validateAction(action)) {
      errors.push(...formatAjvErrors(validateAction.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate world entities from simulation output or persisted data.
 * Use this when loading saved simulation data from IndexedDB.
 */
export function validateEntities(entities: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaError[] = [];

  if (!Array.isArray(entities)) {
    errors.push({
      path: 'entities',
      message: 'Expected array',
      value: entities,
      expected: 'array',
    });
    return { valid: false, errors, warnings };
  }

  entities.forEach((entity, index) => {
    const itemId = getItemId(entity) || `[${index}]`;

    if (!validateEntity(entity)) {
      errors.push(...formatAjvErrors(validateEntity.errors, itemId));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all configuration files at once
 */
export function validateAllConfigs(config: {
  templates?: unknown;
  pressures?: unknown;
  systems?: unknown;
  eras?: unknown;
  actions?: unknown;
  seedEntities?: unknown;
  schema?: {
    cultures?: string[];
    entityKinds?: string[];
    relationshipKinds?: string[];
  };
}): SchemaValidationResult {
  const allErrors: SchemaError[] = [];
  const allWarnings: SchemaError[] = [];

  if (config.templates !== undefined) {
    const result = validateTemplates(config.templates);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (config.pressures !== undefined) {
    const result = validatePressures(config.pressures);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (config.systems !== undefined) {
    const result = validateSystems(config.systems);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (config.eras !== undefined) {
    const result = validateEras(config.eras);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (config.actions !== undefined) {
    const result = validateActions(config.actions);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (config.seedEntities !== undefined) {
    const result = validateEntities(config.seedEntities);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Format validation results for display
 */
export function formatValidationResult(result: SchemaValidationResult): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    return 'Configuration is valid.';
  }

  if (result.errors.length > 0) {
    lines.push(`ERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`  [${error.path}] ${error.message}`);
      lines.push(`    Expected: ${error.expected}`);
      if (error.value !== undefined) {
        const valueStr = JSON.stringify(error.value);
        if (valueStr.length < 100) {
          lines.push(`    Got: ${valueStr}`);
        }
      }
      if (error.suggestion) {
        lines.push(`    Suggestion: ${error.suggestion}`);
      }
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`WARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      lines.push(`  [${warning.path}] ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    Suggestion: ${warning.suggestion}`);
      }
    }
  }

  return lines.join('\n');
}
