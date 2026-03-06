/**
 * Apply accepted motif weave changes to entity descriptions.
 */

import { useEntityStore } from "../../lib/db/entityStore";
import { applyRevisionPatches } from "../../lib/db/entityRepository";
import { reloadEntities } from "../../hooks/useEntityCrud";
import type { WeaveCandidate } from "./types";

interface SentenceChange {
  sentenceStart: number;
  sentenceEnd: number;
  original: string;
  rewritten: string;
}

/** Group accepted changes by entity ID. */
function groupChangesByEntity(
  candidates: WeaveCandidate[],
  decisions: Record<string, boolean>,
  variants: Map<string, string>,
): Map<string, SentenceChange[]> {
  const changesByEntity = new Map<string, SentenceChange[]>();

  for (const c of candidates) {
    if (!decisions[c.id]) continue;
    const variant = variants.get(c.id);
    if (!variant) continue;

    let entityChanges = changesByEntity.get(c.entityId);
    if (!entityChanges) {
      entityChanges = [];
      changesByEntity.set(c.entityId, entityChanges);
    }
    entityChanges.push({
      sentenceStart: c.sentenceStart,
      sentenceEnd: c.sentenceEnd,
      original: c.sentence,
      rewritten: variant,
    });
  }

  return changesByEntity;
}

/** Apply sentence replacements to a description, working from end to start. */
function applySentenceChanges(description: string, changes: SentenceChange[]): { result: string; count: number } {
  const sorted = [...changes].sort((a, b) => b.sentenceStart - a.sentenceStart);
  let result = description;
  let count = 0;

  for (const change of sorted) {
    const actual = result.slice(change.sentenceStart, change.sentenceEnd);
    if (actual === change.original) {
      result =
        result.slice(0, change.sentenceStart) +
        change.rewritten +
        result.slice(change.sentenceEnd);
      count++;
    }
  }

  return { result, count };
}

export async function applyMotifWeaves(
  candidates: WeaveCandidate[],
  decisions: Record<string, boolean>,
  variants: Map<string, string>,
): Promise<number> {
  const changesByEntity = groupChangesByEntity(candidates, decisions, variants);

  const patches: Array<{ entityId: string; description: string }> = [];
  const updatedEntityIds: string[] = [];
  let total = 0;

  for (const [entityId, changes] of changesByEntity) {
    const entity = await useEntityStore.getState().loadEntity(entityId);
    if (!entity?.description) continue;

    const { result, count } = applySentenceChanges(entity.description, changes);

    if (result !== entity.description) {
      patches.push({ entityId, description: result });
      updatedEntityIds.push(entityId);
      total += count;
    }
  }

  if (patches.length > 0) {
    await applyRevisionPatches(patches, "motif-weave");
    await reloadEntities(updatedEntityIds);
  }

  return total;
}
