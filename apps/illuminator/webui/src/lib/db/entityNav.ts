/**
 * EntityNavItem — lightweight projection of PersistedEntity for list rendering.
 *
 * ## Architecture: Nav/Detail Split
 *
 * The illuminator data layer uses a two-layer pattern for heavy record types
 * (entities, chronicles). The same pattern is used for both:
 *
 *   Dexie (IndexedDB)  →  Zustand store  →  React components
 *         │                     │
 *         │              ┌──────┴──────┐
 *         │              │  navItems   │  Lightweight projections, always in memory.
 *         │              │  (Map)      │  Used for list rendering, filtering, search.
 *         │              ├─────────────┤
 *         └─────────────→│  cache      │  Full records, bounded FIFO (50 entities / 20 chronicles).
 *           on demand    │  (Map)      │  Loaded when user clicks into detail view or queues work.
 *                        └─────────────┘
 *
 * WHY: ~900 entities × ~10KB each = ~9MB in memory when fully loaded.
 * Most of that weight is enrichment debug payloads, description history, and
 * historian notes — data only needed when viewing a single entity's detail panel.
 * Nav items carry only what the list UI needs: ~1-2KB per entity, ~1-2MB total.
 *
 * ## What goes in a nav item vs. what stays in the full record
 *
 * Nav item fields are chosen by asking: "Does EntityBrowser's list view, its
 * filters, or its search need this field?" If yes, it's on the nav item.
 * Everything else stays on PersistedEntity and is loaded on demand.
 *
 * INCLUDED (nav item):
 *   - Identity: id, name, kind, subtype, prominence, culture, status
 *   - Display: summary (~100-200 chars, shown inline in EntityRow)
 *   - Filtering: eraId, backrefCount, unconfiguredBackrefCount, isManual
 *   - Search: aliases, slugAliases
 *   - Enrichment status: hasDescription, hasVisualThesis, imageId (for badges)
 *   - Cost display: descriptionCost, imageCost (actual costs for completed work)
 *   - State: lockedSummary
 *
 * EXCLUDED (full record only — the heavy data):
 *   - description: full LLM-generated text (~1KB × 900 = ~900KB)
 *   - enrichment.text.debug / chainDebug: network debug payloads (~5KB × 900 = ~4.5MB)
 *   - enrichment.descriptionHistory: previous description versions (~3KB × 900 = ~2.7MB)
 *   - enrichment.historianNotes: annotation objects
 *   - enrichment.text.visualThesis/visualTraits: needed for buildPrompt and detail view
 *   - tags, coordinates, temporal, catalyst: needed for buildPrompt
 *   - enrichment.chronicleBackrefs full array: only counts needed for nav filtering
 *
 * ## Reference pattern
 *
 * This follows the same pattern as chronicleNav.ts / chronicleStore.ts.
 * See also: entityStore.ts (the store), entitySelectors.ts (React selectors).
 *
 * ## Consumer migration rules
 *
 * When a component needs entity data:
 *   - For LIST rendering, filtering, search → use useEntityNavList() / useEntityNavItems()
 *   - For DETAIL view or buildPrompt → load full entity via store.loadEntity(id)
 *   - For BULK operations (queue all) → filter on nav items, then loadEntities(ids)
 *   - For IMPERATIVE callbacks → store.getState().loadEntity(id) (async) or getEntity(id) (cache-only sync)
 */
import type { PersistedEntity } from './illuminatorDb';

export interface EntityNavItem {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: number;
  culture: string;
  status: string;
  summary?: string;           // Short text (~100-200 chars), displayed inline in EntityRow
  eraId?: string;             // Used by EntityCoveragePanel era analysis

  // Enrichment status flags — lightweight projections of the heavy enrichment object.
  // These drive badge rendering and status determination in the list view.
  hasDescription: boolean;    // !!(entity.summary && entity.description)
  hasVisualThesis: boolean;   // !!entity.enrichment?.text?.visualThesis
  imageId?: string;           // entity.enrichment?.image?.imageId — presence = has image
  descriptionCost?: number;   // entity.enrichment?.text?.actualCost — for cost display
  imageCost?: number;         // entity.enrichment?.image?.actualCost
  aliases: string[];          // entity.enrichment?.text?.aliases — for search
  slugAliases: string[];      // entity.enrichment?.slugAliases — for search
  backrefCount: number;       // chronicleBackrefs.length — for chronicle image filter
  unconfiguredBackrefCount: number;  // backrefs missing imageSource — for filter
  isManual: boolean;          // id.startsWith('manual_') — controls Edit/Delete visibility
  lockedSummary: boolean;     // prevents summary overwrite during enrichment
}

export function buildEntityNavItem(entity: PersistedEntity): EntityNavItem {
  const backrefs = entity.enrichment?.chronicleBackrefs || [];
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype: entity.subtype,
    prominence: entity.prominence,
    culture: entity.culture,
    status: entity.status,
    summary: entity.summary,
    eraId: entity.eraId,
    hasDescription: !!(entity.summary && entity.description),
    hasVisualThesis: !!entity.enrichment?.text?.visualThesis,
    imageId: entity.enrichment?.image?.imageId,
    descriptionCost: entity.enrichment?.text?.actualCost,
    imageCost: entity.enrichment?.image?.actualCost,
    aliases: entity.enrichment?.text?.aliases || [],
    slugAliases: entity.enrichment?.slugAliases || [],
    backrefCount: backrefs.length,
    unconfiguredBackrefCount: backrefs.filter(
      (b: { imageSource?: unknown }) => b.imageSource === undefined,
    ).length,
    isManual: entity.id.startsWith('manual_'),
    lockedSummary: !!entity.lockedSummary,
  };
}
