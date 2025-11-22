import { HardState, Relationship, Prominence } from './worldTypes';

// Era definition
export interface Era {
  id: string;
  name: string;
  description: string;
  templateWeights: Record<string, number>;  // 0 = disabled, 2 = double chance
  systemModifiers: Record<string, number>;  // multipliers for system effects
  pressureModifiers?: Record<string, number>;
  specialRules?: (graph: Graph) => void;
}

// Graph representation
export interface Graph {
  entities: Map<string, HardState>;
  relationships: Relationship[];
  tick: number;
  currentEra: Era;
  pressures: Map<string, number>;
  history: HistoryEvent[];
}

// History tracking
export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
}

// Growth template interface
export interface GrowthTemplate {
  id: string;
  name: string;
  requiredEra?: string[];  // optional era restrictions
  
  // Check if template can be applied
  canApply: (graph: Graph) => boolean;
  
  // Find valid targets for this template
  findTargets: (graph: Graph) => HardState[];
  
  // Execute the template on a target
  expand: (graph: Graph, target?: HardState) => TemplateResult;
}

export interface TemplateResult {
  entities: Partial<HardState>[];
  relationships: Relationship[];  // Can use placeholder IDs like 'will-be-assigned-0'
  description: string;
}

// Simulation system interface
export interface SimulationSystem {
  id: string;
  name: string;
  
  // Run one tick of this system
  apply: (graph: Graph, modifier: number) => SystemResult;
}

export interface SystemResult {
  relationshipsAdded: Relationship[];
  entitiesModified: Array<{
    id: string;
    changes: Partial<HardState>;
  }>;
  pressureChanges: Record<string, number>;
  description: string;
}

// Pressure definition
export interface Pressure {
  id: string;
  name: string;
  value: number;  // 0-100
  growth: (graph: Graph) => number;  // delta per tick
  decay: number;  // natural decay per tick
}

// Engine configuration
export interface EngineConfig {
  eras: Era[];
  templates: GrowthTemplate[];
  systems: SimulationSystem[];
  pressures: Pressure[];
  
  // Configuration
  epochLength: number;  // ticks per epoch
  simulationTicksPerGrowth: number;
  targetEntitiesPerKind: number;
  maxTicks: number;
}
