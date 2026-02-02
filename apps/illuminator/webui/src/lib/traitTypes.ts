/**
 * Trait Type Definitions
 *
 * Extracted from traitRegistry.ts — pure type declarations for visual trait
 * palettes, usage tracking, and trait guidance structures.
 */

export interface PaletteItem {
  id: string;
  category: string;
  description: string;
  examples: string[];
  timesUsed: number;
  addedAt: number;
  /** Subtypes this category applies to - REQUIRED, must have 1+ values */
  subtypes?: string[];
  /** Era this category is specific to (undefined = not era-specific) */
  era?: string;
}

export interface TraitPalette {
  id: string;                   // `${projectId}_${entityKind}`
  projectId: string;
  entityKind: string;
  items: PaletteItem[];
  updatedAt: number;
}

export interface UsedTraitRecord {
  id: string;                   // `${projectId}_${simulationRunId}_${entityKind}_${entityId}`
  projectId: string;
  simulationRunId: string;
  entityKind: string;
  entityId: string;
  entityName: string;
  traits: string[];
  registeredAt: number;
}

export interface TraitGuidance {
  /** 1-2 categories positively assigned for this entity to focus on */
  assignedCategories: PaletteItem[];
  /** Category usage counts for transparency (debugging/UI) */
  categoryUsage: Record<string, number>;
  /** Selection method used */
  selectionMethod: 'weighted-random' | 'llm-selected' | 'fallback';
}
