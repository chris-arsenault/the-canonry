# Narrative Event Unification Plan

## Goal
Unify the narrative event system so that:
1. All events use `participantEffects` as the canonical structure
2. Semantic interpretation (betrayal, triumph, war) comes from schema metadata, not separate events
3. Verb mappings come from schema configuration, not hardcoded in framework
4. Complex patterns (war, coalescence) are detected via post-processing enrichment

## Implementation Phases

### Phase 1: Extend EntityEffect with Semantic Annotations
- [x] Add `semanticKind` field to `EntityEffect` type
- [x] Define semantic kinds: betrayal, reconciliation, triumph, downfall, alliance, rivalry
- [x] Update `buildParticipantEffects()` to derive semanticKind from schema polarity
- [x] Add `NarrativeContext` polarity lookup functions
- [x] Add `deriveRelationshipSemanticKind()` and `deriveStatusSemanticKind()` methods

### Phase 2: Add Verb Configuration to Schema
- [x] Extend `RelationshipKindDefinition` with `verbs?: { formed: string; ended: string }`
- [x] Extend `Status` with `transitionVerb?: string`
- [x] Update `buildParticipantEffects()` to use schema verbs with framework defaults (via NarrativeContext)

### Phase 3: Create SemanticEnricher Post-Processor
- [x] Create `SemanticEnricher` class
- [x] Implement war detection (negative relationship connected components)
- [x] Implement coalescence detection (multiple part_of to same target)
- [x] Implement power vacuum detection (authority ended, check successors)
- [x] Implement succession detection (container ended with members)
- [x] Implement leadership established detection
- [x] Implement eventKind upgrade from dominant semantic effects
- [x] Integrate into `StateChangeTracker.flush()`

### Phase 4: Clean Up Legacy Code
- [x] Remove legacy fields from `NarrativeEvent` (headline, participants, object, stateChanges)
- [x] Make `participantEffects` required
- [x] Remove `NarrativeStateChange` type
- [x] Delete all legacy `buildXxxEvent()` methods from `NarrativeEventBuilder`
- [x] Remove legacy event generators from `StateChangeTracker`
- [x] Remove hardcoded verb mappings (use schema defaults) - NOTE: Verb mappings kept in NarrativeEventBuilder as framework defaults, schema verbs take priority

### Phase 5: Final Verification
- [x] Build passes
- [x] All events use unified structure
- [x] No duplicate events generated

## Files Modified

### world-schema
- `src/world.ts` - EntityEffect with semanticKind, NarrativeEvent with required participantEffects
- `src/relationship.ts` - RelationshipKindDefinition verbs
- `src/entityKind.ts` - Status transitionVerb
- `src/index.ts` - exports

### lore-weave
- `lib/narrative/narrativeEventBuilder.ts` - buildParticipantEffects only, legacy builders removed
- `lib/narrative/stateChangeTracker.ts` - uses generateContextBasedEvents + SemanticEnricher
- `lib/narrative/semanticEnricher.ts` - NEW FILE
- `lib/narrative/narrativeTagGenerator.ts` - uses inline StateChangeData type
- `lib/narrative/significanceCalculator.ts` - uses inline StateChangeData type
- `lib/engine/worldEngine.ts` - inline era transition event

## Success Criteria - COMPLETED
1. Single event per execution context ✓
2. `participantEffects` is required and always populated ✓
3. `EntityEffect.semanticKind` carries interpretation ✓
4. Complex patterns upgrade `eventKind` via enrichment ✓
5. Framework verb defaults remain, schema verbs override ✓
6. Legacy fields and methods removed ✓
7. Default project has verbs configured for all relationship kinds ✓
8. Default project has transitionVerb configured for narratively significant statuses ✓
9. Canonry UI supports editing verbs on RelationshipKindDefinition ✓
10. Canonry UI supports editing transitionVerb on Status ✓
