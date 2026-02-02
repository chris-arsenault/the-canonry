#!/usr/bin/env node
/**
 * Schema Validation Script
 *
 * Validates all domain configuration JSON files against their schemas.
 *
 * Usage:
 *   node scripts/validate-schemas.cjs [--verbose] [--project <path>]
 *
 * Options:
 *   --verbose    Show detailed error information
 *   --project    Path to project directory (default: apps/canonry/webui/public/default-project)
 */

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const projectIdx = args.indexOf('--project');
const projectPath = projectIdx !== -1 && args[projectIdx + 1]
  ? args[projectIdx + 1]
  : 'apps/canonry/webui/public/default-project';

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'apps/lore-weave/lib/schemas');
const PROJECT_DIR = path.join(ROOT, projectPath);

// Schema to file mapping
const VALIDATIONS = [
  { schema: 'generator.schema.json', file: 'generators.json', isArray: true },
  { schema: 'system.schema.json', file: 'systems.json', isArray: true },
  { schema: 'action.schema.json', file: 'actions.json', isArray: true },
  { schema: 'era.schema.json', file: 'eras.json', isArray: true },
  { schema: 'pressure.schema.json', file: 'pressures.json', isArray: true },
];

function loadJson(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (err) {
    console.error(`Failed to load ${filepath}: ${err.message}`);
    return null;
  }
}

function validate() {
  const ajv = new Ajv({ allErrors: true, strict: false });

  let totalErrors = 0;
  let totalItems = 0;

  console.log(`Validating project: ${projectPath}\n`);

  for (const { schema: schemaFile, file, isArray } of VALIDATIONS) {
    const schemaPath = path.join(SCHEMA_DIR, schemaFile);
    const dataPath = path.join(PROJECT_DIR, file);

    if (!fs.existsSync(schemaPath)) {
      console.log(`⚠ Schema not found: ${schemaFile}`);
      continue;
    }

    if (!fs.existsSync(dataPath)) {
      console.log(`⚠ Data file not found: ${file}`);
      continue;
    }

    const schema = loadJson(schemaPath);
    const data = loadJson(dataPath);

    if (!schema || !data) continue;

    const validate = ajv.compile(schema);
    const items = isArray ? data : [data];
    let fileErrors = 0;
    const errorDetails = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      totalItems++;

      if (!validate(item)) {
        fileErrors++;
        totalErrors++;

        const itemId = item.id || item.config?.id || `index ${i}`;

        if (verbose) {
          errorDetails.push({
            id: itemId,
            errors: validate.errors.slice(0, 5).map(e => ({
              path: e.instancePath || '/',
              message: e.message,
              params: e.params
            }))
          });
        } else {
          errorDetails.push(itemId);
        }
      }
    }

    if (fileErrors === 0) {
      console.log(`✓ ${file}: ${items.length} items valid`);
    } else {
      console.log(`✗ ${file}: ${fileErrors}/${items.length} items have errors`);

      if (verbose) {
        for (const detail of errorDetails) {
          console.log(`  └─ ${detail.id}:`);
          for (const err of detail.errors) {
            console.log(`     ${err.path}: ${err.message}`);
          }
        }
      } else {
        console.log(`  └─ ${errorDetails.join(', ')}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(50)}`);

  if (totalErrors === 0) {
    console.log(`✓ All ${totalItems} items validated successfully`);
    process.exit(0);
  } else {
    console.log(`✗ ${totalErrors} validation errors found`);
    console.log(`  Run with --verbose for details`);
    process.exit(1);
  }
}

validate();
