const Ajv = require('ajv');
const fs = require('fs');

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync('apps/lore-weave/lib/schemas/system.schema.json', 'utf8'));
const systems = JSON.parse(fs.readFileSync('apps/canonry/webui/public/default-project/systems.json', 'utf8'));

const validate = ajv.compile(schema);

let totalErrors = 0;
systems.forEach((system, index) => {
  const valid = validate(system);
  if (!valid) {
    console.log('\n=== System', index, ':', system.config?.id || 'unknown', '===');
    validate.errors.forEach(err => {
      console.log(err.instancePath, '-', err.message, JSON.stringify(err.params));
    });
    totalErrors += validate.errors.length;
  }
});
console.log('\nTotal errors:', totalErrors);
