/**
 * Entity Rename - Barrel module
 *
 * Re-exports all public types and functions from the entity rename subsystem.
 * Consumers should import from this module for backward compatibility.
 */

// Types
export type {
  MatchTier,
  MatchSourceType,
  RenameMatch,
  MatchDecision,
  RenameScanResult,
  EntityPatch,
  ChroniclePatch,
  EventPatch,
  RenamePatches,
  FieldReplacement,
  AdjustedReplacement,
  ScanEntityEnrichment,
  ScanEntity,
  ScanNarrativeEvent,
  ScanRelationship,
} from "./entityRenameTypes";

// Scanning
export { scanForReferences } from "./entityRenameScan";

// Grammar
export { adjustReplacementForGrammar } from "./entityRenameGrammar";

// Patch building
export { applyReplacements, buildRenamePatches } from "./entityRenamePatchBuild";

// Patch application
export {
  applyEntityPatches,
  applyChroniclePatches,
  applyNarrativeEventPatches,
  patchNarrativeHistory,
} from "./entityRenamePatchApply";
