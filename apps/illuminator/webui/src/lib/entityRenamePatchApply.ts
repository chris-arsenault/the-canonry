/**
 * Entity Rename - Patch application
 *
 * Applies computed patches to entities, chronicles, and narrative events.
 * Handles both structured metadata fields and free-text replacements.
 */

import type { ChronicleRecord } from "./db/chronicleRepository";
import { applyReplacements } from "./entityRenamePatchBuild";
import type {
  ChroniclePatch,
  ChroniclePatchFields,
  DirectiveUpdate,
  EntityPatch,
  EventPatch,
  FieldReplacement,
  MutableNarrativeEvent,
  NarrativeEffect,
  ParticipantEffect,
  RoleAssignmentUpdate,
  ScanEntity,
  ScanEntityTextField,
  ScanNarrativeEvent,
} from "./entityRenameTypes";

// ---------------------------------------------------------------------------
// Entity patch application
// ---------------------------------------------------------------------------

function ensureSlugAlias<T extends ScanEntity>(entity: T, updated: T): void {
  const existingAliases = entity.enrichment?.slugAliases || [];
  if (existingAliases.includes(entity.id)) return;
  if (!updated.enrichment) {
    updated.enrichment = { ...(entity.enrichment || {}) };
  }
  updated.enrichment.slugAliases = [...existingAliases, entity.id];
}

function isEntityTextField(field: string): field is ScanEntityTextField {
  return field === "summary" || field === "description" || field === "narrativeHint";
}

function applyDescriptionHistoryPatch<T extends ScanEntity>(
  entity: T, updated: T, field: string, replacements: FieldReplacement[]
): void {
  const idxMatch = field.match(/\[(\d+)\]/);
  if (!idxMatch || !entity.enrichment?.descriptionHistory) return;
  const idx = parseInt(idxMatch[1], 10);
  if (!updated.enrichment || updated.enrichment === entity.enrichment) {
    updated.enrichment = { ...entity.enrichment };
  }
  if (!updated.enrichment.descriptionHistory || updated.enrichment.descriptionHistory === entity.enrichment.descriptionHistory) {
    updated.enrichment.descriptionHistory = [...entity.enrichment.descriptionHistory];
  }
  const entry = updated.enrichment.descriptionHistory[idx];
  if (!entry) return;
  updated.enrichment.descriptionHistory[idx] = {
    ...entry, description: applyReplacements(entry.description, replacements),
  };
}

function applyEntityTextReplacements<T extends ScanEntity>(entity: T, updated: T, patch: EntityPatch): void {
  for (const [key, value] of Object.entries(patch.changes)) {
    if (!key.startsWith("__replacements_")) continue;
    const field = key.replace("__replacements_", "");
    const replacements = JSON.parse(value) as FieldReplacement[];
    if (isEntityTextField(field)) {
      const originalText = entity[field];
      if (typeof originalText === "string") {
        updated[field] = applyReplacements(originalText, replacements);
      }
    } else if (field.startsWith("enrichment.descriptionHistory[")) {
      applyDescriptionHistoryPatch(entity, updated, field, replacements);
    }
  }
}

export function applyEntityPatches<T extends ScanEntity>(
  entities: T[], patches: EntityPatch[], targetEntityId: string | null, newName: string
): T[] {
  const patchMap = new Map(patches.map((p) => [p.entityId, p]));
  return entities.map((entity) => {
    const isTarget = entity.id === targetEntityId;
    const patch = patchMap.get(entity.id);
    if (!patch && !isTarget) return entity;
    const updated = { ...entity };
    if (isTarget) {
      updated.name = newName;
      ensureSlugAlias(entity, updated);
    }
    if (patch) applyEntityTextReplacements(entity, updated, patch);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Chronicle patch application
// ---------------------------------------------------------------------------

function asChroniclePatchFields(fieldUpdates: Record<string, unknown>): ChroniclePatchFields {
  return fieldUpdates as ChroniclePatchFields;
}

function applyRoleAssignmentUpdates(updated: ChronicleRecord, chronicle: ChronicleRecord, updates: RoleAssignmentUpdate[]): void {
  updated.roleAssignments = [...chronicle.roleAssignments];
  for (const u of updates) {
    if (updated.roleAssignments[u.index]) {
      updated.roleAssignments[u.index] = { ...updated.roleAssignments[u.index], entityName: u.entityName };
    }
  }
}

function applyLensNameUpdate(updated: ChronicleRecord, chronicle: ChronicleRecord, lensName: string): void {
  if (!chronicle.lens) return;
  updated.lens = { ...chronicle.lens, entityName: lensName };
}

function applyDirectiveUpdates(updated: ChronicleRecord, chronicle: ChronicleRecord, updates: DirectiveUpdate[]): void {
  if (!chronicle.generationContext?.entityDirectives) return;
  updated.generationContext = {
    ...chronicle.generationContext,
    entityDirectives: [...chronicle.generationContext.entityDirectives],
  };
  for (const u of updates) {
    if (updated.generationContext.entityDirectives[u.index]) {
      updated.generationContext.entityDirectives[u.index] = {
        ...updated.generationContext.entityDirectives[u.index], entityName: u.entityName,
      };
    }
  }
}

function applyChronicleMetadataPatches(updated: ChronicleRecord, chronicle: ChronicleRecord, fields: ChroniclePatchFields): void {
  if (fields.roleAssignmentUpdates) applyRoleAssignmentUpdates(updated, chronicle, fields.roleAssignmentUpdates);
  if (fields.lensNameUpdate) applyLensNameUpdate(updated, chronicle, fields.lensNameUpdate);
  if (fields.directiveUpdates) applyDirectiveUpdates(updated, chronicle, fields.directiveUpdates);
}

function applyGenerationHistoryReplacement(updated: ChronicleRecord, field: string, replacements: FieldReplacement[]): void {
  if (!updated.generationHistory) return;
  const versionId = field.replace("generationHistory.", "");
  updated.generationHistory = updated.generationHistory.map((v) =>
    v.versionId === versionId ? { ...v, content: applyReplacements(v.content, replacements) } : v
  );
}

function applyChronicleTextFieldReplacements(updated: ChronicleRecord, fieldUpdates: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fieldUpdates)) {
    if (!key.startsWith("__replacements_")) continue;
    const field = key.replace("__replacements_", "");
    const replacements = value as FieldReplacement[];
    if (field.startsWith("generationHistory.")) {
      applyGenerationHistoryReplacement(updated, field, replacements);
    } else if (field === "assembledContent" && typeof updated.assembledContent === "string") {
      updated.assembledContent = applyReplacements(updated.assembledContent, replacements);
    } else if (field === "finalContent" && typeof updated.finalContent === "string") {
      updated.finalContent = applyReplacements(updated.finalContent, replacements);
    } else if (field === "summary" && typeof updated.summary === "string") {
      updated.summary = applyReplacements(updated.summary, replacements);
    }
  }
}

export async function applyChroniclePatches(
  patches: ChroniclePatch[],
  getChronicle: (id: string) => Promise<ChronicleRecord | undefined>,
  putChronicle: (record: ChronicleRecord) => Promise<void>
): Promise<number> {
  let successCount = 0;
  for (const patch of patches) {
    try {
      const chronicle = await getChronicle(patch.chronicleId);
      if (!chronicle) {
        console.warn(`[EntityRename] Chronicle not found: ${patch.chronicleId}`);
        continue;
      }
      const updated = { ...chronicle };
      const fields = asChroniclePatchFields(patch.fieldUpdates);
      applyChronicleMetadataPatches(updated, chronicle, fields);
      applyChronicleTextFieldReplacements(updated, patch.fieldUpdates);
      updated.updatedAt = Date.now();
      await putChronicle(updated);
      successCount++;
    } catch (err) {
      console.error(`[EntityRename] Failed to update chronicle ${patch.chronicleId}:`, err);
    }
  }
  return successCount;
}

// ---------------------------------------------------------------------------
// Narrative event patch application
// ---------------------------------------------------------------------------

function ensureMutablePE(updated: MutableNarrativeEvent, original: ScanNarrativeEvent): void {
  if (updated.participantEffects === original.participantEffects) {
    updated.participantEffects = [...original.participantEffects];
  }
}

function applyEffectDescriptionReplacement(
  updated: MutableNarrativeEvent, original: ScanNarrativeEvent,
  pi: number, ei: number, replacements: FieldReplacement[]
): void {
  ensureMutablePE(updated, original);
  if (!updated.participantEffects[pi]) return;
  const pe = { ...updated.participantEffects[pi] };
  if (pe.effects === original.participantEffects[pi].effects) {
    pe.effects = [...original.participantEffects[pi].effects];
  }
  if (!pe.effects[ei]) return;
  pe.effects[ei] = { ...pe.effects[ei], description: applyReplacements(pe.effects[ei].description, replacements) };
  updated.participantEffects[pi] = pe;
}

function applyEventTextReplacement(
  updated: MutableNarrativeEvent, original: ScanNarrativeEvent,
  field: string, replacements: FieldReplacement[]
): void {
  if (field === "description") {
    updated.description = applyReplacements(updated.description, replacements);
  } else if (field === "action") {
    updated.action = applyReplacements(updated.action, replacements);
  } else if (field.startsWith("participantEffects[")) {
    const idxMatch = field.match(/participantEffects\[(\d+)\]\.effects\[(\d+)\]\.description/);
    if (!idxMatch) return;
    applyEffectDescriptionReplacement(updated, original, parseInt(idxMatch[1], 10), parseInt(idxMatch[2], 10), replacements);
  }
}

function applyEventEntityNameUpdate(
  updated: MutableNarrativeEvent, original: ScanNarrativeEvent, key: string, value: string
): void {
  const entityNameMatch = key.match(/^participantEffects\[(\d+)\]\.entity\.name$/);
  if (entityNameMatch) {
    ensureMutablePE(updated, original);
    const pi = parseInt(entityNameMatch[1], 10);
    if (!updated.participantEffects[pi]) return;
    updated.participantEffects[pi] = {
      ...updated.participantEffects[pi], entity: { ...updated.participantEffects[pi].entity, name: value },
    };
    return;
  }
  const relatedMatch = key.match(/^participantEffects\[(\d+)\]\.effects\[(\d+)\]\.relatedEntity\.name$/);
  if (!relatedMatch) return;
  ensureMutablePE(updated, original);
  const pi = parseInt(relatedMatch[1], 10);
  const ei = parseInt(relatedMatch[2], 10);
  if (!updated.participantEffects[pi]) return;
  const pe = { ...updated.participantEffects[pi] };
  if (pe.effects === original.participantEffects[pi]?.effects) {
    pe.effects = [...original.participantEffects[pi].effects];
  }
  if (!pe.effects[ei]?.relatedEntity) return;
  pe.effects[ei] = { ...pe.effects[ei], relatedEntity: { ...pe.effects[ei].relatedEntity!, name: value } };
  updated.participantEffects[pi] = pe;
}

function applyEventPatchEntry(
  updated: MutableNarrativeEvent, original: ScanNarrativeEvent, key: string, value: string
): void {
  if (key.startsWith("__replacements_")) {
    const field = key.replace("__replacements_", "");
    applyEventTextReplacement(updated, original, field, JSON.parse(value) as FieldReplacement[]);
  } else if (key === "subject.name") {
    updated.subject = { ...original.subject, name: value };
  } else if (key.startsWith("participantEffects[")) {
    applyEventEntityNameUpdate(updated, original, key, value);
  }
}

export function applyNarrativeEventPatches<T extends ScanNarrativeEvent>(events: T[], patches: EventPatch[]): T[] {
  if (patches.length === 0) return events;
  const patchMap = new Map(patches.map((p) => [p.eventId, p]));
  return events.map((event) => {
    const patch = patchMap.get(event.id);
    if (!patch) return event;
    const updated: T & MutableNarrativeEvent = { ...event };
    for (const [key, value] of Object.entries(patch.changes)) {
      applyEventPatchEntry(updated, event, key, value);
    }
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Brute-force narrative history patch
// ---------------------------------------------------------------------------

function replaceAllCaseInsensitive(text: string, oldName: string, newName: string): string {
  if (!text || !oldName) return text;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), newName);
}

function eventReferencesEntity(event: ScanNarrativeEvent, entityId: string, oldNameLower: string): boolean {
  if (event.subject.id === entityId) return true;
  if (event.participantEffects.some((pe) => pe.entity.id === entityId)) return true;
  if (event.description.toLowerCase().includes(oldNameLower)) return true;
  if (event.action.toLowerCase().includes(oldNameLower)) return true;
  return event.participantEffects.some((pe) => pe.effects.some((eff) => eff.relatedEntity?.id === entityId));
}

function bruteForcePatchEffect(
  eff: NarrativeEffect, entityId: string, oldName: string, newName: string
): { updated: NarrativeEffect; changed: boolean } {
  let result = eff;
  let changed = false;
  if (result.relatedEntity?.id === entityId && result.relatedEntity.name !== newName) {
    result = { ...result, relatedEntity: { ...result.relatedEntity, name: newName } };
    changed = true;
  }
  const patchedDesc = replaceAllCaseInsensitive(result.description, oldName, newName);
  if (patchedDesc !== result.description) {
    result = { ...(changed ? result : eff), description: patchedDesc };
    changed = true;
  }
  return { updated: result, changed };
}

function bruteForcePatchParticipant(
  pe: ParticipantEffect, entityId: string, oldName: string, newName: string
): { updated: ParticipantEffect; changed: boolean } {
  let result: ParticipantEffect = pe;
  let changed = false;
  if (pe.entity.id === entityId && pe.entity.name !== newName) {
    result = { ...pe, entity: { ...pe.entity, name: newName } };
    changed = true;
  }
  const newEffects = [...(changed ? result : pe).effects];
  let effectsChanged = false;
  for (let ei = 0; ei < newEffects.length; ei++) {
    const { updated: patchedEff, changed: effChanged } = bruteForcePatchEffect(newEffects[ei], entityId, oldName, newName);
    if (effChanged) { newEffects[ei] = patchedEff; effectsChanged = true; }
  }
  if (effectsChanged) { result = { ...(changed ? result : pe), effects: newEffects }; changed = true; }
  return { updated: result, changed };
}

function bruteForcePatchParticipantEffects(
  effects: ParticipantEffect[], entityId: string, oldName: string, newName: string
): { updated: ParticipantEffect[]; changed: boolean } {
  const newPE = [...effects];
  let changed = false;
  for (let pi = 0; pi < newPE.length; pi++) {
    const { updated, changed: peChanged } = bruteForcePatchParticipant(newPE[pi], entityId, oldName, newName);
    if (peChanged) { newPE[pi] = updated; changed = true; }
  }
  return { updated: newPE, changed };
}

export function patchNarrativeHistory<T extends ScanNarrativeEvent>(
  events: T[], entityId: string, oldName: string, newName: string
): { events: T[]; patchCount: number } {
  let patchCount = 0;
  const oldNameLower = oldName.toLowerCase();
  const patched = events.map((event) => {
    if (!eventReferencesEntity(event, entityId, oldNameLower)) return event;
    let didChange = false;
    const updated: T & MutableNarrativeEvent = { ...event };
    if (event.subject.id === entityId && event.subject.name !== newName) {
      updated.subject = { ...event.subject, name: newName };
      didChange = true;
    }
    const { updated: newPE, changed: peChanged } = bruteForcePatchParticipantEffects(event.participantEffects, entityId, oldName, newName);
    if (peChanged) { updated.participantEffects = newPE; didChange = true; }
    const patchedDesc = replaceAllCaseInsensitive(updated.description, oldName, newName);
    if (patchedDesc !== updated.description) { updated.description = patchedDesc; didChange = true; }
    const patchedAction = replaceAllCaseInsensitive(updated.action, oldName, newName);
    if (patchedAction !== updated.action) { updated.action = patchedAction; didChange = true; }
    if (didChange) { patchCount++; return updated; }
    return event;
  });
  return { events: patched, patchCount };
}
