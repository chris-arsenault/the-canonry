/**
 * createNewRule - Factory for creating new applicability rules
 */

/**
 * Creates a new applicability rule with default values based on type
 * @param {string} type - The rule type
 * @param {Array} pressures - Available pressure definitions
 * @returns {Object} A new rule object with default values
 */
export function createNewRule(type, pressures) {
  // Create rules with empty required fields - validation will flag them
  // No domain-specific defaults - user must explicitly select values
  const newRule = { type };
  const firstPressure = (pressures || [])[0]?.id || '';

  switch (type) {
    case 'pressure':
      return { ...newRule, pressureId: firstPressure, min: 0, max: 100 };
    case 'pressure_any_above':
      return { ...newRule, pressureIds: firstPressure ? [firstPressure] : [], threshold: 50 };
    case 'pressure_compare':
      return { ...newRule, pressureA: firstPressure, pressureB: firstPressure, operator: '>' };
    case 'entity_count':
      return { ...newRule, kind: '', min: 0 };
    case 'relationship_count':
      return { ...newRule, relationshipKind: '', direction: 'both', min: 0 };
    case 'relationship_exists':
      return { ...newRule, relationshipKind: '', direction: 'both' };
    case 'tag_exists':
      return { ...newRule, tag: '' };
    case 'tag_absent':
      return { ...newRule, tag: '' };
    case 'status':
      return { ...newRule, status: '' };
    case 'prominence':
      return { ...newRule, min: 'recognized' };
    case 'time_elapsed':
      return { ...newRule, minTicks: 10, since: 'updated' };
    case 'growth_phases_complete':
      return { ...newRule, minPhases: 2 };
    case 'era_match':
      return { ...newRule, eras: [] };
    case 'random_chance':
      return { ...newRule, chance: 0.5 };
    case 'cooldown_elapsed':
      return { ...newRule, cooldownTicks: 10 };
    case 'creations_per_epoch':
      return { ...newRule, maxPerEpoch: 1 };
    case 'graph_path':
      return { ...newRule, assert: { check: 'exists', path: [] } };
    case 'entity_exists':
      return { ...newRule, entity: '$target' };
    case 'entity_has_relationship':
      return { ...newRule, entity: '$target', relationshipKind: '', direction: 'both' };
    case 'or':
    case 'and':
      return { ...newRule, conditions: [] };
    case 'always':
    default:
      return newRule;
  }
}

export default createNewRule;
