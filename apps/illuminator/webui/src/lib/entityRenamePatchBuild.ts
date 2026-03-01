/**
 * Entity Rename - Patch building
 *
 * Constructs concrete patches from scan results and user decisions.
 * Uses grammar-aware replacement adjustment for natural text updates.
 */

import { adjustReplacementForGrammar } from "./entityRenameGrammar";
import type {
  ChronicleMetadataUpdates,
  ChroniclePatchFields,
  EntityPatch,
  FieldReplacement,
  MatchDecision,
  RenameMatch,
  RenamePatches,
  RenameScanResult,
  SerializedPatchFields,
} from "./entityRenameTypes";

/**
 * Apply a set of replacements to a text string. Replacements must not overlap
 * and are applied in reverse order to preserve positions.
 */
export function applyReplacements(text: string, replacements: FieldReplacement[]): string {
  const sorted = [...replacements].sort((a, b) => b.position - a.position);
  let result = text;
  for (const r of sorted) {
    result = result.slice(0, r.position) + r.replacement + result.slice(r.position + r.originalLength);
  }
  return result;
}

function processChronicleMetadataMatch(
  meta: ChronicleMetadataUpdates, field: string, replacementText: string
): void {
  if (field.startsWith("roleAssignments[")) {
    const idxMatch = field.match(/\[(\d+)\]/);
    if (!idxMatch) return;
    meta.roleAssignmentUpdates = meta.roleAssignmentUpdates || [];
    meta.roleAssignmentUpdates.push({ index: parseInt(idxMatch[1], 10), entityName: replacementText });
  } else if (field === "lens.entityName") {
    meta.lensNameUpdate = replacementText;
  } else if (field.startsWith("generationContext.entityDirectives[")) {
    const idxMatch = field.match(/\[(\d+)\]/);
    if (!idxMatch) return;
    meta.directiveUpdates = meta.directiveUpdates || [];
    meta.directiveUpdates.push({ index: parseInt(idxMatch[1], 10), entityName: replacementText });
  }
}

function computeReplacement(match: RenameMatch, decision: MatchDecision, newName: string): FieldReplacement {
  const replacementText = decision.action === "edit" ? (decision.editText ?? newName) : newName;
  if (decision.action === "edit") {
    return { position: match.position, originalLength: match.matchedText.length, replacement: replacementText };
  }
  const adjusted = adjustReplacementForGrammar(
    match.contextBefore, match.contextAfter, match.position, match.matchedText, replacementText
  );
  return adjusted;
}

function appendSerializedReplacement(
  patchMap: Map<string, SerializedPatchFields>,
  sourceId: string, field: string, replacement: FieldReplacement
): void {
  const existing = patchMap.get(sourceId) || {};
  const rKey = `__replacements_${field}`;
  const list: FieldReplacement[] = existing[rKey] ? JSON.parse(existing[rKey]) as FieldReplacement[] : [];
  list.push(replacement);
  existing[rKey] = JSON.stringify(list);
  patchMap.set(sourceId, existing);
}

function appendChronicleReplacement(
  patchMap: Map<string, ChroniclePatchFields>,
  sourceId: string, field: string, replacement: FieldReplacement
): void {
  const existing = patchMap.get(sourceId) || {};
  const rKey = `__replacements_${field}`;
  const list = (existing[rKey] as FieldReplacement[] | undefined) || [];
  list.push(replacement);
  existing[rKey] = list;
  patchMap.set(sourceId, existing);
}

function processMetadataMatch(
  match: RenameMatch, replacementText: string,
  chronicleMetaUpdates: Map<string, ChronicleMetadataUpdates>,
  eventMetaUpdates: Map<string, Record<string, string>>
): void {
  if (match.sourceType === "event") {
    const meta = eventMetaUpdates.get(match.sourceId) || {};
    meta[match.field] = replacementText;
    eventMetaUpdates.set(match.sourceId, meta);
  } else {
    const meta = chronicleMetaUpdates.get(match.sourceId) || {};
    processChronicleMetadataMatch(meta, match.field, replacementText);
    chronicleMetaUpdates.set(match.sourceId, meta);
  }
}

function processTextMatch(
  match: RenameMatch, decision: MatchDecision, newName: string,
  entityPatchMap: Map<string, SerializedPatchFields>,
  chroniclePatchMap: Map<string, ChroniclePatchFields>,
  eventPatchMap: Map<string, SerializedPatchFields>
): void {
  const replacement = computeReplacement(match, decision, newName);
  if (match.sourceType === "entity") {
    appendSerializedReplacement(entityPatchMap, match.sourceId, match.field, replacement);
  } else if (match.sourceType === "chronicle") {
    appendChronicleReplacement(chroniclePatchMap, match.sourceId, match.field, replacement);
  } else if (match.sourceType === "event") {
    appendSerializedReplacement(eventPatchMap, match.sourceId, match.field, replacement);
  }
}

function mergeChronicleMetadata(
  chroniclePatchMap: Map<string, ChroniclePatchFields>,
  chronicleMetaUpdates: Map<string, ChronicleMetadataUpdates>
): void {
  for (const [chronicleId, meta] of chronicleMetaUpdates) {
    const existing = chroniclePatchMap.get(chronicleId) || {};
    if (meta.roleAssignmentUpdates) existing.roleAssignmentUpdates = meta.roleAssignmentUpdates;
    if (meta.lensNameUpdate) existing.lensNameUpdate = meta.lensNameUpdate;
    if (meta.directiveUpdates) existing.directiveUpdates = meta.directiveUpdates;
    chroniclePatchMap.set(chronicleId, existing);
  }
}

export function buildRenamePatches(
  scanResult: RenameScanResult, newName: string, decisions: MatchDecision[]
): RenamePatches {
  const decisionMap = new Map(decisions.map((d) => [d.matchId, d]));
  const entityPatchMap = new Map<string, SerializedPatchFields>();
  const chroniclePatchMap = new Map<string, ChroniclePatchFields>();
  const eventPatchMap = new Map<string, SerializedPatchFields>();
  const chronicleMetaUpdates = new Map<string, ChronicleMetadataUpdates>();
  const eventMetaUpdates = new Map<string, Record<string, string>>();

  for (const match of scanResult.matches) {
    const decision = decisionMap.get(match.id);
    if (!decision || decision.action === "reject") continue;
    const replacementText = decision.action === "edit" ? (decision.editText ?? newName) : newName;
    if (match.matchType === "metadata") {
      processMetadataMatch(match, replacementText, chronicleMetaUpdates, eventMetaUpdates);
    } else {
      processTextMatch(match, decision, newName, entityPatchMap, chroniclePatchMap, eventPatchMap);
    }
  }

  mergeChronicleMetadata(chroniclePatchMap, chronicleMetaUpdates);
  for (const [eventId, meta] of eventMetaUpdates) {
    const existing = eventPatchMap.get(eventId) || {};
    Object.assign(existing, meta);
    eventPatchMap.set(eventId, existing);
  }

  return {
    entityPatches: [...entityPatchMap].map(([entityId, changes]) => ({ entityId, changes })),
    chroniclePatches: [...chroniclePatchMap].map(([chronicleId, fieldUpdates]) => ({
      chronicleId, fieldUpdates: fieldUpdates as Record<string, unknown>,
    })),
    eventPatches: [...eventPatchMap].map(([eventId, changes]) => ({ eventId, changes })),
  };
}
