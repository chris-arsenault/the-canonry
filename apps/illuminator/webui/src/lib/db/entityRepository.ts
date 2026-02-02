/**
 * Entity Repository — typed CRUD + named mutations for entity data.
 *
 * All Dexie access for entities goes through this module.
 * UI and zustand call these functions only — never talk to Dexie directly.
 */

import type { WorldEntity } from '@canonry/world-schema';
import { db, type PersistedEntity } from './illuminatorDb';
import type { EntityPatch } from '../entityRename';
import { applyReplacements, type FieldReplacement } from '../entityRename';
import type { EntityEnrichment } from '../enrichmentTypes';
import { resolveAnchorPhrase, extractWordsAroundIndex } from '../fuzzyAnchor';

// ---------------------------------------------------------------------------
// Seed (Phase 1 bridge — replaced by Lore Weave write in future)
// ---------------------------------------------------------------------------

/**
 * Check whether entities have already been seeded for this simulation run.
 */
export async function isSeeded(simulationRunId: string): Promise<boolean> {
  const count = await db.entities
    .where('simulationRunId')
    .equals(simulationRunId)
    .count();
  return count > 0;
}

/**
 * Bulk-write entities from worldData.hardState into Dexie.
 * Stamps each record with simulationRunId. Skips if already seeded.
 */
export async function seedEntities(
  simulationRunId: string,
  entities: WorldEntity[],
): Promise<void> {
  const records: PersistedEntity[] = entities.map((e) => ({
    ...e,
    simulationRunId,
  }));
  await db.entities.bulkPut(records);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getEntity(entityId: string): Promise<PersistedEntity | undefined> {
  return db.entities.get(entityId);
}

export async function getEntitiesForRun(simulationRunId: string): Promise<PersistedEntity[]> {
  return db.entities.where('simulationRunId').equals(simulationRunId).toArray();
}

export async function getEntitiesByKind(
  simulationRunId: string,
  kind: string,
): Promise<PersistedEntity[]> {
  return db.entities
    .where('[simulationRunId+kind]')
    .equals([simulationRunId, kind])
    .toArray();
}

// ---------------------------------------------------------------------------
// Single-field updates
// ---------------------------------------------------------------------------

export async function updateEntityField(
  entityId: string,
  field: string,
  value: unknown,
): Promise<void> {
  await db.entities.update(entityId, { [field]: value });
}

export async function updateEntityFields(
  entityId: string,
  fields: Partial<PersistedEntity>,
): Promise<void> {
  await db.entities.update(entityId, fields);
}

// ---------------------------------------------------------------------------
// Named mutations — Rename
// ---------------------------------------------------------------------------

/**
 * Apply a rename operation using the patch manifest from buildRenamePatches.
 *
 * Single Dexie transaction:
 *   1. Target entity: update name, add slugAlias
 *   2. Each patched entity: read, apply text replacements, write
 *
 * Returns IDs of all updated entities (for cache invalidation + host notification).
 */
export async function applyRename(
  targetEntityId: string | null,
  newName: string,
  entityPatches: EntityPatch[],
  simulationRunId: string,
): Promise<string[]> {
  const updatedIds: string[] = [];

  await db.transaction('rw', db.entities, async () => {
    // 1. Target entity: update name + slugAlias
    if (targetEntityId) {
      const target = await db.entities.get(targetEntityId);
      if (target) {
        const existingAliases = target.enrichment?.slugAliases || [];
        const slugAliases = existingAliases.includes(targetEntityId)
          ? existingAliases
          : [...existingAliases, targetEntityId];

        await db.entities.update(targetEntityId, {
          name: newName,
          enrichment: {
            ...target.enrichment,
            slugAliases,
          },
        });
        updatedIds.push(targetEntityId);
      }
    }

    // 2. Apply text patches to affected entities
    for (const patch of entityPatches) {
      // Target entity name is already handled above; skip if only __replacements_ for it
      const entity = await db.entities.get(patch.entityId);
      if (!entity) continue;

      let changed = false;
      const updates: Partial<PersistedEntity> = {};

      for (const [key, value] of Object.entries(patch.changes)) {
        if (!key.startsWith('__replacements_')) continue;
        const field = key.replace('__replacements_', '');
        const replacements: FieldReplacement[] = JSON.parse(value);

        if (field === 'summary' && typeof entity.summary === 'string') {
          updates.summary = applyReplacements(entity.summary, replacements);
          changed = true;
        } else if (field === 'description' && typeof entity.description === 'string') {
          updates.description = applyReplacements(entity.description, replacements);
          changed = true;
        } else if (field === 'narrativeHint' && typeof entity.narrativeHint === 'string') {
          updates.narrativeHint = applyReplacements(entity.narrativeHint, replacements);
          changed = true;
        } else if (field.startsWith('enrichment.descriptionHistory[')) {
          const idxMatch = field.match(/\[(\d+)\]/);
          if (idxMatch && entity.enrichment?.descriptionHistory) {
            const idx = parseInt(idxMatch[1], 10);
            const history = [...entity.enrichment.descriptionHistory];
            const entry = history[idx];
            if (entry) {
              history[idx] = {
                ...entry,
                description: applyReplacements(entry.description, replacements),
              };
              updates.enrichment = { ...entity.enrichment, descriptionHistory: history };
              changed = true;
            }
          }
        }
      }

      if (changed) {
        await db.entities.update(patch.entityId, updates);
        if (!updatedIds.includes(patch.entityId)) {
          updatedIds.push(patch.entityId);
        }
      }
    }
  });

  return updatedIds;
}

// ---------------------------------------------------------------------------
// Worker enrichment results
// ---------------------------------------------------------------------------

/**
 * Apply a description enrichment result from the worker.
 * Pushes current description to history if overwriting, merges enrichment.text.
 */
export async function applyDescriptionResult(
  entityId: string,
  enrichment: Partial<EntityEnrichment>,
  summary?: string | null,
  description?: string,
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;

    // Push description history if overwriting an existing description
    let baseEnrichment = entity.enrichment || {};
    if (description !== undefined && entity.description) {
      const history = [...(baseEnrichment.descriptionHistory || [])];
      history.push({
        description: entity.description,
        replacedAt: Date.now(),
        source: 'description-task',
      });
      baseEnrichment = { ...baseEnrichment, descriptionHistory: history };
    }

    const updates: Partial<PersistedEntity> = {
      enrichment: { ...baseEnrichment, ...enrichment },
    };
    if (summary !== undefined) updates.summary = summary ?? undefined;
    if (description !== undefined) updates.description = description;

    await db.entities.update(entityId, updates);
  });
}

/**
 * Apply an image enrichment result from the worker.
 */
export async function applyImageResult(
  entityId: string,
  imageEnrichment: EntityEnrichment['image'],
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, image: imageEnrichment },
    });
  });
}

/**
 * Apply an entity chronicle enrichment result from the worker.
 */
export async function applyEntityChronicleResult(
  entityId: string,
  chronicleEnrichment: EntityEnrichment['entityChronicle'],
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, entityChronicle: chronicleEnrichment },
    });
  });
}

// ---------------------------------------------------------------------------
// User actions
// ---------------------------------------------------------------------------

/**
 * Assign an existing library image to an entity.
 */
export async function assignImage(
  entityId: string,
  imageId: string,
  imageMetadata?: { generatedAt?: number; model?: string; revisedPrompt?: string },
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: {
        ...entity.enrichment,
        image: {
          imageId,
          generatedAt: imageMetadata?.generatedAt || Date.now(),
          model: imageMetadata?.model || 'assigned',
          revisedPrompt: imageMetadata?.revisedPrompt,
          estimatedCost: 0,
          actualCost: 0,
        },
      },
    });
  });
}

/**
 * Undo the last description change by popping from descriptionHistory.
 */
export async function undoDescription(entityId: string): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    const history = [...(entity.enrichment?.descriptionHistory || [])];
    if (history.length === 0) return;
    const previous = history.pop()!;
    await db.entities.update(entityId, {
      description: previous.description,
      enrichment: { ...entity.enrichment, descriptionHistory: history },
    });
  });
}

/**
 * Set chronicle backrefs on an entity.
 */
export async function updateBackrefs(
  entityId: string,
  backrefs: NonNullable<EntityEnrichment['chronicleBackrefs']>,
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, chronicleBackrefs: backrefs },
    });
  });
}

// ---------------------------------------------------------------------------
// Revision flows (summary revision, backport, copy-edit)
// ---------------------------------------------------------------------------

interface RevisionPatch {
  entityId: string;
  summary?: string;
  description?: string;
  anchorPhrase?: string;
}

/**
 * Apply revision patches from summary revision, lore backport, or copy-edit.
 * Pushes descriptionHistory, bumps text.generatedAt. Returns updated entity IDs.
 */
export async function applyRevisionPatches(
  patches: RevisionPatch[],
  source: string,
): Promise<string[]> {
  if (!patches?.length) return [];
  const updatedIds: string[] = [];

  await db.transaction('rw', db.entities, async () => {
    for (const patch of patches) {
      const entity = await db.entities.get(patch.entityId);
      if (!entity) continue;

      let enrichment = entity.enrichment || {};

      // Push description history if overwriting
      if (patch.description !== undefined && entity.description) {
        const history = [...(enrichment.descriptionHistory || [])];
        history.push({
          description: entity.description,
          replacedAt: Date.now(),
          source,
        });
        enrichment = { ...enrichment, descriptionHistory: history };
      }

      // Bump text.generatedAt so stale persisted data won't overwrite
      if (patch.description !== undefined && enrichment.text) {
        enrichment = { ...enrichment, text: { ...enrichment.text, generatedAt: Date.now() } };
      }

      const updates: Partial<PersistedEntity> = { enrichment };
      if (patch.summary !== undefined) updates.summary = patch.summary;
      if (patch.description !== undefined) updates.description = patch.description;

      await db.entities.update(patch.entityId, updates);
      updatedIds.push(patch.entityId);
    }
  });

  return updatedIds;
}

/**
 * Revalidate chronicle backrefs against updated description text.
 * Optionally upsert a new backref (backport flow) or use fuzzy fallback (copy-edit flow).
 */
export async function revalidateBackrefs(
  patches: RevisionPatch[],
  options?: {
    chronicleId?: string;
    fuzzyFallback?: boolean;
  },
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    for (const patch of patches) {
      if (!patch.description && !options?.chronicleId) continue;

      const entity = await db.entities.get(patch.entityId);
      if (!entity) continue;

      const desc = patch.description || entity.description || '';
      let backrefs = [...(entity.enrichment?.chronicleBackrefs || [])];
      if (backrefs.length === 0 && !patch.anchorPhrase) continue;

      // Re-resolve existing anchor phrases against updated description
      if (patch.description && backrefs.length > 0) {
        backrefs = backrefs.map((br) => {
          const resolved = resolveAnchorPhrase(br.anchorPhrase, desc);
          if (!resolved) {
            // Fuzzy fallback for copy-edit: proportional index mapping
            if (options?.fuzzyFallback && entity.description) {
              const oldIndex = entity.description.indexOf(br.anchorPhrase);
              if (oldIndex >= 0) {
                const newIndex = Math.round(oldIndex / entity.description.length * desc.length);
                const fallbackPhrase = extractWordsAroundIndex(desc, newIndex, 5);
                if (fallbackPhrase) {
                  return { ...br, anchorPhrase: fallbackPhrase };
                }
              }
            }
            return br;
          }
          return resolved.phrase !== br.anchorPhrase
            ? { ...br, anchorPhrase: resolved.phrase }
            : br;
        });
      }

      // Upsert backref for a specific chronicle (backport flow)
      if (options?.chronicleId && patch.anchorPhrase) {
        const resolved = resolveAnchorPhrase(patch.anchorPhrase, desc);
        if (resolved) {
          const existingIdx = backrefs.findIndex((br) => br.chronicleId === options.chronicleId);
          if (existingIdx >= 0) {
            backrefs[existingIdx] = { ...backrefs[existingIdx], anchorPhrase: resolved.phrase };
          } else {
            backrefs.push({
              entityId: entity.id,
              chronicleId: options.chronicleId,
              anchorPhrase: resolved.phrase,
              createdAt: Date.now(),
            });
          }
        }
      }

      await db.entities.update(patch.entityId, {
        enrichment: { ...entity.enrichment, chronicleBackrefs: backrefs },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Historian
// ---------------------------------------------------------------------------

/**
 * Set historian notes on an entity.
 */
export async function setHistorianNotes(
  entityId: string,
  notes: NonNullable<EntityEnrichment['historianNotes']>,
): Promise<void> {
  await db.transaction('rw', db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, historianNotes: notes },
    });
  });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function deleteEntitiesForRun(simulationRunId: string): Promise<void> {
  await db.entities.where('simulationRunId').equals(simulationRunId).delete();
}
