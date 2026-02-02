/**
 * wikiBuilder - Transforms world data into wiki pages
 *
 * Wiki pages are computed views, not stored separately.
 * This module creates WikiPage objects from worldData + loreData.
 *
 * Supports two modes:
 * 1. Full build: buildWikiPages() - builds all pages upfront (legacy)
 * 2. Lazy build: buildPageIndex() + buildPageById() - builds on-demand
 */

import type {
  WorldState,
  LoreData,
  ImageMetadata,
  WikiPage,
  WikiPageIndex,
  PageIndexEntry,
  WikiSection,
  WikiSectionImage,
  WikiInfobox,
  WikiCategory,
  HardState,
  LoreRecord,
  DisambiguationEntry,
  Region,
  ConfluxSummary,
  ConfluxPageData,
  ConvergenceResult,
  EntityConvergence,
  NarrativeEvent,
  HuddleType,
  HuddleInstance,
  ImageAspect,
} from '../types/world.ts';
import type { ChronicleRecord } from './chronicleStorage.ts';
import { getChronicleContent } from './chronicleStorage.ts';
import type { StaticPage } from './staticPageStorage.ts';
import { applyWikiLinks } from './entityLinking.ts';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  type ProminenceScale,
} from '@canonry/world-schema';
import { resolveAnchorPhrase } from './fuzzyAnchor.ts';

// Re-export for backwards compatibility
export { applyWikiLinks };

import type { ChronicleBackref } from '../types/world.ts';

const DEBUG_WIKI_BUILDER = import.meta.env?.DEV;

/**
 * Resolve the image ID for a chronicle backref based on its imageSource config.
 *
 * - imageSource undefined (legacy): fallback to cover image
 * - imageSource null: no image
 * - { source: 'cover' }: chronicle cover image
 * - { source: 'image_ref', refId }: specific image ref from chronicle
 * - { source: 'entity', entityId }: entity portrait
 */
function resolveBackrefImageId(
  backref: ChronicleBackref,
  chronicle: ChronicleRecord,
  entities: HardState[],
): string | null {
  const { imageSource } = backref;

  // Explicitly no image
  if (imageSource === null) return null;

  // Legacy fallback: use cover image
  if (imageSource === undefined) {
    if (chronicle.coverImage?.status === 'complete' && chronicle.coverImage.generatedImageId) {
      return chronicle.coverImage.generatedImageId;
    }
    return null;
  }

  if (imageSource.source === 'cover') {
    if (chronicle.coverImage?.status === 'complete' && chronicle.coverImage.generatedImageId) {
      return chronicle.coverImage.generatedImageId;
    }
    return null;
  }

  if (imageSource.source === 'image_ref') {
    const ref = chronicle.imageRefs?.refs?.find((r) => r.refId === imageSource.refId);
    if (!ref) return null;
    if (ref.type === 'prompt_request' && ref.status === 'complete' && ref.generatedImageId) {
      return ref.generatedImageId;
    }
    if (ref.type === 'entity_ref' && ref.entityId) {
      const entity = entities.find((e) => e.id === ref.entityId);
      return entity?.enrichment?.image?.imageId || null;
    }
    return null;
  }

  if (imageSource.source === 'entity') {
    const entity = entities.find((e) => e.id === imageSource.entityId);
    return entity?.enrichment?.image?.imageId || null;
  }

  return null;
}

/**
 * Inject subtle footnote markers at chronicle backref anchor positions.
 * Each anchor phrase gets a superscript link to the source chronicle page.
 * If the anchor phrase isn't found in the text, it's silently skipped.
 */
function injectBackrefFootnotes(
  content: string,
  backrefs: ChronicleBackref[],
): string {
  if (!backrefs.length) return content;

  // Process backrefs in reverse order of position to avoid offset shifts
  const positioned: Array<{ backref: ChronicleBackref; index: number; phraseLength: number }> = [];
  for (const backref of backrefs) {
    const resolved = resolveAnchorPhrase(backref.anchorPhrase, content);
    if (resolved) {
      positioned.push({ backref, index: resolved.index, phraseLength: resolved.phrase.length });
    }
  }
  // Sort by position descending so insertions don't shift earlier indices
  positioned.sort((a, b) => b.index - a.index);

  let result = content;
  for (const { backref, index, phraseLength } of positioned) {
    const insertAt = index + phraseLength;
    // Use wiki link syntax [[display|pageId]] which MarkdownSection already handles
    const footnote = `<sup>[[↗|${backref.chronicleId}]]</sup>`;
    result = result.slice(0, insertAt) + footnote + result.slice(insertAt);
  }
  return result;
}

/**
 * Chronicle image ref types (matching illuminator/chronicleTypes.ts)
 */
interface ChronicleImageRef {
  refId: string;
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex?: number;
  size: 'small' | 'medium' | 'large' | 'full-width';
  justification?: 'left' | 'right';
  caption?: string;
  type: 'entity_ref' | 'prompt_request';
  entityId?: string;
  sceneDescription?: string;
  status?: 'pending' | 'generating' | 'complete' | 'failed';
  generatedImageId?: string;
}

interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

/**
 * Build all wiki pages from world data (legacy full build)
 *
 * @param chronicles - Completed ChronicleRecords from IndexedDB (preferred source for chronicles)
 */
export function buildWikiPages(
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  chronicles: ChronicleRecord[] = [],
  prominenceScale?: ProminenceScale
): WikiPage[] {
  const pages: WikiPage[] = [];
  const resolvedProminenceScale = resolveProminenceScale(worldData, prominenceScale);
  const loreIndex = buildLoreIndex(loreData);
  const aliasIndex = buildAliasIndex(worldData);
  const imageIndex = buildImageIndex(worldData, imageData);

  // Build entity pages
  for (const entity of worldData.hardState) {
    const page = buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex, resolvedProminenceScale, chronicles);
    pages.push(page);
  }

  // Build chronicle pages from ChronicleRecords (IndexedDB)
  const chroniclePages = buildChroniclePagesFromChronicles(chronicles, worldData, aliasIndex);
  pages.push(...chroniclePages);

  // Build category pages
  const categories = buildCategories(worldData, pages);
  for (const category of categories) {
    pages.push(buildCategoryPage(category, pages));
  }

  return pages;
}

function resolveProminenceScale(
  worldData: WorldState,
  prominenceScale?: ProminenceScale
): ProminenceScale {
  if (prominenceScale) return prominenceScale;
  const values = worldData.hardState
    .map((entity) => entity.prominence)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
}

/**
 * Parse namespace and base name from a page title
 * e.g., "Cultures:Aurora Stack" -> { namespace: "Cultures", baseName: "Aurora Stack" }
 *       "Aurora Stack" -> { namespace: undefined, baseName: "Aurora Stack" }
 */
function parseNamespace(title: string): { namespace?: string; baseName: string } {
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0 && colonIndex < title.length - 1) {
    return {
      namespace: title.slice(0, colonIndex).trim(),
      baseName: title.slice(colonIndex + 1).trim(),
    };
  }
  return { baseName: title };
}

/**
 * Get all regions across all entity kinds
 */
function getAllRegionsFlat(worldData: WorldState): Array<{ region: Region; entityKind: string }> {
  const results: Array<{ region: Region; entityKind: string }> = [];
  for (const kindDef of worldData.schema.entityKinds) {
    const seedRegions = kindDef.semanticPlane?.regions ?? [];
    const emergentRegions = worldData.coordinateState?.emergentRegions?.[kindDef.kind] ?? [];
    for (const region of [...seedRegions, ...emergentRegions]) {
      results.push({ region, entityKind: kindDef.kind });
    }
  }
  return results;
}

/**
 * Build list of names to auto-link for backlink extraction.
 */
function buildLinkableNamesForBacklinks(
  worldData: WorldState,
  pageNameIndex?: Map<string, string>
): Array<{ name: string; id: string }> {
  const names: Array<{ name: string; id: string }> = [];
  const seen = new Set<string>();

  const addName = (name: string, id: string) => {
    const normalized = name.toLowerCase().trim();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    names.push({ name, id });
  };

  for (const entity of worldData.hardState) {
    addName(entity.name, entity.id);
  }

  if (pageNameIndex) {
    for (const [name, id] of pageNameIndex) {
      addName(name, id);
    }
  }

  for (const { region } of getAllRegionsFlat(worldData)) {
    addName(region.label, `region:${region.id}`);
  }

  return names;
}

/**
 * Look up a region by ID across all entity kinds
 */
function findRegionById(worldData: WorldState, regionId: string): { region: Region; entityKind: string } | null {
  for (const kindDef of worldData.schema.entityKinds) {
    const seedRegions = kindDef.semanticPlane?.regions ?? [];
    const emergentRegions = worldData.coordinateState?.emergentRegions?.[kindDef.kind] ?? [];
    for (const region of [...seedRegions, ...emergentRegions]) {
      if (region.id === regionId) {
        return { region, entityKind: kindDef.kind };
      }
    }
  }
  return null;
}

/**
 * Build lightweight page index for navigation and search
 * This is fast and should be called on initial load
 *
 * @param chronicles - Completed ChronicleRecords from IndexedDB (preferred source for chronicles)
 * @param staticPages - Published StaticPages from IndexedDB
 */
export function buildPageIndex(
  worldData: WorldState,
  _loreData: LoreData | null, // Not used here - kept for API compatibility
  chronicles: ChronicleRecord[] = [],
  staticPages: StaticPage[] = [],
  prominenceScale?: ProminenceScale
): WikiPageIndex {
  const resolvedProminenceScale = resolveProminenceScale(worldData, prominenceScale);
  const entries: PageIndexEntry[] = [];
  const byId = new Map<string, PageIndexEntry>();
  const byName = new Map<string, string>();
  const byAlias = new Map<string, string>();
  const bySlug = new Map<string, string>();

  // Build entity name lookup for resolving linked entity names to IDs
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  // Note: loreIndex is not built here - it's only needed for full page builds (buildPageById)
  // Summary/description/aliases are now read directly from entity fields

  // Build entity index entries
  for (const entity of worldData.hardState) {
    // Summary and description are now directly on entity
    const summary = entity.summary || '';
    // Aliases are in enrichment.text (the old lore record format is dead code)
    const aliases = Array.isArray(entity.enrichment?.text?.aliases)
      ? entity.enrichment.text.aliases
        .filter((alias): alias is string => typeof alias === 'string')
        .map((alias) => alias.trim())
        .filter(Boolean)
      : [];

    const entry: PageIndexEntry = {
      id: entity.id,
      title: entity.name,
      type: entity.kind === 'era' ? 'era' : 'entity',
      slug: slugify(entity.name),
      summary: summary || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      categories: buildEntityCategories(entity, worldData, resolvedProminenceScale),
      entityKind: entity.kind,
      entitySubtype: entity.subtype,
      prominence: entity.prominence,
      culture: entity.culture,
      linkedEntities: [], // Computed on full page build
      lastUpdated: entity.updatedAt || entity.createdAt,
    };

    entries.push(entry);
    byId.set(entry.id, entry);
    byName.set(entity.name.toLowerCase(), entity.id);

    // Index by slug for URL resolution (name slug + slug aliases from renames)
    const nameSlug = slugify(entity.name);
    if (nameSlug && !bySlug.has(nameSlug)) {
      bySlug.set(nameSlug, entity.id);
    }
    const slugAliases: string[] = (entity.enrichment as any)?.slugAliases || [];
    for (const sa of slugAliases) {
      if (sa && !bySlug.has(sa)) {
        bySlug.set(sa, entity.id);
      }
    }

    for (const alias of aliases) {
      const normalized = alias.toLowerCase();
      if (!byName.has(normalized) && !byAlias.has(normalized)) {
        byAlias.set(normalized, entity.id);
      }
    }
  }

  // Build chronicle index entries from ChronicleRecords (IndexedDB)
  for (const chronicle of chronicles) {
    const content = getChronicleContent(chronicle);
    if (!content) continue;

    const title = chronicle.title;
    const titleSlug = slugify(title);
    const chronicleSlug = titleSlug ? `chronicle/${titleSlug}` : '';

    const entry: PageIndexEntry = {
      id: chronicle.chronicleId,
      title,
      type: 'chronicle',
      slug: chronicleSlug,
      summary: chronicle.summary || undefined,
      categories: [],
      chronicle: {
        format: chronicle.format,
        entrypointId: chronicle.entrypointId,
        narrativeStyleId: chronicle.narrativeStyleId,
        roleAssignments: chronicle.roleAssignments,
        selectedEventIds: chronicle.selectedEventIds,
        selectedRelationshipIds: chronicle.selectedRelationshipIds,
        temporalContext: chronicle.temporalContext,
      },
      linkedEntities: chronicle.selectedEntityIds,
      lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
    };

    entries.push(entry);
    byId.set(entry.id, entry);
    if (chronicleSlug && !bySlug.has(chronicleSlug)) {
      bySlug.set(chronicleSlug, entry.id);
    }
  }

  // Build static page index entries (two-pass for proper cross-page link resolution)
  // Pass 1: Add all static page titles to byName first (including base names)
  // This ensures page-to-page links can be resolved regardless of processing order
  for (const staticPage of staticPages) {
    byName.set(staticPage.title.toLowerCase(), staticPage.pageId);
    // Also index by base name (without namespace prefix) for link resolution
    // e.g., "World:The Berg" should be findable via [[The Berg]]
    const { baseName } = parseNamespace(staticPage.title);
    const baseNameLower = baseName.toLowerCase();
    if (baseNameLower !== staticPage.title.toLowerCase() && !byName.has(baseNameLower)) {
      byName.set(baseNameLower, staticPage.pageId);
    }
  }

  // Build list of all linkable names (entities + static page base names + regions)
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) {
    linkableNames.push({ name: entity.name, id: entity.id });
  }
  for (const staticPage of staticPages) {
    const { baseName } = parseNamespace(staticPage.title);
    linkableNames.push({ name: baseName, id: staticPage.pageId });
    // Also add full title if different
    if (baseName !== staticPage.title) {
      linkableNames.push({ name: staticPage.title, id: staticPage.pageId });
    }
  }
  // Add region labels as linkable names
  for (const { region } of getAllRegionsFlat(worldData)) {
    linkableNames.push({ name: region.label, id: `region:${region.id}` });
  }

  // Backlink extraction for chronicle index entries (match auto-linking behavior)
  if (chronicles.length > 0) {
    const chronicleById = new Map(chronicles.map(chronicle => [chronicle.chronicleId, chronicle]));
    for (const entry of entries) {
      if (entry.type !== 'chronicle') continue;
      const chronicle = chronicleById.get(entry.id);
      if (!chronicle) continue;
      const linked = new Set(entry.linkedEntities);
      if (chronicle.entrypointId) {
        linked.add(chronicle.entrypointId);
      }

      const content = getChronicleContent(chronicle);
      if (content) {
        const linkedContent = applyWikiLinks(content, linkableNames);
        const extracted = extractLinkedEntities(
          [{ id: 'temp', heading: '', level: 2, content: linkedContent }],
          worldData,
          byAlias,
          byName
        );
        extracted.forEach(id => linked.add(id));
      }

      entry.linkedEntities = Array.from(linked);
    }
  }

  // Pass 2: Build entries with resolved linked IDs
  for (const staticPage of staticPages) {
    // Apply wikilinks to content (auto-wrap entity/page names with [[...]])
    const linkedContent = applyWikiLinks(staticPage.content, linkableNames);

    // Extract [[...]] links from the linked content
    const resolvedLinkedIds: Set<string> = new Set();
    const linkMatches = linkedContent.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of linkMatches) {
      const nameLower = match[1].toLowerCase().trim();
      // Check if it's an entity name
      const entityId = entityByName.get(nameLower);
      if (entityId) {
        resolvedLinkedIds.add(entityId);
        continue;
      }
      // Check entity aliases
      const aliasId = byAlias.get(nameLower);
      if (aliasId) {
        resolvedLinkedIds.add(aliasId);
        continue;
      }
      // Check static page titles (including base names)
      const pageId = byName.get(nameLower);
      if (pageId) {
        resolvedLinkedIds.add(pageId);
      }
    }

    const entry: PageIndexEntry = {
      id: staticPage.pageId,
      title: staticPage.title,
      type: 'static',
      slug: `page/${staticPage.slug}`,
      summary: staticPage.summary || undefined,
      categories: [],
      static: {
        pageId: staticPage.pageId,
        status: staticPage.status,
      },
      linkedEntities: Array.from(resolvedLinkedIds),
      lastUpdated: staticPage.updatedAt,
    };

    entries.push(entry);
    byId.set(entry.id, entry);
  }

  // Build category entries (based on entity categories)
  const categoryMap = new Map<string, { id: string; name: string; pageCount: number }>();
  for (const entry of entries) {
    for (const catId of entry.categories) {
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: formatCategoryName(catId),
          pageCount: 0,
        });
      }
      categoryMap.get(catId)!.pageCount++;
    }
  }

  const categories: WikiCategory[] = Array.from(categoryMap.values())
    .map(cat => ({ ...cat, type: 'auto' as const }))
    .sort((a, b) => b.pageCount - a.pageCount);

  // Add category entries to index
  for (const category of categories) {
    const entry: PageIndexEntry = {
      id: `category-${category.id}`,
      title: `Category: ${category.name}`,
      type: 'category',
      slug: `category/${slugify(category.name)}`,
      categories: [],
      linkedEntities: entries.filter(e => e.categories.includes(category.id)).map(e => e.id),
      lastUpdated: Date.now(),
    };
    entries.push(entry);
    byId.set(entry.id, entry);
  }

  // Add region entries to index
  const allRegions = getAllRegionsFlat(worldData);
  for (const { region, entityKind } of allRegions) {
    const regionPageId = `region:${region.id}`;
    // Find entities in this region
    const entitiesInRegion = worldData.hardState.filter(
      e => e.regionId === region.id || e.allRegionIds?.includes(region.id)
    );

    const entry: PageIndexEntry = {
      id: regionPageId,
      title: region.label,
      type: 'region',
      slug: `region/${slugify(region.label)}`,
      summary: region.description,
      categories: [`region-${entityKind}`],
      linkedEntities: entitiesInRegion.map(e => e.id),
      lastUpdated: region.createdAt ?? Date.now(),
    };

    entries.push(entry);
    byId.set(entry.id, entry);
    // Also index by region label for link resolution
    const labelLower = region.label.toLowerCase();
    if (!byName.has(labelLower)) {
      byName.set(labelLower, regionPageId);
    }
  }

  // Build conflux index entries from narrative history
  const confluxIndex = buildConfluxIndex(worldData.narrativeHistory ?? []);
  for (const [confluxId, summary] of confluxIndex) {
    const confluxPageId = `conflux:${confluxId}`;
    const entry: PageIndexEntry = {
      id: confluxPageId,
      title: summary.name,
      type: 'conflux',
      slug: `conflux/${slugify(confluxId)}`,
      summary: summary.description || `${summary.manifestations} manifestations affecting ${summary.touchedEntityIds.length} entities`,
      categories: ['conflux', `conflux-${summary.sourceType}`],
      conflux: {
        confluxId,
        sourceType: summary.sourceType,
        manifestations: summary.manifestations,
        touchedCount: summary.touchedEntityIds.length,
      },
      linkedEntities: summary.touchedEntityIds,
      lastUpdated: Date.now(),
    };

    entries.push(entry);
    byId.set(entry.id, entry);
  }

  // Build huddle index entries from entity relationships (excludes historical by default)
  const allRelationships = worldData.relationships ?? [];
  const { huddleTypes } = buildHuddleIndex(worldData.hardState, allRelationships);
  for (const [huddleTypeId, huddleType] of huddleTypes) {
    const huddleTypePageId = `huddle-type:${huddleTypeId}`;
    const entry: PageIndexEntry = {
      id: huddleTypePageId,
      title: huddleType.displayName,
      type: 'huddle-type',
      slug: `huddle/${slugify(huddleTypeId)}`,
      summary: `${huddleType.instanceCount} ${huddleType.instanceCount === 1 ? 'huddle' : 'huddles'}, largest has ${huddleType.largestSize} ${huddleType.entityKind}s`,
      categories: ['huddle', `huddle-${huddleType.entityKind}`],
      huddleType: {
        entityKind: huddleType.entityKind,
        relationshipKind: huddleType.relationshipKind,
        instanceCount: huddleType.instanceCount,
        largestSize: huddleType.largestSize,
        totalEntities: huddleType.totalEntities,
      },
      linkedEntities: [],
      lastUpdated: Date.now(),
    };

    entries.push(entry);
    byId.set(entry.id, entry);
  }

  // Build disambiguation index: group pages by base name (after namespace prefix)
  const byBaseName = new Map<string, DisambiguationEntry[]>();
  for (const entry of entries) {
    // Skip category entries from disambiguation
    if (entry.type === 'category') continue;

    const { namespace, baseName } = parseNamespace(entry.title);
    const baseNameLower = baseName.toLowerCase();

    if (!byBaseName.has(baseNameLower)) {
      byBaseName.set(baseNameLower, []);
    }

    byBaseName.get(baseNameLower)!.push({
      pageId: entry.id,
      title: entry.title,
      namespace,
      type: entry.type,
      entityKind: entry.entityKind,
    });
  }

  // Remove entries with only one page (no disambiguation needed)
  for (const [baseName, pages] of byBaseName) {
    if (pages.length <= 1) {
      byBaseName.delete(baseName);
    }
  }

  return { entries, byId, byName, byAlias, bySlug, categories, byBaseName };
}

/**
 * Build a single page by ID (on-demand)
 * Returns null if page not found
 *
 * @param chronicles - Completed ChronicleRecords from IndexedDB (for chronicle pages)
 * @param staticPages - Published StaticPages from IndexedDB
 */
export function buildPageById(
  pageId: string,
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  pageIndex: WikiPageIndex,
  chronicles: ChronicleRecord[] = [],
  staticPages: StaticPage[] = [],
  prominenceScale?: ProminenceScale
): WikiPage | null {
  const resolvedProminenceScale = resolveProminenceScale(worldData, prominenceScale);
  let indexEntry = pageIndex.byId.get(pageId);
  if (!indexEntry) {
    // Slug fallback: supports renamed entity URLs and slug-based deep links
    const resolvedId = pageIndex.bySlug.get(pageId);
    if (resolvedId) indexEntry = pageIndex.byId.get(resolvedId);
    if (!indexEntry) return null;
  }

  const loreIndex = buildLoreIndex(loreData);
  const imageIndex = buildImageIndex(worldData, imageData);

  // Build alias index from page index
  const aliasIndex = pageIndex.byAlias;

  // Entity page
  if (indexEntry.type === 'entity' || indexEntry.type === 'era') {
    const entity = worldData.hardState.find(e => e.id === pageId);
    if (!entity) return null;
    return buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex, resolvedProminenceScale, chronicles);
  }

  // Chronicle page - look up in ChronicleRecords
  if (indexEntry.type === 'chronicle') {
    const chronicle = chronicles.find(c => c.chronicleId === pageId);
    if (!chronicle) return null;
    return buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex, pageIndex.byName);
  }

  // Category page
  if (indexEntry.type === 'category') {
    const catId = pageId.replace('category-', '');
    const category = pageIndex.categories.find(c => c.id === catId);
    if (!category) return null;

    // Build minimal page list for category
    const pagesInCategory = pageIndex.entries
      .filter(e => e.categories.includes(catId))
      .map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        slug: e.slug,
        content: { sections: [], summary: e.summary },
        categories: e.categories,
        linkedEntities: e.linkedEntities,
        images: [],
        lastUpdated: e.lastUpdated,
      })) as WikiPage[];

    return buildCategoryPage(category, pagesInCategory);
  }

  // Static page - look up in StaticPages
  if (indexEntry.type === 'static') {
    const staticPage = staticPages.find(p => p.pageId === pageId);
    if (!staticPage) return null;
    return buildStaticPageFromStaticPage(staticPage, worldData, loreData, aliasIndex, pageIndex.byName);
  }

  // Region page
  if (indexEntry.type === 'region') {
    // Extract region ID from page ID (format: "region:region_id")
    const regionId = pageId.replace('region:', '');
    const regionInfo = findRegionById(worldData, regionId);
    if (!regionInfo) return null;
    return buildRegionPage(regionInfo.region, regionInfo.entityKind, worldData, aliasIndex);
  }

  // Conflux page
  if (indexEntry.type === 'conflux') {
    const confluxId = pageId.replace('conflux:', '');
    return buildConfluxPage(confluxId, worldData, pageIndex);
  }

  // Huddle type page
  if (indexEntry.type === 'huddle-type') {
    const huddleTypeId = pageId.replace('huddle-type:', '');
    return buildHuddleTypePage(huddleTypeId, worldData);
  }

  return null;
}

/**
 * Build a single chronicle page from a ChronicleRecord (IndexedDB)
 */
function buildChroniclePageFromChronicle(
  chronicle: ChronicleRecord,
  worldData: WorldState,
  aliasIndex: Map<string, string>,
  pageNameIndex?: Map<string, string>
): WikiPage {
  const content = getChronicleContent(chronicle);
  const title = chronicle.title;
  const titleSlug = slugify(title);
  const chronicleSlug = titleSlug ? `chronicle/${titleSlug}` : '';

  // Extract image refs from chronicle
  const imageRefs = chronicle.imageRefs;

  const { sections } = buildChronicleSections(content, imageRefs, worldData);
  const summary = chronicle.summary || '';

  const linkableNames = buildLinkableNamesForBacklinks(worldData, pageNameIndex);
  const linkedSections = sections.map(section => ({
    ...section,
    content: applyWikiLinks(section.content, linkableNames),
  }));

  const linkedEntities = Array.from(new Set([
    ...chronicle.selectedEntityIds,
    ...extractLinkedEntities(linkedSections, worldData, aliasIndex, pageNameIndex),
    ...(chronicle.entrypointId ? [chronicle.entrypointId] : []),
  ]));

  return {
    id: chronicle.chronicleId,
    slug: chronicleSlug,
    title,
    type: 'chronicle',
    chronicle: {
      format: chronicle.format,
      entrypointId: chronicle.entrypointId,
      narrativeStyleId: chronicle.narrativeStyleId,
      roleAssignments: chronicle.roleAssignments,
      selectedEventIds: chronicle.selectedEventIds,
      selectedRelationshipIds: chronicle.selectedRelationshipIds,
      temporalContext: chronicle.temporalContext,
    },
    content: {
      sections,
      summary: summary || undefined,
      coverImageId: chronicle.coverImage?.status === 'complete' && chronicle.coverImage?.generatedImageId
        ? chronicle.coverImage.generatedImageId
        : undefined,
      historianNotes: (chronicle.historianNotes || [])
        .filter(n => (n.display || (n.enabled === false ? 'disabled' : 'full')) !== 'disabled')
        .map(n => ({ noteId: n.noteId, anchorPhrase: n.anchorPhrase, text: n.text, type: n.type, display: (n.display || (n.enabled === false ? 'disabled' : 'full')) as 'popout' | 'full' })),
    },
    categories: [],
    linkedEntities,
    images: [],
    lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
  };
}

/**
 * Template variable context for static page rendering
 */
interface TemplateContext {
  worldData: WorldState;
  loreData: LoreData | null;
}

/**
 * Process template variables in content
 * Supports: {{world.context}}, {{cultures}}, {{eras}}, {{entity:Name}}, {{stats}}
 */
function processTemplateVariables(content: string, ctx: TemplateContext): string {
  const { worldData } = ctx;

  return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmed = variable.trim();

    // {{world.context}} - World metadata summary
    if (trimmed === 'world.context') {
      // WorldMetadata doesn't have description, return era info instead
      const era = worldData.metadata?.era;
      const tick = worldData.metadata?.tick;
      return era ? `Era: ${era}${tick ? ` (Tick ${tick})` : ''}` : '';
    }

    // {{cultures}} - List of cultures
    if (trimmed === 'cultures') {
      const cultures = worldData.schema?.cultures || [];
      if (cultures.length === 0) return '_No cultures defined_';
      return cultures.map((c: { id: string; name?: string }) =>
        `- **${c.name || c.id}**`
      ).join('\n');
    }

    // {{eras}} - List of eras
    if (trimmed === 'eras') {
      const eras = worldData.hardState.filter(e => e.kind === 'era');
      if (eras.length === 0) return '_No eras_';
      return eras.map(e => `- [[${e.name}]]`).join('\n');
    }

    // {{stats}} - World statistics
    if (trimmed === 'stats') {
      const entityCount = worldData.hardState.length;
      const relCount = worldData.relationships.length;
      const eraCount = worldData.hardState.filter(e => e.kind === 'era').length;
      return `- **Entities:** ${entityCount}\n- **Relationships:** ${relCount}\n- **Eras:** ${eraCount}`;
    }

    // {{entity:Name}} - Entity summary
    if (trimmed.startsWith('entity:')) {
      const entityName = trimmed.slice(7).trim();
      const entity = worldData.hardState.find(
        e => e.name.toLowerCase() === entityName.toLowerCase()
      );
      if (!entity) return `_Entity "${entityName}" not found_`;
      return `**[[${entity.name}]]** (${entity.kind}${entity.subtype ? ` - ${entity.subtype}` : ''})`;
    }

    // {{kinds}} - List of entity kinds with counts
    if (trimmed === 'kinds') {
      const kindCounts = new Map<string, number>();
      for (const e of worldData.hardState) {
        kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
      }
      return Array.from(kindCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `- **${kind}:** ${count}`)
        .join('\n');
    }

    // Unknown variable - return as-is
    return match;
  });
}

/**
 * Build a single static page from a StaticPage (IndexedDB)
 * Note: Wiki links are applied at render time in WikiPage.tsx, not here
 */
function buildStaticPageFromStaticPage(
  staticPage: StaticPage,
  worldData: WorldState,
  loreData: LoreData | null,
  aliasIndex: Map<string, string>,
  pageNameIndex: Map<string, string>
): WikiPage {
  // Process template variables before parsing sections
  const processedContent = processTemplateVariables(staticPage.content, {
    worldData,
    loreData,
  });

  // Store raw content - wiki links are applied at render time
  const { sections } = buildStaticPageSections(processedContent);

  // Build linkable names to detect entity/page references for backlinks
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) {
    linkableNames.push({ name: entity.name, id: entity.id });
  }
  for (const [name, id] of pageNameIndex) {
    if (!linkableNames.some(n => n.name.toLowerCase() === name)) {
      linkableNames.push({ name, id });
    }
  }

  // Extract linked entities by scanning for name mentions (for backlinks)
  const linkedContent = applyWikiLinks(processedContent, linkableNames);
  const linkedEntities = Array.from(new Set([
    ...extractLinkedEntities(
      [{ id: 'temp', heading: '', level: 2, content: linkedContent }],
      worldData,
      aliasIndex,
      pageNameIndex
    ),
  ]));

  return {
    id: staticPage.pageId,
    slug: `page/${staticPage.slug}`,
    title: staticPage.title,
    type: 'static',
    static: {
      pageId: staticPage.pageId,
      status: staticPage.status,
    },
    content: {
      sections,
      summary: staticPage.summary || undefined,
    },
    categories: [],
    linkedEntities,
    images: [],
    lastUpdated: staticPage.updatedAt,
  };
}

/**
 * Parse markdown content into wiki sections
 */
function buildStaticPageSections(content: string): { sections: WikiSection[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { sections: [] };
  }

  let body = trimmed;
  let pageTitle = '';

  // Extract title from first heading if present
  if (body.startsWith('# ')) {
    const lines = body.split('\n');
    pageTitle = lines[0].replace(/^#\s+/, '').trim();
    body = lines.slice(1).join('\n').trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = pageTitle || 'Content';
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join('\n').trim();
    if (!sectionBody) return;
    sections.push({
      id: `static-section-${sectionIndex}`,
      heading: currentHeading || 'Content',
      level: 2,
      content: sectionBody,
    });
    sectionIndex++;
  };

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim() || 'Content';
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  flush();

  if (sections.length === 0 && body) {
    sections.push({
      id: 'static-section-0',
      heading: pageTitle || 'Content',
      level: 2,
      content: body,
    });
  }

  return { sections };
}

/**
 * Build all chronicle pages from ChronicleRecords (IndexedDB)
 */
function buildChroniclePagesFromChronicles(
  chronicles: ChronicleRecord[],
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage[] {
  return chronicles
    .filter(chronicle => getChronicleContent(chronicle)) // Only chronicles with content
    .map((chronicle) => buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex));
}

function buildChronicleSections(
  content: string,
  imageRefs?: ChronicleImageRefs,
  worldData?: WorldState
): { sections: WikiSection[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { sections: [] };
  }

  let body = trimmed;
  if (body.startsWith('# ')) {
    const lines = body.split('\n');
    body = lines.slice(1).join('\n').trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = 'Chronicle';
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join('\n').trim();
    if (!sectionBody) return;
    sections.push({
      id: `chronicle-section-${sectionIndex}`,
      heading: currentHeading || 'Chronicle',
      level: 2,
      content: sectionBody,
    });
    sectionIndex++;
  };

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim() || 'Chronicle';
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  flush();

  if (sections.length === 0) {
    sections.push({
      id: 'chronicle-section-0',
      heading: 'Chronicle',
      level: 2,
      content: body,
    });
  }

  if (DEBUG_WIKI_BUILDER) {
    console.log('[wikiBuilder] buildChronicleSections:', {
      contentLength: content.length,
      sectionCount: sections.length,
      sectionHeadings: sections.map(s => s.heading),
      sectionLengths: sections.map(s => s.content.length),
      imageRefsCount: imageRefs?.refs?.length ?? 0,
    });
  }

  // Attach images to sections by anchor text
  if (imageRefs?.refs && worldData) {
    attachImagesToSections(sections, imageRefs.refs, worldData);
  }

  if (DEBUG_WIKI_BUILDER) {
    console.log('[wikiBuilder] After image attachment:', {
      sectionsWithImages: sections.filter(s => s.images && s.images.length > 0).length,
      imagesPerSection: sections.map(s => ({ heading: s.heading, imageCount: s.images?.length ?? 0 })),
    });
  }

  return { sections };
}

/**
 * Find which section contains the anchor text
 */
function findSectionForAnchor(
  sections: WikiSection[],
  anchorText: string
): WikiSection | null {
  if (!anchorText || sections.length === 0) {
    return sections.length > 0 ? sections[0] : null;
  }

  // Fuzzy search: find which section contains the anchor text (handles LLM paraphrases)
  for (const section of sections) {
    if (resolveAnchorPhrase(anchorText, section.content)) {
      return section;
    }
  }

  // Not found - return first section as fallback
  console.warn('[wikiBuilder] Anchor text not found in any section, using first section:', anchorText);
  return sections[0];
}

/**
 * Attach images to their corresponding sections based on anchorText
 */
function attachImagesToSections(
  sections: WikiSection[],
  refs: ChronicleImageRef[],
  worldData: WorldState
): void {
  if (DEBUG_WIKI_BUILDER) {
    console.log('[wikiBuilder] attachImagesToSections called with:', {
      sectionCount: sections.length,
      refCount: refs.length,
      refs: refs.map(r => ({
        refId: r.refId,
        type: r.type,
        status: r.status,
        anchorText: r.anchorText?.slice(0, 50),
        anchorIndex: r.anchorIndex,
        size: r.size,
        hasGeneratedImageId: !!r.generatedImageId,
      })),
    });
  }

  for (const ref of refs) {
    // Skip prompt requests that aren't complete
    if (ref.type === 'prompt_request' && ref.status !== 'complete') {
      console.warn('[wikiBuilder] Skipping incomplete prompt_request:', ref.refId, ref.status);
      continue;
    }

    // Find the target section by anchor text
    const section = findSectionForAnchor(sections, ref.anchorText);
    if (!section) {
      console.warn('[wikiBuilder] Could not find section for anchor:', ref.anchorText, ref);
      continue;
    }

    // Resolve the image ID
    let imageId: string | undefined;
    if (ref.type === 'entity_ref' && ref.entityId) {
      // Look up entity's image
      const entity = worldData.hardState.find(e => e.id === ref.entityId);
      imageId = entity?.enrichment?.image?.imageId;
      if (!imageId) {
        console.warn('[wikiBuilder] entity_ref has no image:', ref.refId, ref.entityId);
      }
    } else if (ref.type === 'prompt_request' && ref.generatedImageId) {
      imageId = ref.generatedImageId;
    } else if (ref.type === 'prompt_request') {
      console.warn('[wikiBuilder] prompt_request missing generatedImageId:', ref.refId, ref);
    }

    if (!imageId) continue;

    if (DEBUG_WIKI_BUILDER) {
      console.log('[wikiBuilder] Attaching image:', {
        refId: ref.refId,
        type: ref.type,
        imageId,
        anchorText: ref.anchorText?.slice(0, 50),
        toSection: section.heading,
        sectionContentPreview: section.content.slice(0, 100),
      });
    }

    // Initialize images array if needed
    if (!section.images) {
      section.images = [];
    }

    // Add the image to the section
    const sectionImage: WikiSectionImage = {
      refId: ref.refId,
      type: ref.type === 'entity_ref' ? 'entity_ref' : 'chronicle_image',
      entityId: ref.type === 'entity_ref' ? ref.entityId : undefined,
      imageId,
      anchorText: ref.anchorText,
      anchorIndex: ref.anchorIndex,
      size: ref.size,
      justification: ref.justification,
      caption: ref.caption,
    };

    section.images.push(sectionImage);
  }
}

/**
 * Build a single entity page
 */
function buildEntityPage(
  entity: HardState,
  worldData: WorldState,
  loreIndex: Map<string, LoreRecord[]>,
  imageIndex: Map<string, ImageInfo>,
  aliasIndex: Map<string, string>,
  prominenceScale: ProminenceScale,
  chronicles: ChronicleRecord[] = []
): WikiPage {
  const entityLore = loreIndex.get(entity.id) || [];
  // Summary and description are now directly on entity
  const summary = entity.summary || '';
  // Aliases are in enrichment.text
  const aliases = Array.isArray(entity.enrichment?.text?.aliases)
    ? entity.enrichment.text.aliases
      .filter((alias): alias is string => typeof alias === 'string')
      .map((alias) => alias.trim())
      .filter(Boolean)
    : [];
  const eraChapter = entityLore.find(l => l.type === 'era_chapter');
  const entityChronicle = entityLore.find(l => l.type === 'entity_chronicle');
  const enhancedPage = entityLore.find(l => l.type === 'enhanced_entity_page');

  // Get relationships
  const relationships = worldData.relationships.filter(
    r => r.src === entity.id || r.dst === entity.id
  );

  // Build sections
  const sections: WikiSection[] = [];
  let sectionIndex = 0;

  // Prefer enhanced page with structured sections, fall back to entity.description
  if (enhancedPage?.wikiContent?.sections && enhancedPage.wikiContent.sections.length > 0) {
    // Use structured sections from enhanced page
    for (const section of enhancedPage.wikiContent.sections) {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: section.heading,
        level: section.level || 2,
        content: section.content,
      });
    }
  } else if (entity.description) {
    // Use entity's description field (now stored directly on entity)
    const backrefs = entity.enrichment?.chronicleBackrefs || [];

    // Attach images from backref chronicles using per-backref config
    const backrefImages: WikiSectionImage[] = [];
    for (const backref of backrefs) {
      const chronicle = chronicles.find(c => c.chronicleId === backref.chronicleId);
      if (!chronicle) continue;

      const imageId = resolveBackrefImageId(backref, chronicle, worldData.hardState);
      if (imageId) {
        backrefImages.push({
          refId: `backref-${backref.chronicleId}`,
          type: 'chronicle_image',
          imageId,
          anchorText: backref.anchorPhrase,
          size: backref.imageSize || 'medium',
          justification: backref.imageAlignment || 'left',
          caption: chronicle.title,
        });
      }
    }

    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Overview',
      level: 2,
      content: injectBackrefFootnotes(entity.description, backrefs),
      images: backrefImages.length > 0 ? backrefImages : undefined,
    });
  }

  // Long-form chronicle for mythic entities
  if (entityChronicle?.text) {
    // If chronicle has structured sections from wikiContent, use those
    if (entityChronicle.wikiContent?.sections && entityChronicle.wikiContent.sections.length > 0) {
      for (const section of entityChronicle.wikiContent.sections) {
        sections.push({
          id: `section-${sectionIndex++}`,
          heading: section.heading,
          level: section.level || 2,
          content: section.content,
        });
      }
    } else {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: 'Chronicle',
        level: 2,
        content: entityChronicle.text,
      });
    }
  }

  // Era chapter content (for era entities)
  if (entity.kind === 'era' && eraChapter?.text) {
    // If chapter has structured sections from wikiContent, use those
    if (eraChapter.wikiContent?.sections && eraChapter.wikiContent.sections.length > 0) {
      for (const section of eraChapter.wikiContent.sections) {
        sections.push({
          id: `section-${sectionIndex++}`,
          heading: section.heading,
          level: section.level || 2,
          content: section.content,
        });
      }
    } else {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: 'Chronicle',
        level: 2,
        content: eraChapter.text,
      });
    }
  }

  // Relationships section
  if (relationships.length > 0) {
    const relContent = formatRelationships(entity.id, relationships, worldData);
    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Relationships',
      level: 2,
      content: relContent,
    });
  }

  // Build infobox
  const infobox = buildEntityInfobox(entity, worldData, imageIndex, prominenceScale);

  // Extract linked entities from content
  const linkedEntities = extractLinkedEntities(sections, worldData, aliasIndex);

  // Build categories for this entity
  const categories = buildEntityCategories(entity, worldData, prominenceScale);

  return {
    id: entity.id,
    slug: slugify(entity.name),
    title: entity.name,
    type: entity.kind === 'era' ? 'era' : 'entity',
    aliases: aliases.length > 0 ? aliases : undefined,
    content: {
      sections,
      summary: summary || undefined,
      infobox,
      historianNotes: (entity.enrichment?.historianNotes || [])
        .filter(n => (n.display || (n.enabled === false ? 'disabled' : 'full')) !== 'disabled')
        .map(n => ({ noteId: n.noteId, anchorPhrase: n.anchorPhrase, text: n.text, type: n.type, display: (n.display || (n.enabled === false ? 'disabled' : 'full')) as 'popout' | 'full' })),
    },
    categories,
    linkedEntities,
    images: imageIndex.has(entity.id)
      ? [{
          entityId: entity.id,
          path: imageIndex.get(entity.id)!.path,
          caption: entity.name,
          width: imageIndex.get(entity.id)!.width,
          height: imageIndex.get(entity.id)!.height,
          aspect: imageIndex.get(entity.id)!.aspect,
        }]
      : [],
    lastUpdated: entity.updatedAt || entity.createdAt,
  };
}

/**
 * Format relationships for display with expand/collapse by type
 */
function formatRelationships(
  entityId: string,
  relationships: WorldState['relationships'],
  worldData: WorldState
): string {
  const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

  // Build a map to detect bidirectional relationships
  // Key: "kind:otherId", Value: { outgoing: rel | null, incoming: rel | null }
  const relMap = new Map<string, {
    otherId: string;
    kind: string;
    outgoing: WorldState['relationships'][0] | null;
    incoming: WorldState['relationships'][0] | null;
  }>();

  for (const rel of relationships) {
    const isOutgoing = rel.src === entityId;
    const otherId = isOutgoing ? rel.dst : rel.src;
    const key = `${rel.kind}:${otherId}`;

    if (!relMap.has(key)) {
      relMap.set(key, { otherId, kind: rel.kind, outgoing: null, incoming: null });
    }
    const entry = relMap.get(key)!;
    if (isOutgoing) {
      entry.outgoing = rel;
    } else {
      entry.incoming = rel;
    }
  }

  // Build rows with direction info
  interface RelRow {
    entity: string;
    entityName: string;
    direction: '→' | '←' | '↔';
    status: string;
    since: string;
  }

  const rowsByKind = new Map<string, RelRow[]>();

  for (const [, entry] of relMap) {
    const other = entityMap.get(entry.otherId);
    if (!other) continue;

    // Determine direction
    let direction: '→' | '←' | '↔';
    let primaryRel: WorldState['relationships'][0];
    if (entry.outgoing && entry.incoming) {
      direction = '↔';
      primaryRel = entry.outgoing; // Use outgoing for metadata
    } else if (entry.outgoing) {
      direction = '→';
      primaryRel = entry.outgoing;
    } else {
      direction = '←';
      primaryRel = entry.incoming!;
    }

    const row: RelRow = {
      entity: `[[${other.name}]]`,
      entityName: other.name,
      direction,
      status: primaryRel.status || 'active',
      since: primaryRel.createdAt != null ? `Tick ${primaryRel.createdAt}` : '—',
    };

    if (!rowsByKind.has(entry.kind)) {
      rowsByKind.set(entry.kind, []);
    }
    rowsByKind.get(entry.kind)!.push(row);
  }

  // Group by (kind, direction) pair
  const byPair = new Map<string, RelRow[]>();
  for (const [kind, rows] of rowsByKind) {
    for (const row of rows) {
      const pairKey = `${kind}:${row.direction}`;
      if (!byPair.has(pairKey)) {
        byPair.set(pairKey, []);
      }
      byPair.get(pairKey)!.push(row);
    }
  }

  // Build rows for each pair, sorted by kind then direction
  const pairRows: { kind: string; direction: string; entities: string[] }[] = [];
  for (const [pairKey, rows] of byPair) {
    const [kind, direction] = pairKey.split(':');
    // Sort entities alphabetically
    const entities = rows
      .sort((a, b) => a.entityName.localeCompare(b.entityName))
      .map(r => r.entity);
    pairRows.push({ kind, direction, entities });
  }

  // Sort by kind, then by direction (↔ first, then →, then ←)
  const dirOrder = { '↔': 0, '→': 1, '←': 2 };
  pairRows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return (dirOrder[a.direction as keyof typeof dirOrder] || 0) -
           (dirOrder[b.direction as keyof typeof dirOrder] || 0);
  });

  // Build table
  const lines: string[] = [];
  lines.push('| Relation | Dir | Entities |');
  lines.push('|----------|:---:|----------|');
  for (const row of pairRows) {
    lines.push(`| ${row.kind} | ${row.direction} | ${row.entities.join(', ')} |`);
  }

  return lines.join('\n');
}

/**
 * Build infobox for an entity
 */
function buildEntityInfobox(
  entity: HardState,
  worldData: WorldState,
  imageIndex: Map<string, ImageInfo>,
  prominenceScale: ProminenceScale
): WikiInfobox {
  const fields: WikiInfobox['fields'] = [];

  fields.push({ label: 'Type', value: entity.kind });
  if (entity.subtype) {
    fields.push({ label: 'Subtype', value: entity.subtype });
  }
  fields.push({ label: 'Status', value: entity.status });
  fields.push({ label: 'Prominence', value: prominenceLabelFromScale(entity.prominence, prominenceScale) });
  if (entity.culture) {
    fields.push({ label: 'Culture', value: entity.culture });
  }

  // Find era if applicable
  const activeEra = worldData.relationships.find(
    r => r.src === entity.id && r.kind === 'active_during'
  );
  if (activeEra) {
    const era = worldData.hardState.find(e => e.id === activeEra.dst);
    if (era) {
      fields.push({ label: 'Era', value: era.name, linkedEntity: era.id });
    }
  }

  // Tags (compact display)
  if (entity.tags && Object.keys(entity.tags).length > 0) {
    const tagPairs = Object.entries(entity.tags)
      .map(([k, v]) => (v === true ? k : `${k}:${v}`))
      .join(', ');
    fields.push({ label: 'Tags', value: tagPairs });
  }

  // Region (if any) - look up region name and link to region page
  if (entity.regionId) {
    const regionInfo = findRegionById(worldData, entity.regionId);
    if (regionInfo) {
      fields.push({
        label: 'Region',
        value: regionInfo.region.label,
        linkedEntity: `region:${entity.regionId}`
      });
    } else {
      fields.push({ label: 'Region', value: entity.regionId });
    }
  }

  // Coordinates (compact)
  if (entity.coordinates) {
    const { x, y, z } = entity.coordinates;
    const coordStr = `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
    fields.push({ label: 'Coords', value: coordStr });
  }

  const imageInfo = imageIndex.get(entity.id);
  return {
    type: entity.kind === 'era' ? 'era' : 'entity',
    fields,
    image: imageInfo
      ? {
          entityId: entity.id,
          path: imageInfo.path,
          width: imageInfo.width,
          height: imageInfo.height,
          aspect: imageInfo.aspect,
        }
      : undefined,
  };
}

/**
 * Build categories for an entity
 */
function buildEntityCategories(
  entity: HardState,
  worldData: WorldState,
  prominenceScale: ProminenceScale
): string[] {
  const categories: string[] = [];

  // By kind
  categories.push(`kind-${entity.kind}`);

  // By subtype
  if (entity.subtype) {
    categories.push(`subtype-${entity.subtype}`);
  }

  // By culture
  if (entity.culture) {
    categories.push(`culture-${entity.culture}`);
  }

  // By prominence
  categories.push(`prominence-${prominenceLabelFromScale(entity.prominence, prominenceScale)}`);

  // By status
  categories.push(`status-${entity.status}`);

  // By era
  const activeEra = worldData.relationships.find(
    r => r.src === entity.id && r.kind === 'active_during'
  );
  if (activeEra) {
    categories.push(`era-${activeEra.dst}`);
  }

  return categories;
}

/**
 * Build all categories from pages
 */
export function buildCategories(
  _worldData: WorldState,
  pages: WikiPage[]
): WikiCategory[] {
  void _worldData; // Reserved for future category enrichment
  const categoryMap = new Map<string, WikiCategory>();

  // Collect all category IDs from pages
  for (const page of pages) {
    for (const catId of page.categories) {
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: formatCategoryName(catId),
          type: 'auto',
          pageCount: 0,
        });
      }
      categoryMap.get(catId)!.pageCount++;
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) => b.pageCount - a.pageCount);
}

/**
 * Build a category page
 */
function buildCategoryPage(category: WikiCategory, pages: WikiPage[]): WikiPage {
  const pagesInCategory = pages.filter(p => p.categories.includes(category.id));

  const content = pagesInCategory
    .map(p => `- [[${p.title}]]`)
    .join('\n');

  return {
    id: `category-${category.id}`,
    slug: `category/${slugify(category.name)}`,
    title: `Category: ${category.name}`,
    type: 'category',
    content: {
      sections: [
        {
          id: 'pages',
          heading: 'Pages',
          level: 2,
          content,
        },
      ],
    },
    categories: [],
    linkedEntities: pagesInCategory.map(p => p.id),
    images: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Build a region page showing all entities in that region
 */
function buildRegionPage(
  region: Region,
  entityKind: string,
  worldData: WorldState,
  _aliasIndex: Map<string, string>
): WikiPage {
  // Find all entities in this region
  const entitiesInRegion = worldData.hardState.filter(
    e => e.regionId === region.id || e.allRegionIds?.includes(region.id)
  );

  // Group entities by kind
  const byKind = new Map<string, HardState[]>();
  for (const entity of entitiesInRegion) {
    if (!byKind.has(entity.kind)) {
      byKind.set(entity.kind, []);
    }
    byKind.get(entity.kind)!.push(entity);
  }

  // Build sections
  const sections: WikiSection[] = [];

  // Overview section
  const overviewLines: string[] = [];
  if (region.description) {
    overviewLines.push(region.description);
  }
  if (region.culture) {
    const culture = worldData.schema.cultures.find(c => c.id === region.culture);
    overviewLines.push(`**Culture:** ${culture?.name ?? region.culture}`);
  }
  overviewLines.push(`**Entity Kind:** ${entityKind}`);
  overviewLines.push(`**Total Entities:** ${entitiesInRegion.length}`);

  sections.push({
    id: 'overview',
    heading: 'Overview',
    level: 2,
    content: overviewLines.join('\n\n'),
  });

  // Entities section with table per kind
  for (const [kind, entities] of byKind) {
    const rows = entities
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => `| [[${e.name}]] | ${e.subtype} | ${e.status} |`)
      .join('\n');

    const tableContent = `| Name | Subtype | Status |\n|------|---------|--------|\n${rows}`;

    sections.push({
      id: `entities-${kind}`,
      heading: capitalize(kind),
      level: 2,
      content: tableContent,
    });
  }

  return {
    id: `region:${region.id}`,
    slug: `region/${slugify(region.label)}`,
    title: region.label,
    type: 'region',
    content: {
      sections,
      summary: region.description,
    },
    categories: [`region-${entityKind}`],
    linkedEntities: entitiesInRegion.map(e => e.id),
    images: [],
    lastUpdated: region.createdAt ?? Date.now(),
  };
}

/**
 * Format category ID to display name
 */
function formatCategoryName(catId: string): string {
  // Remove prefix and capitalize
  const parts = catId.split('-');
  if (parts.length >= 2) {
    const type = parts[0];
    const value = parts.slice(1).join('-');
    return `${capitalize(type)}: ${capitalize(value.replace(/_/g, ' '))}`;
  }
  return capitalize(catId.replace(/_/g, ' '));
}

/**
 * Extract linked page IDs from content (entities and static pages)
 *
 * @param pageNameIndex - Map of lowercase name -> page ID (includes entities and static pages)
 */
function extractLinkedEntities(
  sections: WikiSection[],
  worldData: WorldState,
  aliasIndex: Map<string, string>,
  pageNameIndex?: Map<string, string>
): string[] {
  const linked: Set<string> = new Set();
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  for (const section of sections) {
    // Find [[Entity Name]] patterns
    const matches = section.content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      const name = match[1].toLowerCase().trim();
      // Check entity names first
      const directId = entityByName.get(name);
      if (directId) {
        linked.add(directId);
        continue;
      }
      // Check entity aliases
      const aliasId = aliasIndex.get(name);
      if (aliasId) {
        linked.add(aliasId);
        continue;
      }
      // Check static page titles (via pageNameIndex which includes both)
      if (pageNameIndex) {
        const pageId = pageNameIndex.get(name);
        if (pageId) {
          linked.add(pageId);
        }
      }
    }
  }

  return Array.from(linked);
}

/**
 * Build index of lore records by target entity
 */
function buildLoreIndex(loreData: LoreData | null): Map<string, LoreRecord[]> {
  const index = new Map<string, LoreRecord[]>();
  if (!loreData) return index;

  for (const record of loreData.records) {
    if (record.targetId) {
      if (!index.has(record.targetId)) {
        index.set(record.targetId, []);
      }
      index.get(record.targetId)!.push(record);
    }
  }

  return index;
}

/**
 * Image info with path and optional dimensions
 * Used for aspect-aware display of images
 */
interface ImageInfo {
  path: string;
  width?: number;
  height?: number;
  aspect?: ImageAspect;
}

/**
 * Build index of entity images with dimension data
 * Handles both file paths and object URLs
 * Includes dimensions from imageData or entity enrichment for aspect-aware display
 */
function buildImageIndex(
  worldData: WorldState,
  imageData: ImageMetadata | null
): Map<string, ImageInfo> {
  const index = new Map<string, ImageInfo>();
  if (!imageData) return index;

  const imageById = new Map(imageData.results.map((img) => [img.imageId, img]));

  for (const entity of worldData.hardState) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (!imageId) continue;

    const img = imageById.get(imageId);
    if (!img?.localPath) continue;

    // If it's already an object URL (blob:) or data URL, use it directly
    // Otherwise transform file path to web path
    const path = img.localPath;
    const webPath = path.startsWith('blob:') || path.startsWith('data:')
      ? path
      : path.replace('output/images/', 'images/');

    // Get dimensions from imageData results (entity.enrichment.image only has imageId)
    const width = img.width;
    const height = img.height;
    const aspect = img.aspect;

    index.set(entity.id, { path: webPath, width, height, aspect });
  }

  return index;
}

/**
 * Build index of entity aliases to entity IDs
 * Aliases are now stored in entity.enrichment.text.aliases
 */
function buildAliasIndex(worldData: WorldState): Map<string, string> {
  const index = new Map<string, string>();

  for (const entity of worldData.hardState) {
    const aliases = Array.isArray(entity.enrichment?.text?.aliases)
      ? entity.enrichment.text.aliases
      : [];

    for (const alias of aliases) {
      if (typeof alias !== 'string') continue;
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      if (!index.has(normalized)) {
        index.set(normalized, entity.id);
      }
    }
  }

  return index;
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Capitalize first letter
 */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ============================================================================
// Conflux Functions - Build system/action activity pages
// ============================================================================

/**
 * Build an index of all confluxes (systems/actions) from narrative history.
 * Groups events by their causedBy.actionType and aggregates statistics.
 */
export function buildConfluxIndex(
  narrativeHistory: NarrativeEvent[]
): Map<string, ConfluxSummary> {
  const confluxMap = new Map<string, ConfluxSummary>();

  for (const event of narrativeHistory) {
    // Skip events without causedBy info
    if (!event.causedBy?.actionType) continue;

    // Skip failed action attempts - only count successful manifestations
    // (failed actions still generate prominence change events, but shouldn't inflate frequency)
    if (event.causedBy.success === false) continue;

    // Parse the action type to get conflux ID and source type
    // Format: "system:corruption_harm" or "action:cleanse_corruption" or "template:hero_emergence"
    // May also have entity suffix: "system:corruption_harm:npc_123"
    const actionType = event.causedBy.actionType;
    let sourceType: 'system' | 'action' | 'template' = 'system';
    let confluxId: string;

    if (actionType.startsWith('system:')) {
      sourceType = 'system';
      confluxId = actionType.substring(7); // Remove "system:" prefix
    } else if (actionType.startsWith('action:')) {
      sourceType = 'action';
      confluxId = actionType.substring(7); // Remove "action:" prefix
    } else if (actionType.startsWith('template:')) {
      sourceType = 'template';
      confluxId = actionType.substring(9); // Remove "template:" prefix
    } else {
      // Assume it's a template ID without prefix
      sourceType = 'template';
      confluxId = actionType;
    }

    // Strip entity suffix if present (e.g., "corruption_harm:npc_123" -> "corruption_harm")
    const colonIndex = confluxId.indexOf(':');
    if (colonIndex > 0) {
      confluxId = confluxId.substring(0, colonIndex);
    }

    // Get or create summary
    let summary = confluxMap.get(confluxId);
    if (!summary) {
      summary = {
        confluxId,
        name: formatConfluxName(confluxId),
        sourceType,
        manifestations: 0,
        touchedEntityIds: [],
        effectCounts: {},
        tagsAdded: [],
        tagsRemoved: [],
        relationshipsCreated: [],
        relationshipsEnded: [],
        tickRange: { first: event.tick, last: event.tick },
      };
      confluxMap.set(confluxId, summary);
    }

    // Update statistics
    summary.manifestations++;
    summary.tickRange.first = Math.min(summary.tickRange.first, event.tick);
    summary.tickRange.last = Math.max(summary.tickRange.last, event.tick);

    // Collect touched entities and effects from participantEffects
    const touchedSet = new Set(summary.touchedEntityIds);
    const tagsAddedSet = new Set(summary.tagsAdded);
    const tagsRemovedSet = new Set(summary.tagsRemoved);
    const relCreatedSet = new Set(summary.relationshipsCreated);
    const relEndedSet = new Set(summary.relationshipsEnded);

    for (const participant of event.participantEffects ?? []) {
      touchedSet.add(participant.entity.id);

      for (const effect of participant.effects ?? []) {
        // Count effect types
        summary.effectCounts[effect.type] = (summary.effectCounts[effect.type] || 0) + 1;

        // Track tags
        if (effect.type === 'tag_gained' && effect.tag) {
          tagsAddedSet.add(effect.tag);
        } else if (effect.type === 'tag_lost' && effect.tag) {
          tagsRemovedSet.add(effect.tag);
        }

        // Track relationships
        if (effect.type === 'relationship_formed' && effect.relationshipKind) {
          relCreatedSet.add(effect.relationshipKind);
        } else if (effect.type === 'relationship_ended' && effect.relationshipKind) {
          relEndedSet.add(effect.relationshipKind);
        }
      }
    }

    summary.touchedEntityIds = Array.from(touchedSet);
    summary.tagsAdded = Array.from(tagsAddedSet);
    summary.tagsRemoved = Array.from(tagsRemovedSet);
    summary.relationshipsCreated = Array.from(relCreatedSet);
    summary.relationshipsEnded = Array.from(relEndedSet);
  }

  return confluxMap;
}

/**
 * Format a conflux ID into a display name.
 * e.g., "corruption_harm" -> "Corruption Harm"
 */
function formatConfluxName(confluxId: string): string {
  return confluxId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Map internal source types to in-universe terminology:
 * - system → "Tide" (recurring background force)
 * - action → "Deed" (deliberate act by an entity)
 * - template → "Emergence" (things coming into being)
 */
function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    system: 'Tide',
    action: 'Deed',
    template: 'Emergence',
  };
  return labels[sourceType] || sourceType;
}

/**
 * Detect convergences between complementary confluxes.
 * A convergence exists when one conflux adds a tag/relationship that another removes.
 */
export function detectConvergences(
  confluxIndex: Map<string, ConfluxSummary>,
  narrativeHistory: NarrativeEvent[]
): ConvergenceResult[] {
  const convergences: ConvergenceResult[] = [];
  const processedPairs = new Set<string>();

  const confluxes = Array.from(confluxIndex.values());

  for (const confluxA of confluxes) {
    for (const confluxB of confluxes) {
      if (confluxA.confluxId === confluxB.confluxId) continue;

      // Create a canonical pair key to avoid duplicates
      const pairKey = [confluxA.confluxId, confluxB.confluxId].sort().join('|');
      if (processedPairs.has(pairKey)) continue;

      // Check for tag complementarity: A adds what B removes
      const tagOverlap = confluxA.tagsAdded.filter(tag => confluxB.tagsRemoved.includes(tag));

      // Check for relationship complementarity: A creates what B ends
      const relOverlap = confluxA.relationshipsCreated.filter(rel =>
        confluxB.relationshipsEnded.includes(rel)
      );

      if (tagOverlap.length > 0 || relOverlap.length > 0) {
        processedPairs.add(pairKey);

        // Find entities that went through both confluxes
        const journeys = buildEntityJourneys(confluxA, confluxB, narrativeHistory);

        if (journeys.length > 0) {
          convergences.push({
            confluxes: [confluxA.confluxId, confluxB.confluxId],
            confluxNames: [confluxA.name, confluxB.name],
            journeys,
          });
        }
      }
    }
  }

  return convergences;
}

/**
 * Build entity journeys through a pair of complementary confluxes.
 */
function buildEntityJourneys(
  confluxA: ConfluxSummary,
  confluxB: ConfluxSummary,
  narrativeHistory: NarrativeEvent[]
): EntityConvergence[] {
  // Find entities that appear in both confluxes
  const sharedEntityIds = confluxA.touchedEntityIds.filter(id =>
    confluxB.touchedEntityIds.includes(id)
  );

  if (sharedEntityIds.length === 0) return [];

  // Group events by conflux
  const eventsByConflux = new Map<string, NarrativeEvent[]>();

  for (const event of narrativeHistory) {
    if (!event.causedBy?.actionType) continue;

    const actionType = event.causedBy.actionType;
    let confluxId = actionType;

    // Strip prefix
    if (actionType.startsWith('system:')) confluxId = actionType.substring(7);
    else if (actionType.startsWith('action:')) confluxId = actionType.substring(7);
    else if (actionType.startsWith('template:')) confluxId = actionType.substring(9);

    // Strip entity suffix
    const colonIndex = confluxId.indexOf(':');
    if (colonIndex > 0) confluxId = confluxId.substring(0, colonIndex);

    if (!eventsByConflux.has(confluxId)) {
      eventsByConflux.set(confluxId, []);
    }
    eventsByConflux.get(confluxId)!.push(event);
  }

  const confluxAEvents = eventsByConflux.get(confluxA.confluxId) ?? [];
  const confluxBEvents = eventsByConflux.get(confluxB.confluxId) ?? [];

  // Build journeys for shared entities
  const journeys: EntityConvergence[] = [];

  for (const entityId of sharedEntityIds) {
    // Find events where this entity participated
    const aEvents = confluxAEvents.filter(e =>
      e.participantEffects?.some(p => p.entity.id === entityId)
    );
    const bEvents = confluxBEvents.filter(e =>
      e.participantEffects?.some(p => p.entity.id === entityId)
    );

    if (aEvents.length > 0 || bEvents.length > 0) {
      // Get entity name from first event
      const firstEvent = aEvents[0] ?? bEvents[0];
      const participant = firstEvent?.participantEffects?.find(p => p.entity.id === entityId);

      journeys.push({
        entityId,
        entityName: participant?.entity.name ?? entityId,
        entityKind: participant?.entity.kind ?? 'unknown',
        confluxAEvents: aEvents.sort((a, b) => a.tick - b.tick),
        confluxBEvents: bEvents.sort((a, b) => a.tick - b.tick),
        complete: aEvents.length > 0 && bEvents.length > 0,
      });
    }
  }

  // Sort by complete (complete first), then by entity name
  return journeys.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    return a.entityName.localeCompare(b.entityName);
  });
}

/**
 * Build a conflux wiki page.
 */
function buildConfluxPage(
  confluxId: string,
  worldData: WorldState,
  _pageIndex: WikiPageIndex  // Kept for API consistency with other page builders
): WikiPage | null {
  const narrativeHistory = worldData.narrativeHistory ?? [];
  const confluxIndex = buildConfluxIndex(narrativeHistory);

  // Build entity lookup from hardState for resolving current names
  // Narrative history stores snapshot names at event time, which may differ from
  // the entity's current name. Using hardState names ensures link resolution works.
  const entityById = new Map<string, HardState>();
  for (const entity of worldData.hardState) {
    entityById.set(entity.id, entity);
  }
  const summary = confluxIndex.get(confluxId);

  if (!summary) return null;

  // Detect convergences
  const allConvergences = detectConvergences(confluxIndex, narrativeHistory);
  const relevantConvergences = allConvergences.filter(
    c => c.confluxes.includes(confluxId)
  );

  // Get events for this conflux
  const events = narrativeHistory.filter(event => {
    if (!event.causedBy?.actionType) return false;
    const actionType = event.causedBy.actionType;
    let parsedId = actionType;

    if (actionType.startsWith('system:')) parsedId = actionType.substring(7);
    else if (actionType.startsWith('action:')) parsedId = actionType.substring(7);
    else if (actionType.startsWith('template:')) parsedId = actionType.substring(9);

    const colonIndex = parsedId.indexOf(':');
    if (colonIndex > 0) parsedId = parsedId.substring(0, colonIndex);

    return parsedId === confluxId;
  }).sort((a, b) => a.tick - b.tick);

  // Count effects per entity
  const entityEffectCounts = new Map<string, { id: string; name: string; kind: string; count: number }>();
  for (const event of events) {
    for (const participant of event.participantEffects ?? []) {
      const existing = entityEffectCounts.get(participant.entity.id);
      const effectCount = participant.effects?.length ?? 0;
      if (existing) {
        existing.count += effectCount;
      } else {
        entityEffectCounts.set(participant.entity.id, {
          id: participant.entity.id,
          name: participant.entity.name,
          kind: participant.entity.kind,
          count: effectCount,
        });
      }
    }
  }

  // Top 10 most touched entities
  // Use current names from hardState for link resolution, falling back to snapshot names
  const mostTouched = Array.from(entityEffectCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(e => {
      const currentEntity = entityById.get(e.id);
      return {
        entityId: e.id,
        // Use current name from hardState for link resolution
        entityName: currentEntity?.name ?? e.name,
        entityKind: currentEntity?.kind ?? e.kind,
        effectCount: e.count,
      };
    });

  // Find related confluxes (share entities)
  const relatedConfluxes: ConfluxPageData['relatedConfluxes'] = [];
  for (const [otherId, otherSummary] of confluxIndex) {
    if (otherId === confluxId) continue;

    const sharedCount = summary.touchedEntityIds.filter(id =>
      otherSummary.touchedEntityIds.includes(id)
    ).length;

    if (sharedCount > 0) {
      const hasConvergence = relevantConvergences.some(
        c => c.confluxes.includes(otherId)
      );

      relatedConfluxes.push({
        confluxId: otherId,
        name: otherSummary.name,
        sharedCount,
        convergenceDetected: hasConvergence,
      });
    }
  }

  // Sort by shared count descending
  relatedConfluxes.sort((a, b) => b.sharedCount - a.sharedCount);

  // Build page data
  const confluxData: ConfluxPageData = {
    summary,
    events,
    relatedConfluxes,
    mostTouched,
    convergences: relevantConvergences,
  };

  // Build sections
  const sections: WikiSection[] = [];

  // Overview section
  const effectSummary = Object.entries(summary.effectCounts)
    .map(([type, count]) => `${count} ${type.replace(/_/g, ' ')}`)
    .join(', ');

  const sourceLabel = getSourceTypeLabel(summary.sourceType);
  sections.push({
    id: 'overview',
    heading: 'Overview',
    level: 2,
    content: [
      summary.description || `A ${sourceLabel.toLowerCase()} that has manifested ${summary.manifestations} times.`,
      '',
      `**Nature:** ${sourceLabel}`,
      `**Active Period:** Tick ${summary.tickRange.first} - ${summary.tickRange.last}`,
      `**Entities Touched:** ${summary.touchedEntityIds.length}`,
      effectSummary ? `**Effects:** ${effectSummary}` : '',
    ].filter(Boolean).join('\n'),
  });

  // Tags section (if any)
  if (summary.tagsAdded.length > 0 || summary.tagsRemoved.length > 0) {
    const tagLines: string[] = [];
    if (summary.tagsAdded.length > 0) {
      tagLines.push(`**Tags Added:** ${summary.tagsAdded.map(t => t.replace(/_/g, ' ')).join(', ')}`);
    }
    if (summary.tagsRemoved.length > 0) {
      tagLines.push(`**Tags Removed:** ${summary.tagsRemoved.map(t => t.replace(/_/g, ' ')).join(', ')}`);
    }

    sections.push({
      id: 'tags',
      heading: 'Tag Effects',
      level: 2,
      content: tagLines.join('\n'),
    });
  }

  // Relationships section (if any)
  if (summary.relationshipsCreated.length > 0 || summary.relationshipsEnded.length > 0) {
    const relLines: string[] = [];
    if (summary.relationshipsCreated.length > 0) {
      relLines.push(`**Relationships Created:** ${summary.relationshipsCreated.map(r => r.replace(/_/g, ' ')).join(', ')}`);
    }
    if (summary.relationshipsEnded.length > 0) {
      relLines.push(`**Relationships Ended:** ${summary.relationshipsEnded.map(r => r.replace(/_/g, ' ')).join(', ')}`);
    }

    sections.push({
      id: 'relationships',
      heading: 'Relationship Effects',
      level: 2,
      content: relLines.join('\n'),
    });
  }

  // Those Touched section
  // Use [[EntityName|entityId]] format so links can be resolved by ID
  // (some entities may exist in narrativeHistory but not in hardState)
  if (mostTouched.length > 0) {
    const touchedLines = mostTouched.map(e =>
      `- [[${e.entityName}|${e.entityId}]] (${e.entityKind}) - ${e.effectCount} effects`
    );

    sections.push({
      id: 'touched',
      heading: 'Those Most Touched',
      level: 2,
      content: touchedLines.join('\n'),
    });
  }

  // Related Forces section
  if (relatedConfluxes.length > 0) {
    const relatedLines = relatedConfluxes.slice(0, 10).map(r => {
      const convergenceNote = r.convergenceDetected ? ' *(convergence detected)*' : '';
      return `- **${r.name}** - ${r.sharedCount} shared entities${convergenceNote}`;
    });

    sections.push({
      id: 'related',
      heading: 'Related Forces',
      level: 2,
      content: relatedLines.join('\n'),
    });
  }

  // Convergences section
  if (relevantConvergences.length > 0) {
    const convergenceLines: string[] = [];
    for (const conv of relevantConvergences) {
      const otherConflux = conv.confluxes.find(c => c !== confluxId);
      const otherName = conv.confluxNames[conv.confluxes.indexOf(otherConflux!)];
      const completeJourneys = conv.journeys.filter(j => j.complete);

      convergenceLines.push(`### ${summary.name} ↔ ${otherName}`);
      convergenceLines.push(`${completeJourneys.length} entities completed this convergence:`);
      convergenceLines.push('');

      for (const journey of completeJourneys.slice(0, 5)) {
        const firstA = journey.confluxAEvents[0];
        const firstB = journey.confluxBEvents[0];
        // Use current name from hardState for link resolution, with ID fallback
        const currentEntity = entityById.get(journey.entityId);
        const entityName = currentEntity?.name ?? journey.entityName;
        // Use [[EntityName|entityId]] format so links can be resolved by ID
        convergenceLines.push(
          `- [[${entityName}|${journey.entityId}]]: tick ${firstA?.tick ?? '?'} → tick ${firstB?.tick ?? '?'}`
        );
      }

      if (completeJourneys.length > 5) {
        convergenceLines.push(`- *...and ${completeJourneys.length - 5} more*`);
      }
      convergenceLines.push('');
    }

    sections.push({
      id: 'convergences',
      heading: 'Convergences',
      level: 2,
      content: convergenceLines.join('\n'),
    });
  }

  return {
    id: `conflux:${confluxId}`,
    slug: `conflux/${slugify(confluxId)}`,
    title: summary.name,
    type: 'conflux',
    conflux: confluxData,
    content: {
      sections,
      summary: summary.description,
    },
    categories: ['conflux', `conflux-${summary.sourceType}`],
    linkedEntities: summary.touchedEntityIds,
    images: [],
    timelineEvents: events,
    lastUpdated: Date.now(),
  };
}

// =============================================================================
// HUDDLE DETECTION - Connected subgraphs of same-kind entities
// =============================================================================

/**
 * Format a huddle type ID into a human-readable display name.
 * E.g., "faction-allied_with" -> "Faction Alliances"
 */
function formatHuddleTypeName(entityKind: string, relationshipKind: string): string {
  // Capitalize and pluralize entity kind
  const entityDisplay = entityKind.charAt(0).toUpperCase() + entityKind.slice(1);

  // Convert relationship to noun form
  const relDisplay = relationshipKind
    .replace(/_/g, ' ')
    .replace(/allied with/i, 'Alliances')
    .replace(/trades with/i, 'Trade Networks')
    .replace(/enemy of/i, 'Rivalries')
    .replace(/member of/i, 'Memberships')
    .replace(/parent of/i, 'Family Trees')
    .replace(/worships/i, 'Worship Networks')
    .replace(/accomplice of/i, 'Criminal Networks')
    .replace(/protects/i, 'Protection Networks')
    .replace(/mentors/i, 'Mentorship Chains');

  // If no special case matched, use generic format
  if (relDisplay === relationshipKind.replace(/_/g, ' ')) {
    return `${entityDisplay} ${relDisplay.charAt(0).toUpperCase() + relDisplay.slice(1)} Huddles`;
  }

  return `${entityDisplay} ${relDisplay}`;
}

/**
 * Find connected components in a graph using BFS.
 * Returns array of components, each being an array of entity IDs.
 */
function findConnectedComponents(
  adjacencyList: Map<string, Set<string>>
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const nodeId of adjacencyList.keys()) {
    if (visited.has(nodeId)) continue;

    // BFS to find all nodes in this component
    const component: string[] = [];
    const queue: string[] = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adjacencyList.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Detect all huddles in the world graph.
 * A huddle is a connected subgraph where all nodes are the same entity kind
 * and all edges are the same relationship kind.
 *
 * By default, excludes historical relationships (only includes active ones).
 *
 * Returns a map of huddle type ID to HuddleType with instances.
 */
export function buildHuddleIndex(
  entities: HardState[],
  relationships: Array<{ kind: string; src: string; dst: string; strength?: number; status?: 'active' | 'historical' }>,
  options: { includeHistorical?: boolean } = {}
): { huddleTypes: Map<string, HuddleType>; instances: Map<string, HuddleInstance[]> } {
  const { includeHistorical = false } = options;
  const entityById = new Map(entities.map(e => [e.id, e]));

  // Group relationships by kind, filtering to same-kind entity pairs
  const relsByKindAndEntityKind = new Map<string, {
    entityKind: string;
    edges: Array<{ src: string; dst: string; strength?: number }>;
  }>();

  for (const rel of relationships) {
    // Skip historical relationships by default
    if (!includeHistorical && rel.status === 'historical') continue;

    const srcEntity = entityById.get(rel.src);
    const dstEntity = entityById.get(rel.dst);

    // Skip if entities don't exist or are different kinds
    if (!srcEntity || !dstEntity) continue;
    if (srcEntity.kind !== dstEntity.kind) continue;

    const key = `${srcEntity.kind}-${rel.kind}`;

    if (!relsByKindAndEntityKind.has(key)) {
      relsByKindAndEntityKind.set(key, {
        entityKind: srcEntity.kind,
        edges: [],
      });
    }

    relsByKindAndEntityKind.get(key)!.edges.push({
      src: rel.src,
      dst: rel.dst,
      strength: rel.strength,
    });
  }

  const huddleTypes = new Map<string, HuddleType>();
  const instances = new Map<string, HuddleInstance[]>();

  for (const [key, data] of relsByKindAndEntityKind) {
    const [entityKind, relationshipKind] = key.split('-', 2);

    // Build adjacency list (undirected graph)
    const adjacencyList = new Map<string, Set<string>>();

    for (const edge of data.edges) {
      if (!adjacencyList.has(edge.src)) {
        adjacencyList.set(edge.src, new Set());
      }
      if (!adjacencyList.has(edge.dst)) {
        adjacencyList.set(edge.dst, new Set());
      }
      adjacencyList.get(edge.src)!.add(edge.dst);
      adjacencyList.get(edge.dst)!.add(edge.src);
    }

    // Find connected components
    const components = findConnectedComponents(adjacencyList);

    // Filter to components with 3+ nodes (a huddle needs at least 3 to be interesting)
    const significantComponents = components.filter(c => c.length >= 3);

    if (significantComponents.length === 0) continue;

    // Sort by size descending
    significantComponents.sort((a, b) => b.length - a.length);

    // Build huddle instances
    const huddleInstances: HuddleInstance[] = significantComponents.map((component, index) => {
      // Count edges within this component
      const componentSet = new Set(component);
      let edgeCount = 0;
      for (const edge of data.edges) {
        if (componentSet.has(edge.src) && componentSet.has(edge.dst)) {
          edgeCount++;
        }
      }

      // Calculate density (for undirected graph, max edges = n*(n-1)/2)
      const maxEdges = (component.length * (component.length - 1)) / 2;
      const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

      return {
        id: `${key}-${index}`,
        huddleTypeId: key,
        size: component.length,
        entityIds: component,
        edgeCount,
        density,
      };
    });

    instances.set(key, huddleInstances);

    // Build huddle type summary
    const totalEntities = significantComponents.reduce((sum, c) => sum + c.length, 0);

    huddleTypes.set(key, {
      id: key,
      entityKind,
      relationshipKind,
      displayName: formatHuddleTypeName(entityKind, relationshipKind),
      instanceCount: significantComponents.length,
      largestSize: significantComponents[0]?.length ?? 0,
      totalEntities,
    });
  }

  return { huddleTypes, instances };
}

/**
 * Build a huddle type wiki page showing all instances of a huddle type.
 */
function buildHuddleTypePage(
  huddleTypeId: string,
  worldData: WorldState
): WikiPage | null {
  const allRelationships = worldData.relationships ?? [];
  const { huddleTypes, instances } = buildHuddleIndex(worldData.hardState, allRelationships);

  const huddleType = huddleTypes.get(huddleTypeId);
  if (!huddleType) return null;

  const huddleInstances = instances.get(huddleTypeId) ?? [];
  const entityById = new Map(worldData.hardState.map(e => [e.id, e]));

  // Build sections
  const sections: WikiSection[] = [];

  // Overview section
  sections.push({
    id: 'overview',
    heading: 'Overview',
    level: 2,
    content: [
      `A huddle of **${huddleType.entityKind}** entities connected by **${huddleType.relationshipKind.replace(/_/g, ' ')}** relationships.`,
      '',
      `**Huddles:** ${huddleType.instanceCount}`,
      `**Largest Huddle:** ${huddleType.largestSize} entities`,
      `**Total Entities:** ${huddleType.totalEntities}`,
    ].join('\n'),
  });

  // Build sections for each huddle instance (largest first)
  for (let i = 0; i < huddleInstances.length; i++) {
    const instance = huddleInstances[i];

    // Get entity details with connection counts
    const entityDetails = instance.entityIds
      .map(id => {
        const entity = entityById.get(id);
        if (!entity) return null;

        // Count connections within this huddle (only active relationships)
        let connectionCount = 0;
        for (const rel of allRelationships) {
          if (rel.status === 'historical') continue;
          if (rel.kind !== huddleType.relationshipKind) continue;
          const srcInHuddle = instance.entityIds.includes(rel.src);
          const dstInHuddle = instance.entityIds.includes(rel.dst);
          if ((rel.src === id && dstInHuddle) || (rel.dst === id && srcInHuddle)) {
            connectionCount++;
          }
        }

        return {
          id: entity.id,
          name: entity.name,
          subtype: entity.subtype,
          connectionCount,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.connectionCount - a.connectionCount);

    // Build entity list
    const entityLines = entityDetails.map(e =>
      `| [[${e.name}]] | ${e.subtype || '-'} | ${e.connectionCount} |`
    );

    const densityPercent = (instance.density * 100).toFixed(1);

    // Use the most connected entity's name for the section heading
    const mostConnectedEntity = entityDetails[0];
    const huddleName = mostConnectedEntity
      ? `${mostConnectedEntity.name}'s Huddle`
      : `Huddle ${i + 1}`;

    sections.push({
      id: `huddle-${i}`,
      heading: huddleName,
      level: 2,
      content: [
        `**Size:** ${instance.size} entities | **Connections:** ${instance.edgeCount} | **Density:** ${densityPercent}%`,
        '',
        '| Entity | Subtype | Connections |',
        '|--------|---------|-------------|',
        ...entityLines,
      ].join('\n'),
    });

    // Only show first 5 instances in detail
    if (i >= 4 && huddleInstances.length > 5) {
      const remaining = huddleInstances.length - 5;
      sections.push({
        id: 'more-huddles',
        heading: 'Additional Huddles',
        level: 2,
        content: `${remaining} more smaller huddles exist with 3+ entities each.`,
      });
      break;
    }
  }

  // Collect all linked entities
  const linkedEntities = huddleInstances.flatMap(inst => inst.entityIds);

  return {
    id: `huddle-type:${huddleTypeId}`,
    slug: `huddle/${slugify(huddleTypeId)}`,
    title: huddleType.displayName,
    type: 'huddle-type',
    content: {
      sections,
      summary: `${huddleType.instanceCount} ${huddleType.instanceCount === 1 ? 'huddle' : 'huddles'}, largest has ${huddleType.largestSize} ${huddleType.entityKind}s`,
    },
    categories: ['huddle', `huddle-${huddleType.entityKind}`],
    linkedEntities: Array.from(new Set(linkedEntities)),
    images: [],
    lastUpdated: Date.now(),
  };
}
