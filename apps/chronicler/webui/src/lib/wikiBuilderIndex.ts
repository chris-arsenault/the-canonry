/**
 * wikiBuilderIndex — page index construction for lazy wiki page building
 */

import type {
  WorldState,
  LoreData,
  PageIndexEntry,
  WikiPageIndex,
  WikiCategory,
  HardState,
  DisambiguationEntry,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import type { ChronicleRecord } from "./chronicleStorage.ts";
import { getChronicleContent } from "./chronicleStorage.ts";
import type { StaticPage } from "./staticPageStorage.ts";
import type { EraNarrativeViewRecord } from "./eraNarrativeStorage.ts";
import { applyWikiLinks } from "./entityLinking.ts";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  type ProminenceScale,
} from "@canonry/world-schema";
import {
  slugify,
  parseNamespace,
  formatCategoryName,
  buildStaticPageSlug,
  getAllRegionsFlat,
  getEntityAliases,
  extractLinkedEntities,
} from "./wikiBuilderUtils.ts";
import { buildEntityCategories } from "./wikiBuilderEntity.ts";

interface PageIndexState {
  entries: PageIndexEntry[];
  byId: Map<string, PageIndexEntry>;
  byName: Map<string, string>;
  byAlias: Map<string, string>;
  bySlug: Map<string, string>;
}

export function resolveProminenceScale(worldData: WorldState, prominenceScale: Optional<ProminenceScale>): ProminenceScale {
  if (prominenceScale) return prominenceScale;
  const values = worldData.hardState
    .map((entity) => entity.prominence)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
}

function buildEntityIndexEntry(
  entity: HardState, worldData: WorldState, resolvedProminenceScale: ProminenceScale
): { entry: PageIndexEntry; aliases: string[] } {
  const summary = entity.summary || "";
  const aliases = getEntityAliases(entity);
  const entry: PageIndexEntry = {
    id: entity.id, title: entity.name,
    type: entity.kind === "era" ? "era" : "entity",
    slug: slugify(entity.name),
    summary: summary || undefined,
    aliases: aliases.length > 0 ? aliases : undefined,
    categories: buildEntityCategories(entity, worldData, resolvedProminenceScale),
    entityKind: entity.kind, entitySubtype: entity.subtype,
    prominence: entity.prominence, culture: entity.culture,
    linkedEntities: [], lastUpdated: entity.updatedAt || entity.createdAt,
  };
  return { entry, aliases };
}

function registerEntitySlugsAndAliases(entity: HardState, aliases: string[], state: PageIndexState): void {
  const slugAliases: string[] = entity.enrichment?.slugAliases ?? [];
  for (const sa of slugAliases) {
    if (sa && !state.bySlug.has(sa)) state.bySlug.set(sa, entity.id);
  }
  for (const alias of aliases) {
    const normalized = alias.toLowerCase();
    if (!state.byName.has(normalized) && !state.byAlias.has(normalized)) {
      state.byAlias.set(normalized, entity.id);
    }
  }
}

function indexEntityEntries(
  worldData: WorldState, resolvedProminenceScale: ProminenceScale,
  eraNarrativeByEraId: Map<string, EraNarrativeViewRecord>, state: PageIndexState
): void {
  for (const entity of worldData.hardState) {
    const { entry, aliases } = buildEntityIndexEntry(entity, worldData, resolvedProminenceScale);
    const hasEraNarrative = entity.kind === "era" && eraNarrativeByEraId.has(entity.id);

    state.byId.set(entry.id, entry);
    if (!hasEraNarrative) {
      state.entries.push(entry);
      state.byName.set(entity.name.toLowerCase(), entity.id);
      const nameSlug = slugify(entity.name);
      if (nameSlug && !state.bySlug.has(nameSlug)) state.bySlug.set(nameSlug, entity.id);
    }
    registerEntitySlugsAndAliases(entity, aliases, state);
  }
}

function indexEraNarrativeEntries(eraNarrativeByEraId: Map<string, EraNarrativeViewRecord>, state: PageIndexState): void {
  for (const narrative of eraNarrativeByEraId.values()) {
    const narrativeSlug = `era-narrative/${slugify(narrative.eraName)}`;
    const entry: PageIndexEntry = {
      id: narrative.narrativeId, title: narrative.eraName, type: "era_narrative",
      slug: narrativeSlug, summary: narrative.thesis || undefined, categories: [],
      eraNarrative: {
        eraId: narrative.eraId, tone: narrative.tone, thesis: narrative.thesis,
        sourceChronicleIds: narrative.sourceChronicles.map((s) => s.chronicleId),
      },
      coverImageId: narrative.coverImage?.status === "complete" && narrative.coverImage?.generatedImageId
        ? narrative.coverImage.generatedImageId : undefined,
      linkedEntities: [], lastUpdated: narrative.updatedAt,
    };

    state.entries.push(entry);
    state.byId.set(entry.id, entry);
    state.byName.set(narrative.eraName.toLowerCase(), narrative.narrativeId);
    if (narrativeSlug) state.bySlug.set(narrativeSlug, narrative.narrativeId);
    const bareSlug = slugify(narrative.eraName);
    if (bareSlug) state.bySlug.set(bareSlug, narrative.narrativeId);
  }
}

// eslint-disable-next-line complexity -- chronicle records have many optional fields; each branch independently checks field presence for index entry construction
function indexChronicleEntries(chronicles: ChronicleRecord[], state: PageIndexState): void {
  for (const chronicle of chronicles) {
    const content = getChronicleContent(chronicle);
    if (!content) continue;
    const title = chronicle.title;
    const titleSlug = slugify(title);
    const chronicleSlug = titleSlug ? `chronicle/${titleSlug}` : "";

    const entry: PageIndexEntry = {
      id: chronicle.chronicleId, title, type: "chronicle", slug: chronicleSlug,
      summary: chronicle.summary || undefined, categories: [],
      chronicle: {
        format: chronicle.format, entrypointId: chronicle.entrypointId,
        narrativeStyleId: chronicle.narrativeStyleId,
        roleAssignments: chronicle.roleAssignments,
        selectedEventIds: chronicle.selectedEventIds,
        selectedRelationshipIds: chronicle.selectedRelationshipIds,
        temporalContext: chronicle.temporalContext,
      },
      coverImageId: chronicle.coverImage?.status === "complete" && chronicle.coverImage?.generatedImageId
        ? chronicle.coverImage.generatedImageId : undefined,
      linkedEntities: chronicle.selectedEntityIds,
      lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
    };

    state.entries.push(entry);
    state.byId.set(entry.id, entry);
    if (chronicleSlug && !state.bySlug.has(chronicleSlug)) state.bySlug.set(chronicleSlug, entry.id);
  }
}

function buildLinkableNames(worldData: WorldState, staticPages: StaticPage[]): Array<{ name: string; id: string }> {
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) linkableNames.push({ name: entity.name, id: entity.id });
  for (const staticPage of staticPages) {
    const { baseName } = parseNamespace(staticPage.title);
    linkableNames.push({ name: baseName, id: staticPage.pageId });
    if (baseName !== staticPage.title) linkableNames.push({ name: staticPage.title, id: staticPage.pageId });
  }
  for (const { region } of getAllRegionsFlat(worldData)) {
    linkableNames.push({ name: region.label, id: `region:${region.id}` });
  }
  return linkableNames;
}

function extractChronicleBacklinks(
  chronicles: ChronicleRecord[], entries: PageIndexEntry[],
  linkableNames: Array<{ name: string; id: string }>,
  worldData: WorldState, byAlias: Map<string, string>, byName: Map<string, string>
): void {
  if (chronicles.length === 0) return;
  const chronicleById = new Map(chronicles.map((c) => [c.chronicleId, c]));
  for (const entry of entries) {
    if (entry.type !== "chronicle") continue;
    const chronicle = chronicleById.get(entry.id);
    if (!chronicle) continue;
    const linked = new Set(entry.linkedEntities);
    if (chronicle.entrypointId) linked.add(chronicle.entrypointId);
    const content = getChronicleContent(chronicle);
    if (content) {
      const linkedContent = applyWikiLinks(content, linkableNames);
      extractLinkedEntities(
        [{ id: "temp", heading: "", level: 2, content: linkedContent }],
        worldData, byAlias, byName
      ).forEach((id) => linked.add(id));
    }
    entry.linkedEntities = Array.from(linked);
  }
}

function resolveStaticPageLinks(
  content: string, entityByName: Map<string, string>,
  byAlias: Map<string, string>, byName: Map<string, string>
): string[] {
  const resolvedLinkedIds: Set<string> = new Set();
  // eslint-disable-next-line sonarjs/slow-regex -- character-class bounded, no backtracking
  const linkMatches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const match of linkMatches) {
    const nameLower = match[1].toLowerCase().trim();
    const entityId = entityByName.get(nameLower);
    if (entityId) { resolvedLinkedIds.add(entityId); continue; }
    const aliasId = byAlias.get(nameLower);
    if (aliasId) { resolvedLinkedIds.add(aliasId); continue; }
    const pageId = byName.get(nameLower);
    if (pageId) resolvedLinkedIds.add(pageId);
  }
  return Array.from(resolvedLinkedIds);
}

// eslint-disable-next-line complexity -- two-pass indexing: first registers page names for link resolution, then builds entries with resolved cross-references
function indexStaticPageEntries(
  staticPages: StaticPage[], linkableNames: Array<{ name: string; id: string }>,
  entityByName: Map<string, string>, state: PageIndexState
): void {
  for (const staticPage of staticPages) {
    state.byName.set(staticPage.title.toLowerCase(), staticPage.pageId);
    const { baseName } = parseNamespace(staticPage.title);
    const baseNameLower = baseName.toLowerCase();
    if (baseNameLower !== staticPage.title.toLowerCase() && !state.byName.has(baseNameLower)) {
      state.byName.set(baseNameLower, staticPage.pageId);
    }
  }

  for (const staticPage of staticPages) {
    const linkedContent = applyWikiLinks(staticPage.content, linkableNames);
    const linkedEntities = resolveStaticPageLinks(linkedContent, entityByName, state.byAlias, state.byName);

    const entry: PageIndexEntry = {
      id: staticPage.pageId, title: staticPage.title, type: "static",
      slug: buildStaticPageSlug(staticPage), summary: staticPage.summary || undefined, categories: [],
      static: { pageId: staticPage.pageId, status: staticPage.status },
      linkedEntities, lastUpdated: staticPage.updatedAt,
    };

    state.entries.push(entry);
    state.byId.set(entry.id, entry);
    if (entry.slug && !state.bySlug.has(entry.slug)) state.bySlug.set(entry.slug, entry.id);
    const legacySlug = staticPage.slug ? `page/${staticPage.slug}` : "";
    if (legacySlug && !state.bySlug.has(legacySlug)) state.bySlug.set(legacySlug, entry.id);
  }
}

function indexCategoryEntries(entries: PageIndexEntry[], state: PageIndexState): WikiCategory[] {
  const categoryMap = new Map<string, { id: string; name: string; pageCount: number }>();
  for (const entry of entries) {
    for (const catId of entry.categories) {
      if (!categoryMap.has(catId)) categoryMap.set(catId, { id: catId, name: formatCategoryName(catId), pageCount: 0 });
      categoryMap.get(catId)!.pageCount++;
    }
  }
  const categories: WikiCategory[] = Array.from(categoryMap.values())
    .map((cat) => ({ ...cat, type: "auto" as const }))
    .sort((a, b) => b.pageCount - a.pageCount);

  for (const category of categories) {
    const entry: PageIndexEntry = {
      id: `category-${category.id}`, title: `Category: ${category.name}`,
      type: "category", slug: `category/${slugify(category.name)}`, categories: [],
      linkedEntities: entries.filter((e) => e.categories.includes(category.id)).map((e) => e.id),
      lastUpdated: Date.now(),
    };
    entries.push(entry);
    state.byId.set(entry.id, entry);
  }
  return categories;
}

function indexRegionEntries(worldData: WorldState, state: PageIndexState): void {
  for (const { region, entityKind } of getAllRegionsFlat(worldData)) {
    const regionPageId = `region:${region.id}`;
    const entitiesInRegion = worldData.hardState.filter(
      (e) => e.regionId === region.id || e.allRegionIds?.includes(region.id)
    );
    const entry: PageIndexEntry = {
      id: regionPageId, title: region.label, type: "region",
      slug: `region/${slugify(region.label)}`, summary: region.description,
      categories: [`region-${entityKind}`],
      linkedEntities: entitiesInRegion.map((e) => e.id),
      lastUpdated: region.createdAt ?? Date.now(),
    };
    state.entries.push(entry);
    state.byId.set(entry.id, entry);
    const labelLower = region.label.toLowerCase();
    if (!state.byName.has(labelLower)) state.byName.set(labelLower, regionPageId);
  }
}

function buildDisambiguationIndex(entries: PageIndexEntry[]): Map<string, DisambiguationEntry[]> {
  const byBaseName = new Map<string, DisambiguationEntry[]>();
  for (const entry of entries) {
    if (entry.type === "category") continue;
    const { namespace, baseName } = parseNamespace(entry.title);
    const baseNameLower = baseName.toLowerCase();
    if (!byBaseName.has(baseNameLower)) byBaseName.set(baseNameLower, []);
    byBaseName.get(baseNameLower)!.push({
      pageId: entry.id, title: entry.title, namespace, type: entry.type, entityKind: entry.entityKind,
    });
  }
  for (const [baseName, pages] of byBaseName) {
    if (pages.length <= 1) byBaseName.delete(baseName);
  }
  return byBaseName;
}

export function buildPageIndex(
  worldData: WorldState, _loreData: LoreData | null,
  chronicles: ChronicleRecord[] = [], staticPages: StaticPage[] = [],
  prominenceScale: Optional<ProminenceScale>, eraNarratives: EraNarrativeViewRecord[] = []
): WikiPageIndex {
  const resolvedPS = resolveProminenceScale(worldData, prominenceScale);
  const state: PageIndexState = {
    entries: [], byId: new Map(), byName: new Map(), byAlias: new Map(), bySlug: new Map(),
  };
  const entityByName = new Map(worldData.hardState.map((e) => [e.name.toLowerCase(), e.id]));
  const eraNarrativeByEraId = new Map<string, EraNarrativeViewRecord>();
  for (const narrative of eraNarratives) {
    if (narrative.status === "complete" && narrative.content) eraNarrativeByEraId.set(narrative.eraId, narrative);
  }

  indexEntityEntries(worldData, resolvedPS, eraNarrativeByEraId, state);
  indexEraNarrativeEntries(eraNarrativeByEraId, state);
  indexChronicleEntries(chronicles, state);
  const linkableNames = buildLinkableNames(worldData, staticPages);
  extractChronicleBacklinks(chronicles, state.entries, linkableNames, worldData, state.byAlias, state.byName);
  indexStaticPageEntries(staticPages, linkableNames, entityByName, state);
  const categories = indexCategoryEntries(state.entries, state);
  indexRegionEntries(worldData, state);
  const byBaseName = buildDisambiguationIndex(state.entries);

  return { entries: state.entries, byId: state.byId, byName: state.byName, byAlias: state.byAlias, bySlug: state.bySlug, categories, byBaseName };
}
