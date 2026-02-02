/**
 * Utils Index
 *
 * Re-exports utility functions.
 */

// Tag utilities
export {
  mergeTags,
  hasTag,
  getTagValue,
  getTrueTagKeys,
  getStringTags,
  arrayToTags
} from './tagUtils';

// Random utilities
export {
  shuffle,
  pickRandom,
  pickMultiple,
  weightedRandom,
  rollProbability
} from './randomUtils';

// ID generation (from core/)
export {
  generateId,
  generateLoreId
} from '../core/idGeneration';

// Entity queries (from graph/)
export {
  findEntities,
  getRelated,
  hasRelationship,
  getConnectionWeight
} from '../graph/entityQueries';
export type { RelationshipQueryOptions } from '../graph/entityQueries';

// Entity mutation (from graph/)
export {
  slugifyName,
  generateEntityIdFromName,
  normalizeInitialState,
  addEntity,
  updateEntity
} from '../graph/entityMutation';

// Relationship mutation (from graph/)
export {
  addRelationship,
  archiveRelationship,
  modifyRelationshipStrength,
  canFormRelationship,
  recordRelationshipFormation
} from '../graph/relationshipMutation';

// Array/JSON utilities
export {
  parseJsonSafe,
  chunk
} from './arrayUtils';
