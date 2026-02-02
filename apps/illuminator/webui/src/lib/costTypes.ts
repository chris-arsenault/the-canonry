/**
 * Cost Type Definitions
 *
 * Extracted from costStorage.ts — pure type declarations for cost tracking
 * records, summaries, and related structures.
 */

export type CostType =
  | 'description'
  | 'image'
  | 'imagePrompt'      // Claude call to format image prompt
  | 'chronicleValidation'
  | 'chronicleRevision'
  | 'chronicleSummary'
  | 'chronicleImageRefs'
  | 'chronicleCoverImageScene'
  | 'chronicleV2'          // Single-shot V2 pipeline generation
  | 'chroniclePerspective' // Perspective synthesis for chronicle
  | 'paletteExpansion'     // Trait palette expansion/deduplication
  | 'dynamicsGeneration'  // World dynamics synthesis turn
  | 'summaryRevision'    // Batch summary/description revision
  | 'chronicleLoreBackport' // Chronicle lore backport to cast entities
  | 'historianReview';      // Historian scholarly annotations

export interface CostRecord {
  id: string;
  timestamp: number;

  // Context for slicing
  projectId: string;
  simulationRunId?: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  chronicleId?: string;

  // What was generated
  type: CostType;
  model: string;

  // Costs
  estimatedCost: number;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
}

export type CostRecordInput = Omit<CostRecord, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: number;
};

export interface CostSummary {
  totalEstimated: number;
  totalActual: number;
  count: number;
  byType: Record<CostType, { estimated: number; actual: number; count: number }>;
  byModel: Record<string, { estimated: number; actual: number; count: number }>;
}
