/**
 * Shared constants for GeneratorsEditor components
 */

// ============================================================================
// TABS
// ============================================================================

export const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'applicability', label: 'When', icon: '✓' },
  { id: 'target', label: 'Target', icon: '🎯' },
  { id: 'variables', label: 'Variables', icon: '📦' },
  { id: 'creation', label: 'Create', icon: '✨' },
  { id: 'relationships', label: 'Connect', icon: '🔗' },
  { id: 'effects', label: 'Effects', icon: '⚡' },
];

// ============================================================================
// APPLICABILITY TYPES
// ============================================================================

export const APPLICABILITY_TYPES = {
  pressure: { label: 'Pressure Range', icon: '🌡️', color: '#f59e0b', desc: 'Pressure within a range' },
  pressure_any_above: { label: 'Any Pressure Above', icon: '🌡️', color: '#f97316', desc: 'Any pressure exceeds threshold' },
  pressure_compare: { label: 'Pressure Compare', icon: '⚖️', color: '#eab308', desc: 'Compare two pressures' },
  entity_count: { label: 'Entity Count', icon: '📊', color: '#3b82f6', desc: 'Count entities by kind' },
  relationship_count: { label: 'Relationship Count', icon: '🔗', color: '#8b5cf6', desc: 'Count relationships' },
  relationship_exists: { label: 'Relationship Exists', icon: '🔍', color: '#7c3aed', desc: 'Check for relationship' },
  tag_exists: { label: 'Tag Exists', icon: '🏷️', color: '#10b981', desc: 'Entity has tag' },
  tag_absent: { label: 'Tag Absent', icon: '🚫', color: '#dc2626', desc: 'Entity lacks tag' },
  status: { label: 'Status Match', icon: '📌', color: '#0891b2', desc: 'Entity status check' },
  prominence: { label: 'Prominence', icon: '⭐', color: '#eab308', desc: 'Prominence range check' },
  time_elapsed: { label: 'Time Elapsed', icon: '⏱️', color: '#06b6d4', desc: 'Time since creation/update' },
  growth_phases_complete: { label: 'Growth Phases Complete', icon: '🌱', color: '#22c55e', desc: 'N growth phases completed in era' },
  era_match: { label: 'Era Match', icon: '🕰️', color: '#10b981', desc: 'Only runs in specific eras' },
  random_chance: { label: 'Random Chance', icon: '🎲', color: '#a855f7', desc: 'Runs with a probability' },
  cooldown_elapsed: { label: 'Cooldown', icon: '⏱️', color: '#0ea5e9', desc: 'Wait N ticks since last run' },
  creations_per_epoch: { label: 'Rate Limit', icon: '📈', color: '#f97316', desc: 'Max creations per epoch' },
  graph_path: { label: 'Graph Path', icon: '🔀', color: '#ec4899', desc: 'Path traversal condition' },
  entity_exists: { label: 'Entity Exists', icon: '👤', color: '#14b8a6', desc: 'Entity reference resolves' },
  entity_has_relationship: { label: 'Entity Has Relationship', icon: '🧷', color: '#0f766e', desc: 'Entity has relationship' },
  or: { label: 'Any Of (OR)', icon: '⚡', color: '#ec4899', desc: 'Passes if any sub-rule passes' },
  and: { label: 'All Of (AND)', icon: '🔗', color: '#14b8a6', desc: 'Passes if all sub-rule passes' },
  always: { label: 'Always', icon: '✅', color: '#22c55e', desc: 'Always passes' },
};

// ============================================================================
// PROMINENCE LEVELS
// ============================================================================

// Re-export from shared
export { PROMINENCE_LEVELS } from '../shared';

// ============================================================================
// PICK STRATEGIES
// ============================================================================

// For target selection (supports weighted)
export const PICK_STRATEGIES = [
  { value: 'random', label: 'Random', desc: 'Pick randomly from matches' },
  { value: 'first', label: 'First', desc: 'Pick the first match' },
  { value: 'all', label: 'All', desc: 'Use all matches' },
  { value: 'weighted', label: 'Weighted', desc: 'Weight by prominence' },
];

// For variable selection (supports weighted)
export const VARIABLE_PICK_STRATEGIES = [
  { value: 'random', label: 'Random', desc: 'Pick randomly from matches' },
  { value: 'first', label: 'First', desc: 'Pick the first match' },
  { value: 'all', label: 'All', desc: 'Use all matches' },
  { value: 'weighted', label: 'Weighted', desc: 'Weight by prominence' },
];

// ============================================================================
// SELECTION FILTER TYPES
// ============================================================================

export const FILTER_TYPES = {
  // Tag filters
  has_tag: { label: 'Has Tag', icon: '🏷️', color: '#10b981', desc: 'Entity has a specific tag' },
  has_tags: { label: 'Has Tags (All)', icon: '🏷️', color: '#059669', desc: 'Entity has ALL specified tags (AND)' },
  has_any_tag: { label: 'Has Any Tag', icon: '🏷️', color: '#10b981', desc: 'Entity has at least ONE of the tags (OR)' },
  lacks_tag: { label: 'Lacks Tag', icon: '🚫', color: '#dc2626', desc: 'Entity does NOT have a specific tag' },
  lacks_any_tag: { label: 'Lacks Any Tag', icon: '🚫', color: '#b91c1c', desc: 'Entity does NOT have ANY of these tags' },
  // Attribute filters
  has_culture: { label: 'Has Culture', icon: '🌍', color: '#6366f1', desc: 'Entity belongs to a specific culture' },
  matches_culture: { label: 'Matches Culture', icon: '🤝', color: '#7c3aed', desc: 'Entity has same culture as another entity' },
  has_status: { label: 'Has Status', icon: '📊', color: '#0891b2', desc: 'Entity has a specific status' },
  has_prominence: { label: 'Min Prominence', icon: '⭐', color: '#eab308', desc: 'Entity has at least this prominence level' },
  // Relationship filters
  has_relationship: { label: 'Has Relationship', icon: '🔗', color: '#8b5cf6', desc: 'Entity has a relationship of this kind' },
  lacks_relationship: { label: 'Lacks Relationship', icon: '🚫', color: '#ef4444', desc: 'Entity lacks a relationship of this kind' },
  shares_related: { label: 'Shares Related Entity', icon: '📍', color: '#3b82f6', desc: 'Both entities have same related entity via relationship' },
  // Other
  exclude: { label: 'Exclude Entities', icon: '⛔', color: '#f59e0b', desc: 'Exclude specific entity references' },
  graph_path: { label: 'Graph Path', icon: '🔀', color: '#ec4899', desc: 'Complex multi-hop graph traversal' },
};

// ============================================================================
// GRAPH PATH CONSTANTS
// ============================================================================

export const PATH_CHECK_TYPES = [
  { value: 'exists', label: 'Path Exists' },
  { value: 'not_exists', label: 'Path Does Not Exist' },
  { value: 'count_min', label: 'Count At Least' },
  { value: 'count_max', label: 'Count At Most' },
];

export const PATH_DIRECTIONS = [
  { value: 'out', label: 'Outgoing →' },
  { value: 'in', label: '← Incoming' },
  { value: 'any', label: '↔ Any' },
];

export const PATH_CONSTRAINT_TYPES = [
  { value: 'not_self', label: 'Not Self' },
  { value: 'not_in', label: 'Not In Set' },
  { value: 'in', label: 'In Set' },
  { value: 'kind_equals', label: 'Kind Equals' },
  { value: 'subtype_equals', label: 'Subtype Equals' },
  { value: 'has_relationship', label: 'Has Relationship' },
  { value: 'lacks_relationship', label: 'Lacks Relationship' },
];

// ============================================================================
// CSS HOVER STYLES (injected once)
// ============================================================================

export const HOVER_STYLES_ID = 'generators-editor-hover-styles';

export const hoverCSS = `
  .ge-tab-btn:not(.ge-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .ge-tab-btn:not(.ge-tab-btn-active) {
    background-color: transparent !important;
  }
  .ge-add-item-btn:hover {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
  }
  .ge-add-item-btn {
    border-color: rgba(59, 130, 246, 0.3) !important;
    color: #60a5fa !important;
  }
  .ge-card-option:hover {
    border-color: #f59e0b !important;
  }
`;
