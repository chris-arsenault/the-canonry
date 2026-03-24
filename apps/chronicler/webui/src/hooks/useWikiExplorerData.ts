/**
 * useWikiExplorerData - Manages data loading, validation, indexing, and page caching
 * for the WikiExplorer component.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  WorldState,
  LoreData,
  WikiPage,
  WikiPageIndex,
  HardState,
  SerializedPageIndex,
  PageIndexEntry,
  DisambiguationEntry,
} from "../types/world.ts";
import { buildPageIndex, buildPageById } from "../lib/wikiBuilder.ts";
import {
  getCompletedChroniclesForSimulation,
  getChronicle,
  type ChronicleRecord,
} from "../lib/chronicleStorage.ts";
import { getPublishedStaticPagesForProject, type StaticPage } from "../lib/staticPageStorage.ts";
import {
  getCompletedEraNarrativesForSimulation,
  type EraNarrativeViewRecord,
} from "../lib/eraNarrativeStorage.ts";
import { getPageLayoutMap } from "../lib/pageLayoutStorage.ts";
import { getFinalizedPageMap, type FinalizedPageRecord } from "../lib/finalizedPageStorage.ts";
import type { PageLayoutOverride } from "../types/world.ts";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  type ProminenceScale,
} from "@canonry/world-schema";

function normalizeChronicles(records: Optional<ChronicleRecord[]>): ChronicleRecord[] {
  if (!records) return [];
  return records
    .filter((record) => record && record.chronicleId && record.title)
    .map((record) => ({
      ...record,
      roleAssignments: record.roleAssignments ?? [],
      selectedEntityIds: record.selectedEntityIds ?? [],
      selectedEventIds: record.selectedEventIds ?? [],
      selectedRelationshipIds: record.selectedRelationshipIds ?? [],
    }))
    .sort((a, b) => (b.acceptedAt || b.updatedAt || 0) - (a.acceptedAt || a.updatedAt || 0));
}

function normalizeStaticPages(pages: Optional<StaticPage[]>): StaticPage[] {
  if (!pages) return [];
  return pages
    .filter((page) => page && page.pageId && page.title && page.slug)
    .map((page) => ({
      ...page,
      status: page.status || "published",
    }))
    .filter((page) => page.status === "published")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function deserializePageIndex(s: SerializedPageIndex): WikiPageIndex {
  return {
    entries: s.entries,
    byId: new Map(s.entries.map((e) => [e.id, e])),
    byName: new Map(s.byName),
    byAlias: new Map(s.byAlias),
    bySlug: new Map(s.bySlug),
    categories: s.categories,
    byBaseName: new Map(s.byBaseName),
  };
}

function emptyPageIndex(): WikiPageIndex {
  return {
    entries: [],
    byId: new Map<string, PageIndexEntry>(),
    byName: new Map<string, string>(),
    byAlias: new Map<string, string>(),
    bySlug: new Map<string, string>(),
    categories: [],
    byBaseName: new Map<string, DisambiguationEntry[]>(),
  };
}

function validateWorldData(worldData: WorldState): { message: string; details: string } | null {
  for (const entity of worldData.hardState) {
    if (typeof entity.prominence !== "number") {
      const prom: unknown = entity.prominence;
      return {
        message: "Invalid entity data format",
        details:
          `Entity "${entity.name}" (${entity.id}) has prominence="${String(prom)}" (${typeof prom}). ` +
          `Expected a number (0-5). The saved simulation data may be from an older format.`,
      };
    }
  }
  return null;
}

export interface UseWikiExplorerDataOptions {
  projectId: Optional<string>;
  worldData: WorldState;
  loreData: LoreData | null;
  preloadedChronicles: Optional<ChronicleRecord[]>;
  preloadedStaticPages: Optional<StaticPage[]>;
  preloadedEraNarratives: Optional<EraNarrativeViewRecord[]>;
  precomputedPageIndex: Optional<SerializedPageIndex>;
}

function computeProminenceScale(worldData: WorldState, hasError: boolean): ProminenceScale {
  if (hasError) {
    return buildProminenceScale([], { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }
  const values = worldData.hardState
    .map((entity) => entity.prominence)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
}

function buildEntityIndex(worldData: WorldState): Map<string, HardState> {
  const entityIdx = new Map<string, HardState>();
  for (const entity of worldData.hardState) {
    entityIdx.set(entity.id, entity);
  }
  return entityIdx;
}

function convertIndexToPages(pageIndex: WikiPageIndex): WikiPage[] {
  return pageIndex.entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    slug: entry.slug,
    chronicle: entry.chronicle,
    eraNarrative: entry.eraNarrative,
    aliases: entry.aliases,
    content: { sections: [], summary: entry.summary, coverImageId: entry.coverImageId },
    categories: entry.categories,
    linkedEntities: entry.linkedEntities,
    images: [],
    lastUpdated: entry.lastUpdated,
  })) as WikiPage[];
}

function buildEraNarrativeMap(pageIndex: WikiPageIndex): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of pageIndex.entries) {
    if (entry.type === "era_narrative" && entry.eraNarrative?.eraId) {
      map.set(entry.eraNarrative.eraId, entry.id);
    }
  }
  return map;
}

// eslint-disable-next-line max-lines-per-function -- composition hook assembling data loading, validation, indexing, and caching; each step is a simple React primitive
export function useWikiExplorerData({
  projectId,
  worldData,
  loreData,
  preloadedChronicles,
  preloadedStaticPages,
  preloadedEraNarratives,
  precomputedPageIndex,
}: Readonly<UseWikiExplorerDataOptions>) {
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>(() =>
    preloadedChronicles ? normalizeChronicles(preloadedChronicles) : []
  );
  const [staticPages, setStaticPages] = useState<StaticPage[]>(() =>
    preloadedStaticPages ? normalizeStaticPages(preloadedStaticPages) : []
  );
  const [eraNarratives, setEraNarratives] = useState<EraNarrativeViewRecord[]>(
    () => preloadedEraNarratives ?? []
  );
  const [pageLayouts, setPageLayouts] = useState<Map<string, PageLayoutOverride>>(new Map());
  const [finalizedPages, setFinalizedPages] = useState<Map<string, FinalizedPageRecord>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const simulationRunId = (
    worldData as { metadata: Optional<{ simulationRunId: Optional<string> }> }
  ).metadata?.simulationRunId;

  // Load chronicles from IndexedDB (skipped when preloaded)
  useEffect(() => {
    if (preloadedChronicles) return;
    if (!simulationRunId) { setChronicles([]); return; }
    let cancelled = false;
    async function load() {
      try {
        const loaded = await getCompletedChroniclesForSimulation(simulationRunId!);
        if (!cancelled) setChronicles(normalizeChronicles(loaded));
      } catch (err) {
        console.error("[WikiExplorer] Failed to load chronicles:", err);
        if (!cancelled) setChronicles([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [preloadedChronicles, simulationRunId]);

  // Load static pages from IndexedDB (skipped when preloaded)
  useEffect(() => {
    if (preloadedStaticPages) return;
    if (!projectId) { setStaticPages([]); return; }
    let cancelled = false;
    async function load() {
      try {
        const loaded = await getPublishedStaticPagesForProject(projectId!);
        if (!cancelled) setStaticPages(normalizeStaticPages(loaded));
      } catch (err) {
        console.error("[WikiExplorer] Failed to load static pages:", err);
        if (!cancelled) setStaticPages([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [preloadedStaticPages, projectId]);

  // Load era narratives from IndexedDB (skipped when preloaded)
  useEffect(() => {
    if (preloadedEraNarratives) return;
    if (!simulationRunId) { setEraNarratives([]); return; }
    let cancelled = false;
    async function load() {
      try {
        const loaded = await getCompletedEraNarrativesForSimulation(simulationRunId!);
        if (!cancelled) setEraNarratives(loaded);
      } catch (err) {
        console.error("[WikiExplorer] Failed to load era narratives:", err);
        if (!cancelled) setEraNarratives([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [preloadedEraNarratives, simulationRunId]);

  // Load page layout overrides and finalized pages from IndexedDB
  useEffect(() => {
    if (!simulationRunId) {
      setPageLayouts(new Map());
      setFinalizedPages(new Map());
      return;
    }
    let cancelled = false;
    void Promise.all([
      getPageLayoutMap(simulationRunId),
      getFinalizedPageMap(simulationRunId),
    ]).then(([layouts, finalized]) => {
      if (cancelled) return;
      setPageLayouts(layouts);
      setFinalizedPages(finalized);
    });
    return () => { cancelled = true; };
  }, [simulationRunId]);

  const dataError = useMemo(() => validateWorldData(worldData), [worldData]);
  const prominenceScale = useMemo(
    () => computeProminenceScale(worldData, dataError !== null), [worldData, dataError]
  );

  const { pageIndex, entityIndex } = useMemo(() => {
    if (dataError) return { pageIndex: emptyPageIndex(), entityIndex: new Map<string, HardState>() };
    const idx = precomputedPageIndex
      ? deserializePageIndex(precomputedPageIndex)
      : buildPageIndex(worldData, loreData, chronicles, staticPages, prominenceScale, eraNarratives);
    return { pageIndex: idx, entityIndex: buildEntityIndex(worldData) };
  }, [worldData, loreData, chronicles, staticPages, dataError, prominenceScale, precomputedPageIndex, eraNarratives]);

  const resolvePageId = useCallback(
    (pageId: string | null): string | null => {
      if (!pageId) return null;
      if (pageIndex.byId.has(pageId)) return pageId;
      return pageIndex.bySlug.get(pageId) ?? pageId;
    },
    [pageIndex]
  );

  const resolveUrlId = useCallback(
    (pageId: string | null): string | null => {
      if (!pageId) return null;
      const resolvedId = resolvePageId(pageId);
      if (!resolvedId) return pageId;
      const entry = pageIndex.byId.get(resolvedId);
      const shouldUseSlug =
        entry &&
        (entry.type === "entity" || entry.type === "chronicle" ||
         entry.type === "static" || entry.type === "era_narrative");
      return shouldUseSlug && entry?.slug ? entry.slug : pageId;
    },
    [pageIndex, resolvePageId]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally invalidate the cache when source data changes
  const pageCache = useMemo(() => new Map<string, WikiPage>(), [worldData, loreData, chronicles, staticPages, eraNarratives]);

  const getPage = useCallback(
    (pageId: string): WikiPage | null => {
      const canonicalId = pageIndex.byId.has(pageId)
        ? pageId
        : (pageIndex.bySlug.get(pageId) ?? pageId);
      if (pageCache.has(canonicalId)) return pageCache.get(canonicalId)!;
      const page = buildPageById(
        canonicalId, worldData, loreData, null,
        pageIndex, chronicles, staticPages, prominenceScale, eraNarratives
      );
      if (page) pageCache.set(canonicalId, page);
      return page;
    },
    [worldData, loreData, pageIndex, chronicles, staticPages, prominenceScale, pageCache, eraNarratives]
  );

  const indexAsPages = useMemo(() => convertIndexToPages(pageIndex), [pageIndex]);
  const chroniclePages = useMemo(
    () => indexAsPages.filter((page) => page.type === "chronicle" && page.chronicle), [indexAsPages]
  );
  const eraNarrativePages = useMemo(
    () => indexAsPages.filter((page) => page.type === "era_narrative"), [indexAsPages]
  );
  const staticPagesAsWikiPages = useMemo(
    () => indexAsPages.filter((page) => page.type === "static"), [indexAsPages]
  );
  const eraNarrativeByEraId = useMemo(() => buildEraNarrativeMap(pageIndex), [pageIndex]);

  const resolveEntityId = useCallback(
    (entityId: string): string | null => {
      if (pageIndex.byId.has(entityId)) return entityId;
      if (pageIndex.byId.has(`entity-${entityId}`)) return `entity-${entityId}`;
      const resolvedId = pageIndex.bySlug.get(entityId);
      return resolvedId && pageIndex.byId.has(resolvedId) ? resolvedId : null;
    },
    [pageIndex]
  );

  const handleRefreshIndex = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [loadedChronicles, loadedStaticPages, loadedLayouts, loadedFinalized] = await Promise.all([
        simulationRunId
          ? getCompletedChroniclesForSimulation(simulationRunId)
          : Promise.resolve([]),
        projectId ? getPublishedStaticPagesForProject(projectId) : Promise.resolve([]),
        simulationRunId ? getPageLayoutMap(simulationRunId) : Promise.resolve(new Map<string, PageLayoutOverride>()),
        simulationRunId ? getFinalizedPageMap(simulationRunId) : Promise.resolve(new Map<string, FinalizedPageRecord>()),
      ]);
      setChronicles(normalizeChronicles(loadedChronicles));
      setStaticPages(normalizeStaticPages(loadedStaticPages));
      setPageLayouts(loadedLayouts);
      setFinalizedPages(loadedFinalized);
    } catch (err) {
      console.error("[WikiExplorer] Failed to refresh index:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, simulationRunId, isRefreshing]);

  const handleRefreshChronicle = useCallback(async (chronicleId: string) => {
    const [fresh, layouts, finalized] = await Promise.all([
      getChronicle(chronicleId),
      simulationRunId ? getPageLayoutMap(simulationRunId) : Promise.resolve(new Map<string, PageLayoutOverride>()),
      simulationRunId ? getFinalizedPageMap(simulationRunId) : Promise.resolve(new Map<string, FinalizedPageRecord>()),
    ]);
    if (layouts.size > 0) setPageLayouts(layouts);
    setFinalizedPages(finalized);
    if (!fresh) return;
    setChronicles((prev) => {
      const next = prev.map((c) => (c.chronicleId === chronicleId ? normalizeChronicles([fresh])[0] : c));
      if (!prev.some((c) => c.chronicleId === chronicleId)) {
        return normalizeChronicles([...prev, fresh]);
      }
      return next;
    });
  }, [simulationRunId]);

  return {
    dataError,
    prominenceScale,
    pageIndex,
    entityIndex,
    getPage,
    resolvePageId,
    resolveUrlId,
    indexAsPages,
    chroniclePages,
    eraNarrativePages,
    staticPagesAsWikiPages,
    eraNarrativeByEraId,
    resolveEntityId,
    isRefreshing,
    handleRefreshIndex,
    handleRefreshChronicle,
    pageLayouts,
    finalizedPages,
  };
}
