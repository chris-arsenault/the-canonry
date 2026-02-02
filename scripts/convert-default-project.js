import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeCanonProject } from '../packages/canonry-dsl-v2/dist/serialize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, '..', 'apps', 'canonry', 'webui', 'public', 'default-project');

const manifest = JSON.parse(await readFile(path.join(baseDir, 'manifest.json'), 'utf8'));
const project = { ...manifest };

const jsonFiles = {
  entityKinds: 'entityKinds.json',
  relationshipKinds: 'relationshipKinds.json',
  cultures: 'cultures.json',
  tagRegistry: 'tagRegistry.json',
  axisDefinitions: 'axisDefinitions.json',
  uiConfig: 'uiConfig.json',
  eras: 'eras.json',
  pressures: 'pressures.json',
  generators: 'generators.json',
  systems: 'systems.json',
  actions: 'actions.json',
  seedEntities: 'seedEntities.json',
  seedRelationships: 'seedRelationships.json',
  distributionTargets: 'distributionTargets.json',
};

for (const [key, filename] of Object.entries(jsonFiles)) {
  const filePath = path.join(baseDir, filename);
  try {
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    project[key] = data;
  } catch (error) {
    console.warn(`Skipping ${filename}: ${error?.message || error}`);
  }
}

const files = serializeCanonProject(project, { includeEmpty: true });
await Promise.all(
  files.map((file) => writeFile(path.join(baseDir, file.path), file.content, 'utf8'))
);

console.log(`Wrote ${files.length} .canon files to ${baseDir}`);
