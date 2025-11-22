# LLM Integration Strategy for Procedural History Generation

## Philosophy

The LLM should **color** the world, not **structure** it. Templates and systems create the skeleton; the LLM adds the flesh. This maintains fast, deterministic generation while ensuring output feels deeply connected to your lore.

## Integration Points

### 1. Template Parameterization Layer

**When**: Before template execution  
**Purpose**: Make lore-consistent choices instead of random selection  
**Frequency**: Once per template application

```typescript
interface TemplateContext {
  template: string
  targetEntity?: HardState
  era: Era
  localContext: HardState[]  // Nearby entities
  relevantLore: LoreSection[]
}

// Example usage in faction splinter template
async function enrichedFactionSplinter(graph: Graph, faction: HardState) {
  const context = await llm.generateContext({
    template: 'faction_splinter',
    parentFaction: faction,
    era: graph.currentEra,
    lore: loreIndex.getFactionIdeologies()
  });
  
  // Returns structured guidance
  // {
  //   splinterType: 'techno-anarchist',
  //   ideology: 'neo-distributist',
  //   conflictReason: 'disagreement over alien artifact usage',
  //   leaderArchetype: 'disillusioned_scientist'
  // }
  
  // Template uses this context instead of random choices
  const splinter = createFaction({
    subtype: context.splinterType,
    description: `Broke away due to ${context.conflictReason}`
  });
}
```

### 2. Name & Description Enrichment

**When**: After structural generation, before finalization  
**Purpose**: Replace placeholder names/descriptions with lore-appropriate content  
**Frequency**: Batched per growth phase (10-15 entities)

```typescript
interface EnrichmentBatch {
  entities: Array<{
    id: string
    kind: string
    subtype: string
    placeholderName: string
    context: string[]  // Related entity names, location
  }>
}

// Two-pass generation pattern
class EnrichmentPipeline {
  async processGrowthPhase(entities: HardState[]) {
    // Pass 1: Structure (immediate)
    const structural = entities.map(e => ({
      ...e,
      name: `PLACEHOLDER_${e.kind}_${e.id}`,
      description: `PLACEHOLDER_${e.subtype}_CONTEXT`
    }));
    
    // Pass 2: Enrichment (async, batched)
    const enriched = await llm.batchEnrich({
      entities: structural,
      namingRules: loreIndex.namingConventions[era],
      techLevel: worldState.techLevel,
      culturalInfluences: getNearbyFactions(structural)
    });
    
    // Apply enrichments
    enriched.forEach(e => {
      structural.find(s => s.id === e.id).name = e.name;
      structural.find(s => s.id === e.id).description = e.description;
    });
  }
}
```

### 3. Era Transition Narratives

**When**: Between epochs  
**Purpose**: Generate historical events explaining era shifts  
**Frequency**: 5-6 times per full generation

```typescript
interface EraTransition {
  fromEra: string
  toEra: string
  causes: Pressure[]  // What pressures triggered this
  majorActors: HardState[]  // High-prominence entities
  duration: number  // Ticks in previous era
}

async function generateTransitionEvent(transition: EraTransition) {
  const narrative = await llm.createHistoricalEvent({
    prompt: `Generate a pivotal event that transforms ${transition.fromEra} into ${transition.toEra}`,
    constraints: {
      involveActors: transition.majorActors.map(a => a.name),
      reflectPressures: transition.causes,
      consistentWith: loreIndex.historicalPrecedents
    }
  });
  
  // Create special event entities
  return {
    event: createRuleEntity({
      subtype: 'natural',  // Historical turning point
      name: narrative.eventName,
      description: narrative.description
    }),
    consequences: narrative.immediateEffects.map(effect => 
      createRelationship(effect)
    )
  };
}
```

### 4. Relationship Justification

**When**: After important relationships form  
**Purpose**: Create backstory for high-stakes connections  
**Frequency**: Only for high-prominence entity pairs

```typescript
interface RelationshipContext {
  relationship: Relationship
  actor1: HardState
  actor2: HardState
  historicalContext: HistoryEvent[]
}

async function enrichHighProfileRelationship(context: RelationshipContext) {
  // Only enrich if both entities are recognized+
  if (getProminenceValue(context.actor1) < 2 || 
      getProminenceValue(context.actor2) < 2) {
    return null;
  }
  
  const backstory = await llm.generateRelationshipHistory({
    type: context.relationship.kind,
    actors: [context.actor1, context.actor2],
    recentEvents: context.historicalContext.slice(-10),
    loreConstraints: loreIndex.getRelationshipNorms(context.relationship.kind)
  });
  
  // Optionally create commemorative entity
  if (backstory.significance === 'major') {
    return createRuleEntity({
      subtype: 'social',
      name: backstory.pactName || `${actor1.name}-${actor2.name} Accord`,
      description: backstory.description
    });
  }
}
```

### 5. Technology & Magic Development

**When**: During innovation/discovery templates  
**Purpose**: Ensure tech/magic follows lore progression  
**Frequency**: Per ability creation

```typescript
interface TechProgression {
  currentTech: HardState[]  // Existing abilities
  techLevel: number
  researchFaction?: HardState
  anomalySource?: HardState
}

async function generateNewAbility(context: TechProgression) {
  const innovation = await llm.deriveNextTech({
    base: context.currentTech,
    researcher: context.researchFaction,
    inspiration: context.anomalySource,
    constraints: loreIndex.techTree,
    forbiddenTech: loreIndex.restrictedTechnologies
  });
  
  return {
    kind: 'abilities',
    subtype: innovation.type,  // 'technology' or 'magic'
    name: innovation.name,
    description: innovation.description,
    prerequisites: innovation.requiredTech  // For validation
  };
}
```

## Implementation Architecture

### Lore Index Structure

```typescript
interface LoreIndex {
  // Extracted from lore bible documents
  namingConventions: {
    [faction: string]: {
      patterns: string[]
      prefixes: string[]
      suffixes: string[]
    }
  }
  
  techTree: {
    prerequisites: Map<string, string[]>
    incompatibilities: Set<[string, string]>
    eras: Map<string, string[]>  // Tech available per era
  }
  
  historicalPrecedents: Array<{
    trigger: string
    outcome: string
    entities: string[]
  }>
  
  culturalTraits: Map<string, {
    values: string[]
    taboos: string[]
    relationships: string[]  // Preferred relationship types
  }>
  
  // Quick lookup functions
  getRelevantLore(context: any): LoreSection[]
  validateConsistency(entity: HardState): boolean
}

// Build once from lore bible
const loreIndex = await buildLoreIndex(loreBibleDocs);
```

### Async Enrichment Service

```typescript
class EnrichmentService {
  private queue: EnrichmentTask[] = [];
  private loreIndex: LoreIndex;
  private llm: LLMInterface;
  
  constructor(loreIndex: LoreIndex, llm: LLMInterface) {
    this.loreIndex = loreIndex;
    this.llm = llm;
    this.startProcessor();
  }
  
  // Non-blocking enrichment
  enqueue(task: EnrichmentTask) {
    this.queue.push(task);
  }
  
  private async startProcessor() {
    while (true) {
      if (this.queue.length > 0) {
        const batch = this.queue.splice(0, 10);  // Process in batches
        await this.processBatch(batch);
      }
      await sleep(100);
    }
  }
  
  private async processBatch(tasks: EnrichmentTask[]) {
    // Combine similar tasks for efficiency
    const namingTasks = tasks.filter(t => t.type === 'naming');
    const relationshipTasks = tasks.filter(t => t.type === 'relationship');
    
    if (namingTasks.length > 0) {
      const names = await this.llm.batchGenerateNames({
        entities: namingTasks.map(t => t.entity),
        context: this.loreIndex.namingConventions
      });
      // Apply results back to graph
    }
    
    // Process other task types...
  }
}
```

### Integration with Main Engine

```typescript
class WorldEngine {
  private enrichmentService: EnrichmentService;
  
  async runEpoch() {
    // Structural generation (fast, deterministic)
    const newEntities = this.runGrowthPhase();
    this.runSimulationPhase();
    
    // Queue enrichment (async, non-blocking)
    this.enrichmentService.enqueue({
      type: 'naming',
      entities: newEntities,
      context: this.getCurrentContext()
    });
    
    // Check for era transition
    if (this.shouldTransitionEra()) {
      const transition = await this.generateEraTransition();
      this.applyTransitionEffects(transition);
    }
  }
  
  // Called at end of generation
  async finalize() {
    // Wait for enrichment queue to empty
    await this.enrichmentService.flush();
    
    // Generate final chronicle
    const chronicle = await this.generateHistoricalChronicle();
    
    return {
      graph: this.graph,
      chronicle: chronicle
    };
  }
}
```

## Performance Considerations

### Batching Strategy

- **Names/Descriptions**: Batch 10-20 entities per LLM call
- **Relationships**: Only enrich prominence >= 'recognized'
- **Era Transitions**: Single call per transition
- **Tech Development**: Cache prerequisite chains

### Caching

```typescript
class LoreCache {
  private cache = new Map<string, any>();
  
  async getCachedOrGenerate(key: string, generator: () => Promise<any>) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    const result = await generator();
    this.cache.set(key, result);
    return result;
  }
}

// Example: Cache faction ideologies
const ideology = await loreCache.getCachedOrGenerate(
  `faction_ideology_${faction.subtype}_${era.id}`,
  () => llm.generateIdeology(faction, era)
);
```

### Selective Enrichment

```typescript
function shouldEnrich(entity: HardState): boolean {
  // Always enrich
  if (entity.prominence === 'renowned' || entity.prominence === 'mythic') {
    return true;
  }
  
  // Era-dependent enrichment
  if (currentEra.id === 'first_contact' && entity.kind === 'abilities') {
    return true;  // All tech during first contact is important
  }
  
  // Stochastic enrichment for mid-tier entities
  if (entity.prominence === 'recognized') {
    return Math.random() > 0.5;
  }
  
  return false;
}
```

## LLM Prompt Templates

### Name Generation

```typescript
const namePrompt = `
Given the following entity in a ${worldSetting} setting during the ${era.name} era:
- Type: ${entity.kind}/${entity.subtype}
- Location: ${location.name}
- Related to: ${relatedEntities.map(e => e.name).join(', ')}

Naming conventions from lore:
${loreIndex.getNamingRules(entity.kind)}

Generate an appropriate name that:
1. Follows the naming patterns for this faction/culture
2. Reflects the current technological level
3. Sounds distinct from existing names: ${existingNames}

Return only the name, no explanation.
`;
```

### Relationship Backstory

```typescript
const backstoryPrompt = `
Two prominent figures have become enemies:
- ${actor1.name}: ${actor1.description}
- ${actor2.name}: ${actor2.description}

Recent world events:
${recentHistory.map(e => `- ${e.description}`).join('\n')}

Cultural context from lore:
${loreIndex.getConflictPatterns()}

Generate a 2-3 sentence backstory for their conflict that:
1. References specific events or resources
2. Aligns with the current era (${era.name})
3. Could have systemic implications

Format: { "incident": "...", "stakes": "...", "publicPerception": "..." }
`;
```

## Validation & Consistency

### Lore Consistency Checker

```typescript
class LoreValidator {
  validateEntity(entity: HardState): ValidationResult {
    const issues = [];
    
    // Check naming conventions
    if (!this.matchesNamingPattern(entity)) {
      issues.push(`Name '${entity.name}' doesn't match ${entity.subtype} patterns`);
    }
    
    // Check tech prerequisites
    if (entity.kind === 'abilities') {
      const prereqs = this.loreIndex.techTree.prerequisites.get(entity.name);
      if (prereqs && !this.hasPrerequisites(prereqs)) {
        issues.push(`Missing prerequisites for ${entity.name}`);
      }
    }
    
    // Check cultural consistency
    if (entity.kind === 'rules') {
      const taboos = this.loreIndex.getTaboos(entity.location);
      if (this.violatesTaboos(entity, taboos)) {
        issues.push(`Rule conflicts with cultural taboos`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}
```

## Best Practices

### DO
- Cache LLM responses aggressively
- Batch similar requests
- Use structured outputs (JSON mode)
- Validate against lore index before applying
- Keep LLM calls async/non-blocking
- Focus on high-prominence entities

### DON'T
- Call LLM in tight loops
- Block generation for enrichment
- Generate critical structure via LLM
- Trust LLM output without validation
- Enrich forgotten/marginal entities
- Make synchronous LLM calls in simulation phase

## Migration Path

### Phase 1: Basic Integration (Weekend 2)
- Name/description enrichment only
- Batch processing for growth phases
- Simple caching

### Phase 2: Contextual Enhancement (Week 3)
- Era transition narratives
- High-prominence relationship backstories
- Lore index integration

### Phase 3: Full Integration (Month 2)
- Template parameterization
- Tech tree validation
- Real-time enrichment service
- Chronicle generation

## Example: Complete Integration Flow

```typescript
// 1. Load lore bible
const loreIndex = await buildLoreIndex(loreBibleDocuments);

// 2. Initialize services  
const llm = new LLMInterface(config);
const enrichmentService = new EnrichmentService(loreIndex, llm);

// 3. Configure engine with enrichment
const engine = new WorldEngine({
  ...baseConfig,
  enrichmentService,
  loreIndex
});

// 4. Run generation
const world = await engine.generateWorld();

// 5. Final enrichment pass
const enrichedWorld = await enrichmentService.finalPass(world);

// 6. Generate chronicle
const chronicle = await llm.generateChronicle({
  world: enrichedWorld,
  history: engine.getHistory(),
  style: loreIndex.narrativeStyle
});
```

This integration strategy ensures your procedurally generated world feels authentic to your lore while maintaining the speed and reliability of algorithmic generation.
