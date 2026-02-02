/**
 * Constants for SystemsEditor
 */

// CSS Hover Styles
export const HOVER_STYLES_ID = 'systems-editor-hover-styles';

export const hoverCSS = `
  .se-tab-btn:not(.se-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .se-tab-btn:not(.se-tab-btn-active) {
    background-color: transparent !important;
  }
  .se-add-item-btn:hover {
    border-color: var(--color-accent, #f59e0b) !important;
    color: var(--color-accent, #f59e0b) !important;
  }
  .se-add-item-btn {
    border-color: var(--color-border, rgba(59, 130, 246, 0.3)) !important;
    color: var(--color-text-dim, #60a5fa) !important;
  }
  .se-type-option:hover {
    border-color: var(--color-accent, #f59e0b) !important;
  }
`;

// System type definitions
export const SYSTEM_TYPES = {
  eraSpawner: { label: 'Era Spawner', icon: '🕰️', color: '#fbbf24', desc: 'Creates era entities at simulation start' },
  eraTransition: { label: 'Era Transition', icon: '⏭️', color: '#fbbf24', desc: 'Handles era progression' },
  universalCatalyst: { label: 'Agent Actions', icon: '🎭', color: '#fbbf24', desc: 'Agent action system' },
  relationshipMaintenance: { label: 'Relationship Maintenance', icon: '🔧', color: '#60a5fa', desc: 'Relationship decay/reinforcement' },
  graphContagion: { label: 'Graph Contagion', icon: '🦠', color: '#f87171', desc: 'Spreads states through connections' },
  connectionEvolution: { label: 'Connection Evolution', icon: '🔗', color: '#60a5fa', desc: 'Relationship changes over time' },
  thresholdTrigger: { label: 'Threshold Trigger', icon: '⚡', color: '#4ade80', desc: 'Condition detection and actions' },
  clusterFormation: { label: 'Cluster Formation', icon: '🎯', color: '#c084fc', desc: 'Groups entities into meta-entities' },
  tagDiffusion: { label: 'Tag Diffusion', icon: '🏷️', color: '#f472b6', desc: 'Tag spreading between entities' },
  planeDiffusion: { label: 'Plane Diffusion', icon: '🌡️', color: '#38bdf8', desc: 'Value diffusion across space' },
};

// Framework systems are grouped together
export const FRAMEWORK_SYSTEM_TYPES = new Set([
  'eraSpawner',
  'eraTransition',
  'universalCatalyst',
  'relationshipMaintenance',
]);

// Category definitions for grouping systems
export const SYSTEM_CATEGORIES = {
  framework: { label: 'Framework Systems', icon: '⚙️', order: 0 },
  graphContagion: { label: 'Graph Contagion', icon: '🦠', order: 1 },
  connectionEvolution: { label: 'Connection Evolution', icon: '🔗', order: 2 },
  thresholdTrigger: { label: 'Threshold Trigger', icon: '⚡', order: 3 },
  clusterFormation: { label: 'Cluster Formation', icon: '🎯', order: 4 },
  tagDiffusion: { label: 'Tag Diffusion', icon: '🏷️', order: 5 },
  planeDiffusion: { label: 'Plane Diffusion', icon: '🌡️', order: 6 },
};

/**
 * Get the category for a system type
 * @param {string} systemType - The system type
 * @returns {string} The category name
 */
export function getSystemCategory(systemType) {
  if (FRAMEWORK_SYSTEM_TYPES.has(systemType)) {
    return 'framework';
  }
  return systemType;
}

// Cluster mode options
export const CLUSTER_MODES = [
  { value: 'individual', label: 'Individual', desc: 'Apply to each entity separately' },
  { value: 'all_matching', label: 'All Matching', desc: 'All matching entities share a cluster' },
  { value: 'by_relationship', label: 'By Relationship', desc: 'Group by relationship clusters' },
];

// Direction options
export const DIRECTIONS = [
  { value: 'src', label: 'Source' },
  { value: 'dst', label: 'Destination' },
  { value: 'both', label: 'Both' },
];

// Condition type options (unified rules)
export const CONDITION_TYPES = [
  { value: 'pressure', label: 'Pressure Range' },
  { value: 'pressure_any_above', label: 'Any Pressure Above' },
  { value: 'pressure_compare', label: 'Pressure Compare' },
  { value: 'entity_count', label: 'Entity Count' },
  { value: 'relationship_count', label: 'Relationship Count' },
  { value: 'relationship_exists', label: 'Relationship Exists' },
  { value: 'tag_exists', label: 'Tag Exists' },
  { value: 'tag_absent', label: 'Tag Absent' },
  { value: 'status', label: 'Status' },
  { value: 'prominence', label: 'Prominence' },
  { value: 'time_elapsed', label: 'Time Elapsed' },
  { value: 'cooldown_elapsed', label: 'Cooldown Elapsed' },
  { value: 'creations_per_epoch', label: 'Creations Per Epoch' },
  { value: 'graph_path', label: 'Graph Path' },
  { value: 'entity_exists', label: 'Entity Exists' },
  { value: 'entity_has_relationship', label: 'Entity Has Relationship' },
  { value: 'random_chance', label: 'Random Chance' },
  { value: 'era_match', label: 'Era Match' },
  { value: 'and', label: 'All Of (AND)' },
  { value: 'or', label: 'Any Of (OR)' },
  { value: 'always', label: 'Always' },
];

// Action type options (unified rules)
export const ACTION_TYPES = [
  { value: 'set_tag', label: 'Set Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'change_status', label: 'Change Status' },
  { value: 'adjust_prominence', label: 'Adjust Prominence' },
  { value: 'modify_pressure', label: 'Modify Pressure' },
  { value: 'create_relationship', label: 'Create Relationship' },
  { value: 'adjust_relationship_strength', label: 'Adjust Relationship Strength' },
  { value: 'archive_relationship', label: 'Archive Relationship' },
];

// Metric type options (must match connectionEvolution.ts MetricType)
export const METRIC_TYPES = [
  { value: 'connection_count', label: 'Connection Count', desc: 'Total relationships involving entity' },
  { value: 'relationship_count', label: 'Relationship Count', desc: 'Count of specific relationship kind(s)' },
  { value: 'shared_relationship', label: 'Shared Relationship', desc: 'Count entities sharing a specific relationship' },
  { value: 'neighbor_prominence', label: 'Neighbor Prominence', desc: 'Average prominence of connected entities' },
];

// Clustering criteria type options
export const CLUSTERING_CRITERIA_TYPES = [
  { value: 'shared_relationship', label: 'Shared Relationship' },
  { value: 'same_culture', label: 'Same Culture' },
  { value: 'shared_tags', label: 'Shared Tags' },
  { value: 'temporal_proximity', label: 'Temporal Proximity' },
];
