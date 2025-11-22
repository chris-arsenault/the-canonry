import { WorldEngine } from './engine/worldEngine';
import { EngineConfig } from './types/engine';
import { HardState } from './types/worldTypes';

// Import configuration
import { penguinEras } from './config/eras';
import { pressures } from './config/pressures';

// Import templates
import { npcTemplates } from './templates/npc';
import { factionTemplates } from './templates/faction';
import { rulesTemplates } from './templates/rules';
import { abilitiesTemplates } from './templates/abilities';
import { locationTemplates } from './templates/location';

// Import systems
import { allSystems } from './systems';

// Import helpers
import { normalizeInitialState } from './utils/helpers';
import { loadLoreIndex } from './services/loreIndex';
import { EnrichmentService } from './services/enrichmentService';

// Load initial state (you'll need to adjust the path)
import initialStateData from '../data/initialState.json';

// LLM / lore configuration (default disabled to prevent accidents)
const llmEnabled = process.env.LLM_ENABLED === 'true';
const llmModel = process.env.LLM_MODEL || 'claude-3-5-haiku-20241022';
const loreIndex = loadLoreIndex('./data/LORE_BIBLE.md');
const llmConfig = {
  enabled: llmEnabled,
  model: llmModel,
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 512,
  temperature: 0.4
};
const enrichmentService = llmEnabled
  ? new EnrichmentService(llmConfig, loreIndex, { batchSize: Number(process.env.LLM_BATCH_SIZE) || 3 })
  : undefined;

// Configuration
const config: EngineConfig = {
  eras: penguinEras,
  templates: [
    ...npcTemplates,
    ...factionTemplates,
    ...rulesTemplates,
    ...abilitiesTemplates,
    ...locationTemplates
  ],
  systems: allSystems,
  pressures: pressures,
  llmConfig,
  enrichmentConfig: { batchSize: Number(process.env.LLM_BATCH_SIZE) || 3 },
  loreIndex,

  // Tuning parameters
  epochLength: 20,                    // ticks per epoch
  simulationTicksPerGrowth: 10,       // simulation ticks between growth phases
  targetEntitiesPerKind: 30,          // target ~150 total entities (5 kinds)
  maxTicks: 500,                      // maximum simulation ticks
  maxRelationshipsPerType: 3          // max relationships of same type per entity
};

// Main execution
async function generateWorld() {
  console.log('===========================================');
  console.log('   PROCEDURAL WORLD HISTORY GENERATOR');
  console.log('      Super Penguin Colony Simulation');
  console.log('===========================================\n');
  console.log(`LLM enrichment: ${llmEnabled ? 'enabled' : 'disabled'}${llmEnabled ? ` (${llmModel})` : ''}\n`);

  // Parse and normalize initial state
  const initialState: HardState[] = normalizeInitialState(initialStateData.hardState);

  // Create and run engine
  const engine = new WorldEngine(config, initialState, enrichmentService);
  
  console.time('Generation Time');
  const finalGraph = engine.run();
  console.timeEnd('Generation Time');
  await engine.finalizeEnrichments();
  
  // Export results
  const worldState = engine.exportState();
  
  // Statistics
  console.log('\n=== FINAL STATISTICS ===');
  console.log(`Total Entities: ${worldState.metadata.entityCount}`);
  console.log(`Total Relationships: ${worldState.metadata.relationshipCount}`);
  console.log(`Simulation Ticks: ${worldState.metadata.tick}`);
  console.log(`Epochs Completed: ${worldState.metadata.epoch}`);
  
  // Entity breakdown
  const entityBreakdown: Record<string, number> = {};
  worldState.hardState.forEach((entity: HardState) => {
    const key = `${entity.kind}:${entity.subtype}`;
    entityBreakdown[key] = (entityBreakdown[key] || 0) + 1;
  });
  
  console.log('\n=== ENTITY BREAKDOWN ===');
  Object.entries(entityBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  // Relationship breakdown
  const relationshipBreakdown: Record<string, number> = {};
  worldState.relationships.forEach((rel: any) => {
    relationshipBreakdown[rel.kind] = (relationshipBreakdown[rel.kind] || 0) + 1;
  });
  
  console.log('\n=== RELATIONSHIP TYPES ===');
  Object.entries(relationshipBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  // Sample history events
  console.log('\n=== SAMPLE HISTORY EVENTS ===');
  const sampleEvents = worldState.history
    .filter((e: any) => e.description && e.entitiesCreated.length > 0)
    .slice(-10);
    
  sampleEvents.forEach((event: any) => {
    console.log(`  [Tick ${event.tick}] ${event.description}`);
  });
  
  // Notable entities (highest prominence)
  console.log('\n=== NOTABLE ENTITIES ===');
  const notableEntities = worldState.hardState
    .filter((e: HardState) => e.prominence === 'renowned' || e.prominence === 'mythic')
    .slice(0, 10);
    
  notableEntities.forEach((entity: HardState) => {
    console.log(`  ${entity.name} (${entity.kind}:${entity.subtype}) - ${entity.prominence}`);
    console.log(`    "${entity.description}"`);
  });
  
  // Write output to file
  const fs = require('fs');
  const outputPath = './output/generated_world.json';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(worldState, null, 2));
  console.log(`\n✅ World state exported to ${outputPath}`);
  
  // Also export a graph visualization format
  const graphViz = {
    nodes: worldState.hardState.map((e: HardState) => ({
      id: e.id,
      label: e.name,
      group: e.kind,
      subtype: e.subtype,
      prominence: e.prominence
    })),
    edges: worldState.relationships.map((r: any) => ({
      from: r.src,
      to: r.dst,
      label: r.kind
    }))
  };
  
  fs.writeFileSync('./output/graph_viz.json', JSON.stringify(graphViz, null, 2));
  console.log(`✅ Graph visualization exported to ./output/graph_viz.json`);
  
  const loreOutput = {
    llmEnabled,
    model: llmEnabled ? llmModel : 'disabled',
    records: engine.getLoreRecords()
  };
  fs.writeFileSync('./output/lore.json', JSON.stringify(loreOutput, null, 2));
  console.log(`✅ Lore output exported to ./output/lore.json (${llmEnabled ? 'enabled' : 'disabled'})`);
}

// Run the generator
generateWorld().catch(console.error);
