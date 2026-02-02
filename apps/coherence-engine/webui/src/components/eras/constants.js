/**
 * Constants for ErasEditor components
 */

// Re-export shared strength levels
export { STRENGTH_LEVELS } from '../shared';

// Transition condition types (unified rules)
export const CONDITION_TYPES = [
  { value: 'growth_phases_complete', label: 'Growth Phases Complete', description: 'Transition after N growth phases' },
  { value: 'time_elapsed', label: 'Time Elapsed', description: 'Transition after minimum ticks' },
  { value: 'pressure', label: 'Pressure Range', description: 'Based on pressure levels' },
  { value: 'entity_count', label: 'Entity Count', description: 'Based on entity population' },
  { value: 'relationship_count', label: 'Relationship Count', description: 'Based on relationships' },
  { value: 'relationship_exists', label: 'Relationship Exists', description: 'Based on a relationship' },
  { value: 'tag_exists', label: 'Tag Exists', description: 'Based on tags' },
  { value: 'tag_absent', label: 'Tag Absent', description: 'Based on missing tags' },
  { value: 'status', label: 'Status', description: 'Based on entity status' },
  { value: 'prominence', label: 'Prominence', description: 'Based on prominence' },
  { value: 'random_chance', label: 'Random Chance', description: 'Probabilistic transition' },
  { value: 'and', label: 'All Of (AND)', description: 'All sub-rules must pass' },
  { value: 'or', label: 'Any Of (OR)', description: 'Any sub-rule may pass' },
  { value: 'always', label: 'Always', description: 'Always pass' },
];

// Operators for threshold conditions
export const OPERATORS = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];
