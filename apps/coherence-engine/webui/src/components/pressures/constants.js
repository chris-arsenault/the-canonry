/**
 * Constants for PressuresEditor
 */

// Factor type configuration with visual styling
export const FACTOR_TYPES = {
  entity_count: {
    label: 'Entity Count',
    description: 'Count entities matching criteria',
    icon: '👥',
    color: '#3b82f6',
    fields: ['kind', 'subtype', 'status', 'coefficient', 'cap'],
  },
  relationship_count: {
    label: 'Relationship Count',
    description: 'Count relationships of specified types',
    icon: '🔗',
    color: '#8b5cf6',
    fields: ['relationshipKinds', 'coefficient', 'cap'],
  },
  tag_count: {
    label: 'Tag Count',
    description: 'Count entities with specific tags',
    icon: '🏷️',
    color: '#10b981',
    fields: ['tags', 'coefficient'],
  },
  ratio: {
    label: 'Ratio',
    description: 'Ratio between two counts',
    icon: '📊',
    color: '#f59e0b',
    fields: ['numerator', 'denominator', 'coefficient', 'fallbackValue', 'cap'],
  },
  status_ratio: {
    label: 'Status Ratio',
    description: 'Ratio of entities with specific status',
    icon: '💫',
    color: '#ec4899',
    fields: ['kind', 'subtype', 'aliveStatus', 'coefficient'],
  },
  cross_culture_ratio: {
    label: 'Cross-Culture Ratio',
    description: 'Ratio of cross-cultural relationships',
    icon: '🌍',
    color: '#14b8a6',
    fields: ['relationshipKinds', 'coefficient'],
  },
};
