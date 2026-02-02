/**
 * Config Validation Script
 *
 * Validates the canonry project JSON files against their schemas.
 * Usage: npx tsx scripts/validate-configs.ts
 */

import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({ allErrors: true, verbose: true });

const SCHEMA_DIR = path.join(__dirname, '../lib/schemas');
const CONFIG_DIR = '/home/tsonu/src/penguin-tales/apps/canonry/webui/public/default-project';

interface ValidationResult {
  file: string;
  valid: boolean;
  errorCount: number;
  errors: Array<{
    path: string;
    message: string;
    keyword: string;
    params: Record<string, unknown>;
  }>;
}

const CONFIG_TO_SCHEMA: Record<string, string> = {
  'systems.json': 'system.schema.json',
  'generators.json': 'generator.schema.json',
  'actions.json': 'action.schema.json',
  'eras.json': 'era.schema.json',
  'pressures.json': 'pressure.schema.json',
};

function loadSchema(schemaFile: string): object {
  const schemaPath = path.join(SCHEMA_DIR, schemaFile);
  const content = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(content);
}

function loadConfig(configFile: string): unknown {
  const configPath = path.join(CONFIG_DIR, configFile);
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

function validateConfig(configFile: string, schemaFile: string): ValidationResult {
  const schema = loadSchema(schemaFile);
  const config = loadConfig(configFile);

  const validate = ajv.compile(schema);

  // Config files are arrays - validate each item
  const items = Array.isArray(config) ? config : [config];
  const allErrors: ValidationResult['errors'] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const valid = validate(item);

    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        allErrors.push({
          path: `[${i}]${err.instancePath || ''}`,
          message: err.message || 'Unknown error',
          keyword: err.keyword,
          params: err.params as Record<string, unknown>,
        });
      }
    }
  }

  return {
    file: configFile,
    valid: allErrors.length === 0,
    errorCount: allErrors.length,
    errors: allErrors,
  };
}

function groupErrors(errors: ValidationResult['errors']): Map<string, ValidationResult['errors']> {
  const grouped = new Map<string, ValidationResult['errors']>();

  for (const error of errors) {
    const key = `${error.keyword}: ${error.message}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(error);
  }

  return grouped;
}

function main() {
  console.log('Validating config files against schemas...\n');

  let totalErrors = 0;

  for (const [configFile, schemaFile] of Object.entries(CONFIG_TO_SCHEMA)) {
    try {
      const result = validateConfig(configFile, schemaFile);

      if (result.valid) {
        console.log(`✓ ${configFile}: VALID`);
      } else {
        console.log(`✗ ${configFile}: ${result.errorCount} errors`);
        totalErrors += result.errorCount;

        // Group errors by type
        const grouped = groupErrors(result.errors);

        for (const [errorType, errors] of grouped) {
          console.log(`\n  [${errorType}] (${errors.length} occurrences)`);

          // Show first 5 paths for each error type
          const sample = errors.slice(0, 5);
          for (const err of sample) {
            console.log(`    - ${err.path}`);
            if (err.params && Object.keys(err.params).length > 0) {
              console.log(`      params: ${JSON.stringify(err.params)}`);
            }
          }
          if (errors.length > 5) {
            console.log(`    ... and ${errors.length - 5} more`);
          }
        }
        console.log('');
      }
    } catch (err) {
      console.log(`✗ ${configFile}: ERROR - ${(err as Error).message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total validation errors: ${totalErrors}`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
