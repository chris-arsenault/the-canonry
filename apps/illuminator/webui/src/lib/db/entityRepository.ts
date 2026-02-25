/**
 * Entity Repository — typed CRUD + named mutations for entity data.
 *
 * All Dexie access for entities goes through this module.
 * UI and zustand call these functions only — never talk to Dexie directly.
 */

import type { WorldEntity } from "@canonry/world-schema";
import { db, type PersistedEntity } from "./illuminatorDb";
import type { EntityPatch } from "../entityRename";
import { applyReplacements, type FieldReplacement } from "../entityRename";
import type { EntityEnrichment, DescriptionChainDebug } from "../enrichmentTypes";
import { resolveAnchorPhrase, extractWordsAroundIndex } from "../fuzzyAnchor";

// ---------------------------------------------------------------------------
// Seed (Phase 1 bridge — replaced by Lore Weave write in future)
// ---------------------------------------------------------------------------

/**
 * Check whether entities have already been seeded for this simulation run.
 */
export async function isSeeded(simulationRunId: string): Promise<boolean> {
  const count = await db.entities.where("simulationRunId").equals(simulationRunId).count();
  return count > 0;
}

/**
 * Bulk-write entities from worldData.hardState into Dexie.
 * Stamps each record with simulationRunId. Skips if already seeded.
 */
export async function seedEntities(
  simulationRunId: string,
  entities: WorldEntity[]
): Promise<void> {
  const records: PersistedEntity[] = entities.map((e) => ({
    ...e,
    simulationRunId,
  }));
  await db.entities.bulkPut(records);
}

// ---------------------------------------------------------------------------
// Manual Creation
// ---------------------------------------------------------------------------

/**
 * Create a single entity manually. Generates a collision-safe ID
 * with a `manual_` prefix.
 */
export async function createEntity(
  simulationRunId: string,
  entity: Omit<WorldEntity, "id" | "createdAt" | "updatedAt">
): Promise<PersistedEntity> {
  if (!simulationRunId) {
    throw new Error("simulationRunId is required to create an entity");
  }
  const now = Date.now();
  const id = `manual_${entity.kind}_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const record: PersistedEntity = {
    ...entity,
    id,
    createdAt: now,
    updatedAt: now,
    simulationRunId,
  };
  await db.entities.put(record);
  return record;
}

export async function deleteEntity(entityId: string): Promise<void> {
  if (!entityId.startsWith("manual_")) {
    throw new Error("Only manually-created entities can be deleted");
  }
  await db.entities.delete(entityId);
}

/**
 * Patch entities from hard state without overwriting existing values.
 * - Inserts missing entities
 * - For existing entities, fills only undefined/null fields (keeps enrichment intact)
 */
export async function patchEntitiesFromHardState(
  simulationRunId: string,
  entities: WorldEntity[]
): Promise<{ added: number; patched: number }> {
  if (!entities?.length) return { added: 0, patched: 0 };

  const existing = await db.entities.where("simulationRunId").equals(simulationRunId).toArray();
  const existingById = new Map(existing.map((e) => [e.id, e]));
  let added = 0;
  let patched = 0;

  await db.transaction("rw", db.entities, async () => {
    for (const worldEntity of entities) {
      const current = existingById.get(worldEntity.id);
      if (!current) {
        await db.entities.put({ ...worldEntity, simulationRunId });
        added += 1;
        continue;
      }

      const updates: Partial<PersistedEntity> = {};
      for (const [key, value] of Object.entries(worldEntity)) {
        if (key === "enrichment") continue;
        if (value === undefined || value === null) continue;
        const currentValue = (current as any)[key];
        if (currentValue === undefined || currentValue === null) {
          (updates as any)[key] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.entities.update(current.id, updates);
        patched += 1;
      }
    }
  });

  return { added, patched };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getEntity(entityId: string): Promise<PersistedEntity | undefined> {
  return db.entities.get(entityId);
}

export async function getEntitiesByIds(entityIds: string[]): Promise<PersistedEntity[]> {
  const results = await db.entities.bulkGet(entityIds);
  return results.filter((e): e is PersistedEntity => e !== undefined);
}

export async function getEntitiesForRun(simulationRunId: string): Promise<PersistedEntity[]> {
  return db.entities.where("simulationRunId").equals(simulationRunId).toArray();
}

export async function getEntityIdsForRun(simulationRunId: string): Promise<string[]> {
  const ids = await db.entities.where("simulationRunId").equals(simulationRunId).primaryKeys();
  return ids.map((id) => String(id));
}

export async function getEntitiesByKind(
  simulationRunId: string,
  kind: string
): Promise<PersistedEntity[]> {
  return db.entities.where("[simulationRunId+kind]").equals([simulationRunId, kind]).toArray();
}

// ---------------------------------------------------------------------------
// Single-field updates
// ---------------------------------------------------------------------------

export async function updateEntityField(
  entityId: string,
  field: string,
  value: unknown
): Promise<void> {
  await db.entities.update(entityId, { [field]: value });
}

export async function updateEntityFields(
  entityId: string,
  fields: Partial<PersistedEntity>
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
  addOldNameAsAlias?: boolean
): Promise<string[]> {
  const updatedIds: string[] = [];

  await db.transaction("rw", db.entities, async () => {
    // 1. Target entity: update name + slugAlias + optional text alias
    if (targetEntityId) {
      const target = await db.entities.get(targetEntityId);
      if (target) {
        const existingAliases = target.enrichment?.slugAliases || [];
        const slugAliases = existingAliases.includes(targetEntityId)
          ? existingAliases
          : [...existingAliases, targetEntityId];

        // Add old name to text aliases if requested (for wiki link resolution)
        let textEnrichment = target.enrichment?.text;
        if (addOldNameAsAlias && target.name && target.name !== newName && textEnrichment) {
          const existingTextAliases = textEnrichment.aliases || [];
          if (!existingTextAliases.includes(target.name)) {
            textEnrichment = { ...textEnrichment, aliases: [...existingTextAliases, target.name] };
          }
        }

        await db.entities.update(targetEntityId, {
          name: newName,
          enrichment: {
            ...target.enrichment,
            slugAliases,
            ...(textEnrichment ? { text: textEnrichment } : {}),
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
        if (!key.startsWith("__replacements_")) continue;
        const field = key.replace("__replacements_", "");
        const replacements: FieldReplacement[] = JSON.parse(value);

        if (field === "summary" && typeof entity.summary === "string") {
          updates.summary = applyReplacements(entity.summary, replacements);
          changed = true;
        } else if (field === "description" && typeof entity.description === "string") {
          updates.description = applyReplacements(entity.description, replacements);
          changed = true;
        } else if (field === "narrativeHint" && typeof entity.narrativeHint === "string") {
          updates.narrativeHint = applyReplacements(entity.narrativeHint, replacements);
          changed = true;
        } else if (field.startsWith("enrichment.descriptionHistory[")) {
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
  description?: string
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;

    // Push description history if overwriting an existing description
    let baseEnrichment = entity.enrichment || {};
    if (description !== undefined && entity.description) {
      const history = [...(baseEnrichment.descriptionHistory || [])];
      history.push({
        description: entity.description,
        replacedAt: Date.now(),
        source: "description-task",
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
 * Apply a visual thesis result — updates only visual fields on enrichment.text,
 * preserving existing aliases, description, and summary.
 */
export async function applyVisualThesisResult(
  entityId: string,
  visualThesis: string,
  visualTraits: string[],
  meta: {
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    chainDebug?: DescriptionChainDebug;
  }
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    const existingText = entity.enrichment?.text;
    await db.entities.update(entityId, {
      enrichment: {
        ...entity.enrichment,
        text: {
          aliases: existingText?.aliases || [],
          visualThesis,
          visualTraits,
          generatedAt: meta.generatedAt,
          model: meta.model,
          estimatedCost: meta.estimatedCost,
          actualCost: meta.actualCost,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          chainDebug: meta.chainDebug,
        },
      },
    });
  });
}

/**
 * Apply an image enrichment result from the worker.
 */
export async function applyImageResult(
  entityId: string,
  imageEnrichment: EntityEnrichment["image"]
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
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
  chronicleEnrichment: EntityEnrichment["entityChronicle"]
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
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
  imageMetadata?: { generatedAt?: number; model?: string; revisedPrompt?: string }
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: {
        ...entity.enrichment,
        image: {
          imageId,
          generatedAt: imageMetadata?.generatedAt || Date.now(),
          model: imageMetadata?.model || "assigned",
          revisedPrompt: imageMetadata?.revisedPrompt,
          estimatedCost: 0,
          actualCost: 0,
        },
      },
    });
  });
}

/**
 * Manually update an entity's description. Pushes current description to history
 * with source 'manual', bumps text.generatedAt to prevent enrichment overwrites.
 */
export async function updateDescriptionManual(
  entityId: string,
  description: string
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;

    let enrichment = entity.enrichment || {};

    // Push current description to history
    if (entity.description) {
      const history = [...(enrichment.descriptionHistory || [])];
      history.push({
        description: entity.description,
        replacedAt: Date.now(),
        source: "manual",
      });
      enrichment = { ...enrichment, descriptionHistory: history };
    }

    // Bump text.generatedAt so enrichment workers won't overwrite
    if (enrichment.text) {
      enrichment = { ...enrichment, text: { ...enrichment.text, generatedAt: Date.now() } };
    }

    await db.entities.update(entityId, { description, enrichment });
  });
}

/**
 * Manually update an entity's summary. Sets lockedSummary to prevent enrichment overwrites.
 */
export async function updateSummaryManual(entityId: string, summary: string): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, { summary, lockedSummary: true });
  });
}

/**
 * Undo the last description change by popping from descriptionHistory.
 */
export async function undoDescription(entityId: string): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
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
 * Restore a specific description history entry as the active description.
 * The current description is pushed to history before the swap.
 */
export async function restoreDescriptionFromHistory(
  entityId: string,
  historyIndex: number
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    const history = [...(entity.enrichment?.descriptionHistory || [])];
    if (historyIndex < 0 || historyIndex >= history.length) return;

    const selected = history[historyIndex];

    // Push current description to history
    if (entity.description) {
      history.push({
        description: entity.description,
        replacedAt: Date.now(),
        source: "version-restore",
      });
    }

    // Remove the selected entry from history
    history.splice(historyIndex, 1);

    await db.entities.update(entityId, {
      description: selected.description,
      enrichment: { ...entity.enrichment, descriptionHistory: history },
    });
  });
}

/**
 * Set chronicle backrefs on an entity.
 */
export async function updateBackrefs(
  entityId: string,
  backrefs: NonNullable<EntityEnrichment["chronicleBackrefs"]>
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, chronicleBackrefs: backrefs },
    });
  });
}

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

/**
 * Update the text aliases on an entity.
 */
export async function updateAliases(entityId: string, aliases: string[]): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    const text = entity.enrichment?.text || {
      aliases: [],
      visualTraits: [],
      generatedAt: 0,
      model: "",
    };
    await db.entities.update(entityId, {
      enrichment: { ...entity.enrichment, text: { ...text, aliases } },
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
  source: string
): Promise<string[]> {
  if (!patches?.length) return [];
  const updatedIds: string[] = [];

  await db.transaction("rw", db.entities, async () => {
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
  }
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    for (const patch of patches) {
      if (!patch.description && !options?.chronicleId) continue;

      const entity = await db.entities.get(patch.entityId);
      if (!entity) continue;

      const desc = patch.description || entity.description || "";
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
                const newIndex = Math.round((oldIndex / entity.description.length) * desc.length);
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
  notes: NonNullable<EntityEnrichment["historianNotes"]>,
  reinforcedFacts?: string[]
): Promise<void> {
  await db.transaction("rw", db.entities, async () => {
    const entity = await db.entities.get(entityId);
    if (!entity) return;
    const enrichment = { ...entity.enrichment, historianNotes: notes };
    if (reinforcedFacts) {
      enrichment.reinforcedFacts = reinforcedFacts;
    }
    await db.entities.update(entityId, { enrichment });
  });
}

// ---------------------------------------------------------------------------
// Backport Reset
// ---------------------------------------------------------------------------

/**
 * Reset entity descriptions to their pre-backport state.
 * Optionally accepts an entity list to ensure reset covers entities not yet persisted in Dexie.
 * For each entity that has lore-backport entries in descriptionHistory:
 * - Find the first 'lore-backport' entry
 * - Restore the description from that entry (which is the pre-backport state)
 * - Truncate history to remove all entries from that point onward
 * - Clear chronicleBackrefs (these were set by backport operations)
 *
 * Returns count of entities that were reset.
 */
export async function resetEntitiesToPreBackportState(
  simulationRunId: string,
  entitiesOverride?: PersistedEntity[]
): Promise<{ resetCount: number; entityIds: string[] }> {
  const entities = entitiesOverride?.length
    ? entitiesOverride
    : await getEntitiesForRun(simulationRunId);
  const resetEntityIds: string[] = [];

  await db.transaction("rw", db.entities, async () => {
    const existing = await db.entities.bulkGet(entities.map((entity) => entity.id));
    const existingIds = new Set(existing.filter(Boolean).map((entity) => entity!.id));

    for (const entity of entities) {
      const history = entity.enrichment?.descriptionHistory || [];
      if (history.length === 0) continue;

      // Find the first 'lore-backport' entry
      const firstBackportIndex = history.findIndex((h) => h.source === "lore-backport");
      if (firstBackportIndex === -1) continue; // Never backported

      // The description in that entry is the pre-backport state
      const preBackportDescription = history[firstBackportIndex].description;

      // Truncate history to remove entries from the first backport onward
      const newHistory = history.slice(0, firstBackportIndex);

      // Clear chronicleBackrefs since those were set by backport
      const newEnrichment = {
        ...entity.enrichment,
        descriptionHistory: newHistory,
        chronicleBackrefs: [],
      };

      const updates = {
        description: preBackportDescription,
        enrichment: newEnrichment,
      };

      if (existingIds.has(entity.id)) {
        await db.entities.update(entity.id, updates);
      } else {
        await db.entities.put({
          ...entity,
          simulationRunId: entity.simulationRunId || simulationRunId,
          ...updates,
        });
      }

      resetEntityIds.push(entity.id);
    }
  });

  return {
    resetCount: resetEntityIds.length,
    entityIds: resetEntityIds,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function deleteEntitiesForRun(simulationRunId: string): Promise<void> {
  await db.entities.where("simulationRunId").equals(simulationRunId).delete();
}

/**
 * Bulk-convert all historian-edition history entries to 'legacy-copy-edit' source.
 * Clears the historian-edition slate so entities can go through a fresh edition cycle.
 *
 * Returns the count of entities modified.
 */
export async function convertLongEditionsToLegacy(entityIds: string[]): Promise<number> {
  let modified = 0;
  await db.transaction("rw", db.entities, async () => {
    for (const entityId of entityIds) {
      const entity = await db.entities.get(entityId);
      if (!entity) continue;

      const history = [...(entity.enrichment?.descriptionHistory || [])];
      let changed = false;
      for (let i = 0; i < history.length; i++) {
        if (history[i].source === "historian-edition") {
          history[i] = { ...history[i], source: "legacy-copy-edit" };
          changed = true;
        }
      }

      if (!changed) continue;

      await db.entities.update(entityId, {
        enrichment: { ...entity.enrichment, descriptionHistory: history },
      });
      modified++;
    }
  });
  return modified;
}
