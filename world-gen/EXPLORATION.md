# Exploration System - Dynamic Location Discovery

## Overview

The Exploration System solves the problem of location generation by treating new locations as "discoveries" rather than random spawns. Locations are revealed through exploration driven by pressure, necessity, and narrative chains, maintaining geographic coherence while avoiding the need to pre-define all locations.

## Core Concept: The Frontier

Rather than generating locations randomly, the world contains a "frontier" - potential locations that exist in a quantum state until discovered by explorers. This creates:
- **Controlled growth** (max 2-3 locations per epoch)
- **Purposeful discovery** (driven by colony needs)
- **Narrative chains** (discoveries lead to more discoveries)
- **Geographic coherence** (new locations connect logically to existing ones)

## System Specification

### Frontier Exploration System

**System Type**: Hybrid (runs as both system and template)

**Entities Touched**:
- NPCs (heroes, outlaws, merchants become explorers)
- Locations (creates geographic_features, anomalies, future colony sites)
- Abilities (discoveries can unlock new tech/magic)

**Relationships Created**:
- `explorer_of` (NPC → discovered location)
- `adjacent_to` (new location ↔ 1-2 existing locations)
- `contains` (parent region → new sublocation)
- `hidden_path_to` (secret connections between non-adjacent locations)
- `discovered_by` (location → NPC, for historical record)

### Mathematical Foundation

**Exploration Potential Field**:
```
P(discovery at x) = mystery(x) * exp(-λ * dist(x, nearest_colony)) * explorer_skill * pressure_modifier
```

Where:
- `mystery(x)` = pre-seeded "interestingness" value (0.0-1.0)
- `λ` = distance decay factor (typically 0.3)
- `dist(x, nearest_colony)` = graph distance to civilization
- `explorer_skill` = based on NPC prominence and traits
- `pressure_modifier` = multiplier from current pressures

**Discovery Threshold**:
```
if P(discovery) > threshold:
    reveal_location()
    threshold *= 1.1  // Increase difficulty for next discovery
```

## Implementation Architecture

### Hidden Location Pool

```typescript
interface HiddenLocation {
  id: string;
  type: LocationSubtype;
  name: string;  // Generated when discovered
  description: string;  // Generated when discovered
  
  // Discovery requirements
  requirements: {
    minDistance: number;      // Min distance from colonies
    maxDistance: number;      // Max distance (can't be too far)
    minExplorerProminence: Prominence;
    triggerPressures?: Array<{
      pressure: string;
      minValue: number;
    }>;
    prerequisiteDiscovery?: string;  // Must discover X first
    eraRestriction?: string[];       // Only discoverable in certain eras
  };
  
  // What this leads to
  chainDiscoveries: string[];  // Other hidden locations this unlocks
  enablesTemplates: string[];   // Templates this enables (e.g., colony_founding)
}
```

### Discovery Table

```typescript
const discoveryTable = {
  // Pressure-driven discoveries
  pressureDiscoveries: {
    resource_scarcity: [
      { type: 'geographic_feature', theme: 'krill_breeding_ground', weight: 2 },
      { type: 'geographic_feature', theme: 'underground_springs', weight: 1 },
      { type: 'geographic_feature', theme: 'deep_fishing_canyon', weight: 1 }
    ],
    magical_instability: [
      { type: 'anomaly', theme: 'ancient_ice_temple', weight: 1 },
      { type: 'anomaly', theme: 'aurora_convergence_point', weight: 2 },
      { type: 'geographic_feature', theme: 'frozen_artifact_field', weight: 1 }
    ],
    conflict: [
      { type: 'geographic_feature', theme: 'hidden_pass', weight: 2 },
      { type: 'geographic_feature', theme: 'defensible_peak', weight: 1 },
      { type: 'geographic_feature', theme: 'natural_ice_bridge', weight: 1 }
    ],
    cultural_tension: [
      { type: 'geographic_feature', theme: 'isolated_valley', weight: 2 },
      { type: 'anomaly', theme: 'meditation_caves', weight: 1 }
    ]
  },
  
  // Chain discoveries (discovering A reveals B exists)
  discoveryChains: {
    'ice_cave_entrance': ['deep_ice_caverns', 'underground_lake'],
    'ancient_ruins': ['artifact_chamber', 'old_colony_remains'],
    'whale_graveyard': ['bone_valley', 'deep_ocean_trench'],
    'surface_cracks': ['under_ice_passages', 'warm_water_pockets'],
    'aurora_point': ['magnetic_anomaly', 'sky_bridge_formation']
  },
  
  // Era-specific discoveries
  eraDiscoveries: {
    'expansion': ['fertile_valleys', 'natural_harbors'],
    'conflict': ['strategic_heights', 'hidden_refuges'],
    'innovation': ['resource_deposits', 'experimental_sites'],
    'invasion': ['defensive_positions', 'escape_routes'],
    'reconstruction': ['memorial_sites', 'reunion_grounds']
  }
};
```

## Discovery Triggers

### 1. Pressure-Driven Discovery
When specific pressures exceed thresholds, exploration becomes targeted:

```typescript
function checkPressureDiscovery(pressures: Map<string, number>) {
  for (const [pressure, value] of pressures) {
    if (value > 60) {  // High pressure
      const discoveries = discoveryTable.pressureDiscoveries[pressure];
      if (discoveries) {
        return selectWeightedRandom(discoveries);
      }
    }
  }
}
```

### 2. Explorer-Driven Discovery
Heroes and outlaws randomly explore based on traits:

```typescript
function checkExplorerDiscovery(npc: HardState) {
  const explorationChance = {
    'hero': 0.3,
    'outlaw': 0.2,
    'merchant': 0.1,
    'mayor': 0.05
  };
  
  const base = explorationChance[npc.subtype] || 0;
  const prominenceBonus = getProminenceValue(npc.prominence) * 0.05;
  
  return Math.random() < (base + prominenceBonus);
}
```

### 3. Chain Discovery
Each discovery can unlock others:

```typescript
function processChainDiscovery(discoveredLocation: HiddenLocation) {
  const chains = discoveryTable.discoveryChains[discoveredLocation.theme];
  if (chains) {
    // Add to potential discoveries with higher priority
    chains.forEach(chain => {
      hiddenLocationPool.get(chain).requirements.priority += 10;
    });
  }
}
```

## Location Generation Constraints

### Geographic Coherence
1. **Distance Limits**: New locations must be 1-3 hops from existing locations
2. **Connection Limits**: Each new location connects to 1-2 existing locations (rarely 3)
3. **Regional Clustering**: Discoveries tend to form geographic "regions"

### Population Control
1. **Discovery Rate**: Max 2-3 locations per epoch
2. **Total Cap**: World supports maximum 35-40 locations
3. **Reuse Mechanism**: Abandoned colonies become "ruins" available for rediscovery
4. **Consolidation**: Some discoveries are "sub-locations" within existing locations

### Discovery Difficulty Scaling
```typescript
const difficultyScaling = {
  baseThreshold: 0.3,
  thresholdGrowth: 1.1,  // Gets 10% harder each discovery
  distancePenalty: 0.2,   // Per hop from nearest colony
  eraModifiers: {
    'expansion': 0.8,     // Easier to discover
    'conflict': 1.2,      // Harder (focused on war)
    'innovation': 0.9,    // Slightly easier
    'invasion': 1.3,      // Much harder
    'reconstruction': 1.0  // Normal
  }
};
```

## Integration with Existing Systems

### Template Integration
Discoveries enable other templates:
- **Geographic features** → Enable `colony_founding`
- **Resource sites** → Enable `tech_innovation`
- **Anomalies** → Enable `magic_discovery`, `cult_formation`
- **Strategic locations** → Enable `fortification_building`

### System Integration
- **Resource Flow**: New resource locations affect scarcity calculations
- **Cultural Drift**: Isolated discoveries increase cultural divergence
- **Conflict Contagion**: Strategic discoveries may trigger conflicts
- **Thermal Cascade**: Climate affects which locations can be discovered

## Discovery Types Catalog

### Resource Locations
- **Krill Breeding Grounds**: Massive resource boost, attracts merchants
- **Underground Springs**: Fresh water source, enables larger population
- **Deep Fishing Canyon**: Dangerous but rich fishing spot
- **Kelp Forests**: Sustainable resource, enables new tech

### Strategic Locations
- **Hidden Pass**: Connects non-adjacent regions, military value
- **Defensible Peak**: Natural fortress location
- **Ice Bridge**: Temporary connection, may collapse
- **Observation Point**: See far distances, early warning

### Mystical Locations
- **Ancient Temple**: Pre-collapse structure, magical knowledge
- **Aurora Convergence**: Magic amplification point
- **Singing Caves**: Sound-based phenomena, possible communication
- **Time-Locked Ice**: Preserved ancient artifacts

### Natural Wonders
- **Floating Gardens**: Ice formations with unique ecosystem
- **Whale Graveyard**: Bones and mystery, possible resources
- **Mirror Lake**: Perfectly still underground water
- **Crystal Caverns**: Light-conducting ice formations

## Example Discovery Progression

```
Epoch 1: 
- Start with 6 core locations
- Hero explores due to expansion era → Discovers "Northern Shelf"

Epoch 2:
- Northern Shelf enables colony_founding
- Resource pressure high → "Deep Current Trench" discovered
- Deep Current chains to → "Krill Breeding Ground" (marked for next epoch)

Epoch 3:
- Krill Breeding Ground discovered (chained from previous)
- Conflict pressure → "Hidden Pass" discovered between colonies
- This creates new strategic dynamics

Epoch 4:
- Magical anomaly appears → "Singing Caves" discovered
- Singing Caves chains to → "Chamber of First Song", "Echo Valley"
- One marked for discovery, one remains hidden

Epoch 5:
- Previous discoveries enable 2 new colonies
- Total locations: 14 (manageable but rich)
```

## Configuration Parameters

```typescript
const explorationConfig = {
  // Discovery rates
  maxDiscoveriesPerEpoch: 3,
  minTicksBetweenDiscoveries: 5,
  
  // Pool sizes
  initialHiddenLocations: 20,
  maxTotalLocations: 40,
  
  // Difficulty
  baseDiscoveryThreshold: 0.3,
  thresholdGrowthRate: 1.1,
  distanceDecayFactor: 0.3,
  
  // Chain discovery
  maxChainLength: 3,
  chainRevealDelay: 5,  // Ticks before chain location becomes discoverable
  
  // Exploration bonuses
  heroExplorationBonus: 1.5,
  outlawExplorationBonus: 1.2,
  anomalyProximityBonus: 1.3
};
```

## Expected Behaviors

With this system:

1. **Natural Expansion**: Colonies grow outward in waves as explorers reveal the frontier
2. **Pressure Response**: High resource pressure leads to resource discoveries
3. **Quest Narratives**: Discovery chains create multi-epoch exploration stories
4. **Strategic Depth**: Hidden passes and defensive positions emerge during conflicts
5. **Mystical Mystery**: Anomalies lead to deeper anomalies, creating mystery layers
6. **Geographic Realism**: Locations cluster into logical regions
7. **Historical Depth**: Famous explorers remembered for their discoveries
8. **Dynamic Pacing**: Discovery rate varies with era and colony needs

This system ensures the world grows organically through the actions of its inhabitants, rather than through random generation or complete pre-definition.
