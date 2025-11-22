# New Mechanics for Penguin World Generation

## Systems with Algorithmic Foundation

### 1. Thermal Cascade System

**Entities Touched**:
- Locations (all subtypes)
- NPCs (status changes)
- Abilities (ice magic)

**Relationships Affected**:
- `adjacent_to` (for heat propagation)
- `resident_of` (for forced migrations)
- `manifests_at` (for revealed abilities)

**Lore Description**:
The great iceberg's thermal dynamics create cascading effects throughout Aurora Berg. Warm ocean currents cause sections to calve and shift, forcing entire colonies to migrate. Ancient artifacts and magical phenomena frozen in deep ice for centuries suddenly emerge as the ice melts and refreezes in new patterns.

**System Description**:
Propagates temperature changes through the adjacency graph of locations. When temperature thresholds are crossed, triggers colony status changes (thriving→waning), NPC migrations (resident_of relationships shift), and ability discoveries (new magic/tech emerges from melted ice layers).

**Mathematical Foundation**:
Heat diffusion equation applied to graph:
```
∂T/∂t = α∇²T
```
Where:
- T is temperature at each location node
- α is thermal diffusivity (how fast heat spreads)
- ∇² is the graph Laplacian (sum of differences with neighbors)

Implementation: Temperature at node i evolves as:
```
T_i(t+1) = T_i(t) + α * Σ_neighbors(T_j(t) - T_i(t)) / degree(i)
```

Creates natural clustering of "warm" vs "cold" regions that drive migration and discovery patterns.

### 2. Belief Contagion System

**Entities Touched**:
- NPCs (tag modifications, trait evolution)
- Factions (prominence changes)
- Rules (status transitions: proposed→enacted)

**Relationships Affected**:
- `follower_of` (transmission vector)
- `member_of` (transmission vector)
- `adherent_of` (immunity)
- `opposer_of` (resistance)

**Lore Description**:
Ideas spread through penguin society like diseases - radical beliefs infect the young, conservative traditions immunize the old, creating ideological epidemics. A single charismatic penguin preaching revolution can topple ancient traditions, while established orthodoxy acts as antibodies against change.

**System Description**:
Models belief adoption using contact networks, with NPCs transitioning between states for various ideologies. Each belief/rule in "proposed" status is treated as a contagion. NPCs connected to "infected" carriers may adopt the belief based on transmission probability.

**Mathematical Foundation**:
SIR (Susceptible-Infected-Recovered) epidemic model:
```
dS/dt = -βSI
dI/dt = βSI - γI  
dR/dt = γI
```
Where:
- S = susceptible (can adopt belief)
- I = infected (actively spreading belief)
- R = recovered (immune/rejected belief)
- β = transmission rate (modified by relationship strength)
- γ = recovery rate (modified by NPC traits like "traditional" vs "radical")

Discrete implementation:
```
P(infection) = β * num_infected_neighbors * (1 - resistance_trait)
P(recovery) = γ * (1 + tradition_trait)
```

## Templates with Algorithmic Foundation

### 3. Kinship Constellation Template

**Entities Touched**:
- NPCs (creates 5-8 family members)
- Locations (creates family igloos)

**Relationships Created**:
- `mentor_of` (parent-child)
- `rival_of` (sibling rivalry)
- `lover_of` (marriages)
- `resident_of` (family homes)

**Lore Description**:
Extended penguin families form complex constellations of loyalty and rivalry. Cousin-rivalries simmer for generations, while ancestor-veneration creates multi-generational sagas. No family is without its black sheep, its golden child, its bitter feud.

**System Description**:
Generates family structures that maximize dramatic potential by ensuring each family has internal conflicts and external alliances. Assigns contrasting traits to related individuals to create natural tension points.

**Mathematical Foundation**:
Graph coloring with Ising model energy states:
```
E = -J * Σ_edges(s_i * s_j) - h * Σ_nodes(s_i)
```
Where:
- s_i = trait/allegiance of family member i (+1 or -1)
- J = coupling strength (negative for family = opposites attract)
- h = external field (faction influences)

Algorithm:
1. Generate family tree structure (random with constraints)
2. Assign traits to minimize energy (adjacent members likely different)
3. Use Metropolis algorithm for probabilistic assignment:
   ```
   P(accept) = min(1, exp(-ΔE/T))
   ```
   Where T is "temperature" controlling randomness

Ensures families have internal diversity and conflict potential.

### 4. Krill Bloom Migration Template

**Entities Touched**:
- Locations (creates new geographic_features)
- NPCs (merchants follow blooms)
- Abilities (new fishing technology)

**Relationships Created**:
- `adjacent_to` (new paths between locations)
- `explorer_of` (NPCs discovering blooms)
- `discoverer_of` (new tech from abundant resources)

**Lore Description**:
Massive krill blooms appear in seemingly random patterns, their bioluminescent clouds visible from the surface. These events draw colonies to establish temporary outposts, brave merchants to forge new trade routes, and innovators to develop new harvesting techniques.

**System Description**:
Places new resource nodes and connecting paths based on "fertile" regions maximally distant from existing settlements, creating natural expansion frontiers and gold rush dynamics.

**Mathematical Foundation**:
Voronoi tessellation on location graph:
```
V_i = {x ∈ Graph : d(x, colony_i) < d(x, colony_j) ∀j ≠ i}
```
Where:
- V_i = Voronoi cell for colony i
- d(x,y) = graph distance (shortest path)

Algorithm:
1. Calculate Voronoi cells for existing colonies
2. Place new resources at cell boundaries (equidistant from multiple colonies)
3. Connect with new `adjacent_to` edges following Delaunay dual
4. Resources appear at points maximizing:
   ```
   score(x) = min_i(d(x, colony_i)) * resource_potential(x)
   ```

Creates natural expansion waves toward frontiers.

## Systems without Mathematical Foundation

### 5. Legend Crystallization System

**Entities Touched**:
- NPCs (prominence→mythic, status alive→fictional)
- Rules (creates new social/natural rules)
- Locations (renames based on heroes)

**Relationships Affected**:
- Creates new "commemorates" relationship type
- Transfers `leader_of` to memorial rules

**Lore Description**:
Dead heroes gradually transform into legends, their deeds becoming natural laws. "Never fish where Tide-Splitter fell" becomes sacred tradition. Mountains are renamed for ancient heroes. Their flaws are forgotten, their triumphs magnified, until they become more myth than penguin.

**System Description**:
Deceased high-prominence NPCs gradually transform into cultural artifacts. After death_age > threshold, their names become location names, their deeds become rules, their status shifts to "fictional" as they transcend history into mythology.

**Mathematical Foundation**: None - purely threshold-based triggers

### 6. Succession Vacuum System

**Entities Touched**:
- Factions (status changes to "waning")
- NPCs (new mayors/heroes emerge)
- Rules (old edicts become "repealed")

**Relationships Affected**:
- `leader_of` (broken and contested)
- `rival_of` (multiple claimants)
- `enemy_of` (succession wars)

**Lore Description**:
When leaders die without clear heirs, power vacuums create chaos. Multiple claimants emerge from the shadows, each with their own vision. Old alliances crumble, ancient rules are questioned, and colonies teeter on the edge of civil war until a new order emerges.

**System Description**:
Detects leaderless factions/colonies (leader dead, no clear successor). Triggers cascade: 2-3 NPCs gain rival_of relationships as claimants, faction may split, rules may be repealed, stability pressure drops dramatically.

**Mathematical Foundation**: None - rule-based cascade system

## Templates without Mathematical Foundation

### 7. Mysterious Vanishing Template

**Entities Touched**:
- NPCs (status→missing)
- Locations (creates anomaly)
- Factions (prominence changes)

**Relationships Modified**:
- Removes most relationships
- Adds new "last_seen_at" relationship type
- Creates "searching_for" relationships

**Lore Description**:
Sometimes penguins simply vanish into the ice. Perhaps taken by the depths, perhaps transcended to another realm, perhaps exploring beyond the edge of the world. They leave behind only questions, grief, and sometimes a strange glow in the ice where they disappeared.

**System Description**:
Removes high-prominence NPCs from active play while preserving their legend. Creates mystery anomalies at disappearance sites. Other NPCs may gain "searching_for" relationships. After time, vanished NPCs might return changed (new traits/abilities).

**Mathematical Foundation**: None - weighted random selection based on anomaly proximity

### 8. Great Festival Template

**Entities Touched**:
- Rules (creates social rules)
- Locations (marks colony as festival site)
- Factions (all types participate)

**Relationships Created**:
- `allied_with` (temporary truces)
- "celebrated_by" (new relationship type)
- `originated_in` (festival location)

**Lore Description**:
Colonies establish festivals to mark great events - the First Catch Festival, the Fissure Light Dance, the Day of Frozen Tears. These celebrations bring together former enemies in temporary truce, create new traditions, and remind all penguins of their shared heritage beneath the aurora.

**System Description**:
Creates social rules that generate temporary alliance relationships and reduce conflict pressure. Triggered by era transitions or major events (first mythic NPC, major victory, etc.). Festivals become recurring, creating cyclical pressure relief.

**Mathematical Foundation**: None - event-triggered template

## Integration Strategy

### Algorithmic Systems Priority
The four algorithmic mechanics should be implemented first as they create emergent patterns:
- **Thermal Cascade** drives geography-based narratives
- **Belief Contagion** ensures realistic ideological spread
- **Kinship Constellation** guarantees family drama
- **Krill Bloom** creates expansion dynamics

### Narrative Systems Secondary
The non-mathematical systems add depth once the world is populated:
- **Legend Crystallization** preserves important history
- **Succession Vacuum** adds political intrigue
- **Mysterious Vanishing** creates mysteries
- **Great Festival** provides pressure release

### Implementation Notes

1. **Thermal Cascade**: Run every 5 ticks, use α=0.1 for slow propagation
2. **Belief Contagion**: Check each proposed rule every tick, β=0.1, γ=0.05
3. **Kinship Constellation**: Limit to 2-3 families per epoch to avoid exponential growth
4. **Krill Bloom**: Trigger when resource_scarcity > 60 or randomly (5% per epoch)
5. **Legend Crystallization**: Check NPCs with death_age > 50 ticks
6. **Succession Vacuum**: Immediate trigger on leader death
7. **Mysterious Vanishing**: 10% chance per epoch for recognized+ NPCs near anomalies
8. **Great Festival**: Trigger on era transitions or when conflict pressure > 80

### Tuning Parameters

```typescript
const mechanicsConfig = {
  thermalCascade: {
    enabled: true,
    alpha: 0.1,           // Heat diffusion rate
    threshold: 0.3,       // Temperature change to trigger events
    frequency: 5          // Run every N ticks
  },
  
  beliefContagion: {
    enabled: true,
    beta: 0.1,           // Transmission rate
    gamma: 0.05,         // Recovery rate
    resistanceWeight: 0.3 // How much traits affect resistance
  },
  
  kinshipConstellation: {
    enabled: true,
    familySize: [5, 8],  // Min/max members
    temperature: 1.0,     // Ising model temperature
    maxPerEpoch: 3       // Prevent population explosion
  },
  
  krillBloom: {
    enabled: true,
    scarcityTrigger: 60,  // Pressure threshold
    randomChance: 0.05,   // Per epoch
    bloomSize: [2, 4]     // Resource nodes created
  }
};
```

## Expected Emergent Behaviors

With these mechanics integrated:

1. **Geographic Clustering**: Thermal dynamics create stable "warm" and "cold" regions, leading to cultural differentiation
2. **Ideological Waves**: Beliefs spread in observable patterns, creating eras of revolution and tradition
3. **Dynasty Cycles**: Families rise to power, fragment through internal rivalry, reunite through external threats
4. **Frontier Dynamics**: Resource blooms create "gold rush" expansion followed by consolidation
5. **Mythological Layer**: Important figures transcend death, becoming part of the world's permanent culture
6. **Political Cycles**: Regular succession crises prevent static power structures
7. **Mystery Threads**: Vanished characters create ongoing narrative questions
8. **Cultural Rhythm**: Festivals create cyclical peaceful periods, preventing total war

These patterns emerge without scripting, creating a living world that feels both dynamic and coherent.