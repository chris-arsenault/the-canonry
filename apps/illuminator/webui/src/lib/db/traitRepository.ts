/**
 * Trait Repository — Dexie-backed visual trait palette and usage tracking
 *
 * Scoping:
 * - Palettes are project + entityKind scoped (persist across simulation runs)
 * - Used traits are project + simulationRunId + entityKind scoped (run-specific)
 */

import { db } from './illuminatorDb';
import type { TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance } from '../traitTypes';

export type { TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance };

// ---------------------------------------------------------------------------
// Palette Operations
// ---------------------------------------------------------------------------

function paletteId(projectId: string, entityKind: string): string {
  return `${projectId}_${entityKind}`;
}

export async function getPalette(
  projectId: string,
  entityKind: string
): Promise<TraitPalette | null> {
  const id = paletteId(projectId, entityKind);
  const result = await db.traitPalettes.get(id);
  return result || null;
}

export async function savePalette(palette: TraitPalette): Promise<void> {
  await db.traitPalettes.put({
    ...palette,
    updatedAt: Date.now(),
  });
}

export async function updatePaletteItems(
  projectId: string,
  entityKind: string,
  updates: {
    removeIds?: string[];
    merges?: Array<{ keepId: string; mergeFromIds: string[]; newDescription: string }>;
    newItems?: Omit<PaletteItem, 'id' | 'timesUsed' | 'addedAt'>[];
  }
): Promise<TraitPalette> {
  const existing = await getPalette(projectId, entityKind);
  const items = existing?.items || [];
  const now = Date.now();

  let filtered = items.filter(item => !updates.removeIds?.includes(item.id));

  for (const merge of updates.merges || []) {
    const keepItem = filtered.find(i => i.id === merge.keepId);
    if (keepItem) {
      keepItem.description = merge.newDescription;
      const mergedItems = items.filter(i => merge.mergeFromIds.includes(i.id));
      keepItem.timesUsed += mergedItems.reduce((sum, i) => sum + i.timesUsed, 0);
    }
    filtered = filtered.filter(i => !merge.mergeFromIds.includes(i.id));
  }

  for (const newItem of updates.newItems || []) {
    filtered.push({
      id: `palette_${now}_${Math.random().toString(36).slice(2, 8)}`,
      category: newItem.category,
      description: newItem.description,
      examples: newItem.examples,
      subtypes: newItem.subtypes,
      era: newItem.era,
      timesUsed: 0,
      addedAt: now,
    });
  }

  const palette: TraitPalette = {
    id: paletteId(projectId, entityKind),
    projectId,
    entityKind,
    items: filtered,
    updatedAt: now,
  };

  await savePalette(palette);
  return palette;
}

export async function incrementPaletteUsage(
  projectId: string,
  entityKind: string,
  traits: string[]
): Promise<void> {
  const palette = await getPalette(projectId, entityKind);
  if (!palette || palette.items.length === 0) return;

  const traitLower = traits.map(t => t.toLowerCase()).join(' ');
  let updated = false;

  for (const item of palette.items) {
    const categoryWords = item.category.toLowerCase().split(/\s+/);
    const exampleWords = item.examples.flatMap(e => e.toLowerCase().split(/\s+/));
    const allWords = [...categoryWords, ...exampleWords];

    const matches = allWords.filter(w => w.length > 4 && traitLower.includes(w));
    if (matches.length >= 2) {
      item.timesUsed += 1;
      updated = true;
    }
  }

  if (updated) {
    await savePalette(palette);
  }
}

// ---------------------------------------------------------------------------
// Used Traits Operations
// ---------------------------------------------------------------------------

function usedTraitId(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  entityId: string
): string {
  return `${projectId}_${simulationRunId}_${entityKind}_${entityId}`;
}

export async function registerUsedTraits(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  entityId: string,
  entityName: string,
  traits: string[]
): Promise<void> {
  if (traits.length === 0) return;

  const id = usedTraitId(projectId, simulationRunId, entityKind, entityId);

  const record: UsedTraitRecord = {
    id,
    projectId,
    simulationRunId,
    entityKind,
    entityId,
    entityName,
    traits,
    registeredAt: Date.now(),
  };

  await db.usedTraits.put(record);
}

export async function getUsedTraitsForRun(
  projectId: string,
  simulationRunId: string,
  entityKind: string
): Promise<UsedTraitRecord[]> {
  if (!projectId || !simulationRunId || !entityKind) return [];

  // Filter in memory — Dexie compound index not declared, use simple index
  const records = await db.usedTraits
    .where('simulationRunId')
    .equals(simulationRunId)
    .toArray();

  return records.filter(
    r => r.projectId === projectId && r.entityKind === entityKind
  );
}

export async function getHistoricalTraits(
  projectId: string,
  entityKind: string
): Promise<string[]> {
  if (!projectId || !entityKind) return [];

  const records = await db.usedTraits
    .where('entityKind')
    .equals(entityKind)
    .filter(r => r.projectId === projectId)
    .toArray();

  return records.flatMap(r => r.traits);
}

export async function countUsedTraits(
  projectId: string,
  entityKind: string
): Promise<number> {
  if (!projectId || !entityKind) return 0;

  return db.usedTraits
    .where('entityKind')
    .equals(entityKind)
    .filter(r => r.projectId === projectId)
    .count();
}

// ---------------------------------------------------------------------------
// Trait Guidance
// ---------------------------------------------------------------------------

function selectCategoriesWeighted(
  items: PaletteItem[],
  count: number
): PaletteItem[] {
  if (items.length === 0) return [];
  if (items.length <= count) return [...items];

  const maxUsage = Math.max(...items.map(i => i.timesUsed), 1);
  const weights = items.map(item => {
    return (maxUsage + 1) / (item.timesUsed + 1);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const selected: PaletteItem[] = [];
  const availableIndices = items.map((_, i) => i);

  for (let i = 0; i < count && availableIndices.length > 0; i++) {
    let random = Math.random() * totalWeight;
    let selectedIdx = 0;

    for (let j = 0; j < availableIndices.length; j++) {
      const idx = availableIndices[j];
      random -= weights[idx];
      if (random <= 0) {
        selectedIdx = j;
        break;
      }
    }

    const itemIdx = availableIndices[selectedIdx];
    selected.push(items[itemIdx]);
    availableIndices.splice(selectedIdx, 1);
  }

  return selected;
}

function categoryMatchesSubtype(item: PaletteItem, subtype: string): boolean {
  if (!item.subtypes || item.subtypes.length === 0) return false;
  const subtypeLower = subtype.toLowerCase();
  return item.subtypes.some(s => s.toLowerCase() === subtypeLower);
}

export async function getTraitGuidance(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  subtype?: string,
  eraId?: string
): Promise<TraitGuidance> {
  const palette = await getPalette(projectId, entityKind);
  const allItems = palette?.items || [];

  const categoryUsage: Record<string, number> = {};
  for (const item of allItems) {
    categoryUsage[item.category] = item.timesUsed;
  }

  if (!subtype) {
    return {
      assignedCategories: [],
      categoryUsage,
      selectionMethod: 'fallback',
    };
  }

  const subtypePool: PaletteItem[] = [];
  const eraPool: PaletteItem[] = [];

  for (const item of allItems) {
    if (item.era) {
      if (eraId && item.era.toLowerCase() === eraId.toLowerCase()) {
        eraPool.push(item);
      }
    } else {
      if (categoryMatchesSubtype(item, subtype)) {
        subtypePool.push(item);
      }
    }
  }

  const numSubtypeCategories = Math.min(2, subtypePool.length);
  const subtypeAssigned = selectCategoriesWeighted(subtypePool, numSubtypeCategories);
  const eraAssigned = selectCategoriesWeighted(eraPool, 1);
  const assigned = [...subtypeAssigned, ...eraAssigned];

  if (assigned.length === 0) {
    return {
      assignedCategories: [],
      categoryUsage,
      selectionMethod: 'fallback',
    };
  }

  return {
    assignedCategories: assigned,
    categoryUsage,
    selectionMethod: 'weighted-random',
  };
}

// ---------------------------------------------------------------------------
// Cleanup / Export
// ---------------------------------------------------------------------------

export async function deleteUsedTraitsForRun(
  projectId: string,
  simulationRunId: string
): Promise<number> {
  const records = await db.usedTraits
    .where('simulationRunId')
    .equals(simulationRunId)
    .filter(r => r.projectId === projectId)
    .toArray();

  if (records.length === 0) return 0;
  await db.usedTraits.bulkDelete(records.map(r => r.id));
  return records.length;
}

export async function exportPalettes(projectId: string): Promise<TraitPalette[]> {
  return db.traitPalettes.where('projectId').equals(projectId).toArray();
}

export async function importPalettes(palettes: TraitPalette[]): Promise<void> {
  await db.traitPalettes.bulkPut(palettes);
}
