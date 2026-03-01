/**
 * Chronicle Repository — barrel re-export.
 *
 * All chronicle database operations are split across sub-modules for
 * maintainability. This file re-exports every public symbol so that
 * existing import paths remain unchanged.
 */

import { generatePrefixedId } from "./generatePrefixedId";
import type { ChronicleRoleAssignment, ChronicleFocusType } from "../chronicleTypes";

// ============================================================================
// Re-exports from sub-modules
// ============================================================================

export {
  createChronicleShell,
  createChronicle,
  updateChronicleAssembly,
  regenerateChronicleAssembly,
  updateChronicleEdit,
  updateChronicleFailure,
  updateChronicleCohesion,
  startChronicleValidation,
} from "./chronicleWriteOps";

export {
  updateChronicleComparisonReport,
  updateChronicleTemporalCheckReport,
  updateChronicleQuickCheckReport,
  updateChronicleFactCoverage,
  updateChronicleSummary,
  updateChronicleTitle,
  acceptPendingTitle,
  rejectPendingTitle,
  updateChronicleHistorianPrep,
  updateChronicleTertiaryCast,
  updateChronicleHistorianNotes,
  updateChronicleImageRefs,
  updateChronicleImageRef,
  applyImageRefSelections,
  updateChronicleCoverImage,
  updateChronicleCoverImageStatus,
  updateChronicleTemporalContext,
  refreshEraSummariesInChronicles,
  updateChronicleCombineInstructions,
} from "./chronicleRefinementOps";

export {
  acceptChronicle,
  unpublishChronicle,
  updateChronicleActiveVersion,
  deleteChronicleVersion,
  updateChronicleEntityBackportStatus,
  reconcileBackportStatusFromEntities,
  resetAllBackportFlags,
  batchUpdateChronicleEraYears,
  updateChronicleToneRanking,
  updateChronicleAssignedTone,
  repairFactCoverageWasFaceted,
  computeCorpusFactStrength,
  computeAnnotationReinforcementCounts,
  getEntityUsageStats,
  getNarrativeStyleUsageStats,
} from "./chronicleLifecycleOps";

export type { ReinforcementCounts } from "./chronicleLifecycleOps";

export {
  getChronicle,
  getChroniclesForSimulation,
  deleteChronicle,
  deleteChroniclesForSimulation,
  putChronicle,
} from "./chronicleQueryOps";

// ============================================================================
// Re-exported types (from chronicleTypes)
// ============================================================================

export type {
  ChronicleRecord,
  ChronicleGenerationVersion,
  ChronicleShellMetadata,
  ChronicleMetadata,
  EntityUsageStats,
  NarrativeStyleUsageStats,
  VersionStep,
} from "../chronicleTypes";

// ============================================================================
// Pure functions (no DB access)
// ============================================================================

/**
 * Generate a unique chronicle ID
 */
export function generateChronicleId(): string {
  return generatePrefixedId("chronicle");
}

/**
 * Derive a title from role assignments
 */
export function deriveTitleFromRoles(roleAssignments: ChronicleRoleAssignment[]): string {
  const primary = roleAssignments.filter((r) => r.isPrimary);
  if (primary.length === 0) {
    const first = roleAssignments[0];
    return first ? `Chronicle of ${first.entityName}` : "Untitled Chronicle";
  }
  if (primary.length === 1) {
    return `Chronicle of ${primary[0].entityName}`;
  }
  if (primary.length === 2) {
    return `${primary[0].entityName} and ${primary[1].entityName}`;
  }
  return `${primary[0].entityName} and ${primary.length - 1} others`;
}

/**
 * Determine focus type from role assignments
 */
export function deriveFocusType(roleAssignments: ChronicleRoleAssignment[]): ChronicleFocusType {
  const primaryCount = roleAssignments.filter((r) => r.isPrimary).length;
  if (primaryCount <= 1) return "single";
  return "ensemble";
}
