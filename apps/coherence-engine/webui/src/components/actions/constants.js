/**
 * Constants for ActionsEditor
 */

export const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'actor', label: 'Actor', icon: '🎭' },
  { id: 'instigator', label: 'Instigator', icon: '🧭' },
  { id: 'targeting', label: 'Targeting', icon: '🎯' },
  { id: 'variables', label: 'Variables', icon: '📦' },
  { id: 'outcome', label: 'Outcome', icon: '⚡' },
  { id: 'probability', label: 'Probability', icon: '🎲' },
];

export const DIRECTIONS = [
  { value: 'src', label: 'Source' },
  { value: 'dst', label: 'Destination' },
  { value: 'both', label: 'Both' },
];

export const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

export const RELATIONSHIP_REFS = [
  { value: '$actor', label: 'Actor' },
  { value: '$instigator', label: 'Instigator' },
  { value: '$target', label: 'Target' },
  { value: '$target2', label: 'Target 2' },
];

export const MUTATION_TYPE_META = {
  modify_pressure: { label: 'Modify Pressure', icon: '🌡️', color: '#f59e0b' },
  set_tag: { label: 'Set Tag', icon: '🏷️', color: '#10b981' },
  remove_tag: { label: 'Remove Tag', icon: '🗑️', color: '#ef4444' },
  change_status: { label: 'Change Status', icon: '🔄', color: '#3b82f6' },
  adjust_prominence: { label: 'Adjust Prominence', icon: '⭐', color: '#eab308' },
  create_relationship: { label: 'Create Relationship', icon: '🔗', color: '#8b5cf6' },
  adjust_relationship_strength: { label: 'Adjust Relationship Strength', icon: '📈', color: '#7c3aed' },
  archive_relationship: { label: 'Archive Relationship', icon: '📦', color: '#64748b' },
  archive_all_relationships: { label: 'Archive All Relationships', icon: '📦', color: '#475569' },
  update_rate_limit: { label: 'Update Rate Limit', icon: '⏱️', color: '#06b6d4' },
};

export const MUTATION_TYPE_ORDER = [
  'set_tag',
  'remove_tag',
  'create_relationship',
  'adjust_relationship_strength',
  'archive_relationship',
  'archive_all_relationships',
  'change_status',
  'adjust_prominence',
  'modify_pressure',
  'update_rate_limit',
];

export const MUTATION_TYPE_OPTIONS = MUTATION_TYPE_ORDER.map((key) => ({
  value: key,
  label: MUTATION_TYPE_META[key]?.label || key,
  icon: MUTATION_TYPE_META[key]?.icon || '⚙️',
  color: MUTATION_TYPE_META[key]?.color || '#6b7280',
}));
