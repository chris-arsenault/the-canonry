const Ajv = require('ajv');
const fs = require('fs');

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync('apps/lore-weave/lib/schemas/generator.schema.json', 'utf8'));
const generators = JSON.parse(fs.readFileSync('apps/canonry/webui/public/default-project/generators.json', 'utf8'));

const validate = ajv.compile(schema);

let totalErrors = 0;
generators.forEach((gen, index) => {
  const valid = validate(gen);
  if (!valid) {
    console.log('\n=== Generator', index, ':', gen.id || 'unknown', '===');
    validate.errors.forEach(err => {
      console.log(err.instancePath, '-', err.message, JSON.stringify(err.params));
    });
    totalErrors += validate.errors.length;
  }
});
console.log('\nTotal errors:', totalErrors);
