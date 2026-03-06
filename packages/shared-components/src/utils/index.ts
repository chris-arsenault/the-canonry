/**
 * Utility exports from shared-components
 */

export {
  computeUsageMap,
  getElementValidation,
  getUsageSummary,
  computeTagUsage,
  getEntityKindUsageSummary,
  getRelationshipKindUsageSummary,
  computeSchemaUsage,
} from './schemaUsageMap';

export type {
  UsageMap,
  ElementUsage,
  ElementValidationResult,
  InvalidRef,
  Orphan,
  CompatibilityIssue,
  ValidationResults,
  ComputeTagUsageParams,
  ComputeSchemaUsageParams,
  SchemaUsage,
} from './schemaUsageMap';
