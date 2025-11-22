# Relationship Formation System

## Overview
The relationship formation system manages how NPCs form social connections (friendships, rivalries, romances, enmities) based on proximity and shared attributes.

## Fixed Logic Bugs (2025-11-22)

### 1. **Double Processing Eliminated**
**Problem**: Each NPC pair was processed twice per tick (A→B when A iterates, B→A when B iterates), effectively doubling all probabilities.

**Solution**: Use index-based slicing to process each pair only once:
```typescript
npcs.forEach((npc, i) => {
  npcs.slice(i + 1).forEach(neighbor => {
    // Process pair only once
  });
});
```

### 2. **Specific Relationship Type Checking**
**Problem**: `!hasRelationship(graph, npc.id, neighbor.id)` checked for ANY relationship, not the specific type being created. This blocked romance between enemies and allowed duplicate attempts.

**Solution**: Check for specific relationship types:
```typescript
!hasRelationship(graph, npc.id, neighbor.id, 'lover_of')
```

### 3. **Cooldown System Implementation**
**Problem**: No backoff mechanism after relationship formation, causing thousands of wasted checks and warning spam once entities hit the 3-relationship limit.

**Solution**: Implemented cooldown tracking per entity per relationship type:
- Added `relationshipCooldowns: Map<string, Map<string, number>>` to Graph
- Helper functions: `canFormRelationship()` and `recordRelationshipFormation()`
- Cooldown periods configured per relationship type

## Cooldown Configuration

```typescript
const COOLDOWNS = {
  follower_of: 5,    // Can form new follower relationship every 5 ticks
  rival_of: 5,       // Can form new rivalry every 5 ticks
  enemy_of: 8,       // Can form new enmity every 8 ticks
  lover_of: 15       // Can form new romance every 15 ticks (rarest)
};
```

## How It Works

### 1. **Pair Selection**
- NPCs are grouped by location
- Each unique pair is considered once per tick
- O(N²/2) complexity per location (down from O(N²))

### 2. **Relationship Formation Checks**
For each pair, the system checks:
1. ✅ Probability roll passes (10% base for romance, modified by era)
2. ✅ No existing relationship of this specific type
3. ✅ Entity not on cooldown for this relationship type
4. ✅ Entity hasn't exceeded max relationships of this type (hard limit: 3)

### 3. **Cooldown Tracking**
When a relationship is successfully formed:
```typescript
recordRelationshipFormation(graph, entityId, relationshipType);
// Records: graph.tick → entityCooldowns[relationshipType]
```

Future attempts check:
```typescript
canFormRelationship(graph, entityId, 'lover_of', 15);
// Returns: (currentTick - lastFormationTick) >= 15
```

## Performance Improvements

### Before Fixes
- **Pair processing**: Each pair checked 2× per tick
- **Effective probability**: ~27.75% per tick (10% × 1.5 modifier × 2 checks)
- **Cumulative over 10 ticks**: ~96% chance each pair becomes lovers
- **Warnings**: 500+ lover_of limit warnings per generation
- **Result**: Every NPC had 3 lovers within ~2 ticks, then spammed warnings

### After Fixes
- **Pair processing**: Each pair checked 1× per tick
- **Effective probability**: ~15% per tick (10% × 1.5 modifier)
- **Cooldown**: Minimum 15 ticks between romance formations
- **Warnings**: ~16 lover_of warnings per generation (97% reduction)
- **Result**: Romance formation is gradual and realistic

## Relationship Distribution

Typical generation now produces balanced relationships:
```
enemy_of: 68
follower_of: 64
lover_of: 61
member_of: 44
rival_of: 44
resident_of: 33
leader_of: 18
```

## API Reference

### Helper Functions

#### `canFormRelationship(graph, entityId, relationshipType, cooldownTicks): boolean`
Checks if an entity can form a new relationship of the given type based on cooldown.

**Parameters:**
- `graph` - The world graph
- `entityId` - Entity attempting to form relationship
- `relationshipType` - Type of relationship (e.g., 'lover_of')
- `cooldownTicks` - Minimum ticks between formations

**Returns:** `true` if not on cooldown

#### `recordRelationshipFormation(graph, entityId, relationshipType): void`
Records that an entity has formed a relationship, updating cooldown tracking.

**Parameters:**
- `graph` - The world graph
- `entityId` - Entity that formed relationship
- `relationshipType` - Type of relationship formed

## Configuration

### Adjusting Cooldowns
To make relationships form more/less frequently, adjust the cooldown values in `world-gen/src/systems/simulationSystems.ts`:

```typescript
const COOLDOWNS = {
  follower_of: 5,    // Lower = more frequent
  rival_of: 5,
  enemy_of: 8,
  lover_of: 15       // Higher = more rare
};
```

### Adjusting Probabilities
Base probabilities are in the `relationshipFormation` system:
```typescript
rollProbability(0.1, modifier)  // 10% base for romance
rollProbability(0.3, modifier)  // 30% base for friendship/rivalry
rollProbability(0.4, modifier)  // 40% base for conflict
```

### Era Modifiers
Era-specific modifiers are in `world-gen/src/config/eras.ts`:
```typescript
systemModifiers: {
  'relationship_formation': 1.5  // 50% increase in The Great Thaw
}
```

## Future Enhancements

Potential improvements to the system:
1. **Mutual relationships**: Option for bidirectional relationship creation
2. **Compatibility factors**: Consider entity attributes (tags, prominence) for romance
3. **Social network effects**: Friends-of-friends are more likely to connect
4. **Relationship decay**: Old relationships can fade over time
5. **Dynamic cooldowns**: Adjust cooldowns based on entity prominence or era
