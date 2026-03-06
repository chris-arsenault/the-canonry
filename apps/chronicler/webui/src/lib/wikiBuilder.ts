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
  WikiCategory,
  PageIndexEntry,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import type { ChronicleRecord } from "./chronicleStorage.ts";
import type { StaticPage } from "./staticPageStorage.ts";
import type { EraNarrativeViewRecord } from "./eraNarrativeStorage.ts";
import { applyWikiLinks } from "./entityLinking.ts";
import type { ProminenceScale } from "@canonry/world-schema";
import { slugify, buildLoreIndex, buildImageIndex, buildAliasIndex, findRegionById } from "./wikiBuilderUtils.ts";
import { buildPageIndex, resolveProminenceScale } from "./wikiBuilderIndex.ts";
import { buildEntityPage, buildEntityCategories } from "./wikiBuilderEntity.ts";
import { buildChroniclePageFromChronicle, buildChroniclePagesFromChronicles, buildEraNarrativePage } from "./wikiBuilderChronicle.ts";
import { buildStaticPageFromStaticPage, buildRegionPage } from "./wikiBuilderStaticPage.ts";

// Re-export for backwards compatibility
export { applyWikiLinks };
export { buildPageIndex };

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
  prominenceScale: Optional<ProminenceScale>
): WikiPage[] {
  const pages: WikiPage[] = [];
  const resolvedProminenceScale = resolveProminenceScale(worldData, prominenceScale);
  const loreIndex = buildLoreIndex(loreData);
  const aliasIndex = buildAliasIndex(worldData);
  const imageIndex = buildImageIndex(worldData, imageData);

  for (const entity of worldData.hardState) {
    pages.push(buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex, resolvedProminenceScale, chronicles));
  }

  pages.push(...buildChroniclePagesFromChronicles(chronicles, worldData, aliasIndex));

  const categories = buildCategories(worldData, pages);
  for (const category of categories) pages.push(buildCategoryPage(category, pages));

  return pages;
}

// --- Page-by-ID dispatch ---

interface PageBuildContext {
  pageId: string;
  worldData: WorldState;
  loreData: LoreData | null;
  imageData: ImageMetadata | null;
  pageIndex: WikiPageIndex;
  chronicles: ChronicleRecord[];
  staticPages: StaticPage[];
  prominenceScale: ProminenceScale;
  eraNarratives: EraNarrativeViewRecord[];
}

// eslint-disable-next-line complexity -- switch dispatches to 7 distinct page builders; each case is an independent page type with its own build logic
function buildPageByType(indexEntry: PageIndexEntry, ctx: PageBuildContext): WikiPage | null {
  const { pageId, worldData, pageIndex } = ctx;
  const aliasIndex = pageIndex.byAlias;

  switch (indexEntry.type) {
    case "entity":
    case "era": {
      const entity = worldData.hardState.find((e) => e.id === pageId);
      if (!entity) return null;
      const loreIndex = buildLoreIndex(ctx.loreData);
      const imageIndex = buildImageIndex(worldData, ctx.imageData);
      return buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex, ctx.prominenceScale, ctx.chronicles);
    }
    case "era_narrative": {
      const narrative = ctx.eraNarratives.find((n) => n.narrativeId === pageId);
      if (!narrative) return null;
      return buildEraNarrativePage(narrative, worldData, aliasIndex, pageIndex.byName);
    }
    case "chronicle": {
      const chronicle = ctx.chronicles.find((c) => c.chronicleId === pageId);
      if (!chronicle) return null;
      return buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex, pageIndex.byName);
    }
    case "category":
      return buildCategoryPageById(pageId, pageIndex);
    case "static": {
      const staticPage = ctx.staticPages.find((p) => p.pageId === pageId);
      if (!staticPage) return null;
      return buildStaticPageFromStaticPage(staticPage, worldData, ctx.loreData, aliasIndex, pageIndex.byName);
    }
    case "region": {
      const regionId = pageId.replace("region:", "");
      const regionInfo = findRegionById(worldData, regionId);
      if (!regionInfo) return null;
      return buildRegionPage(regionInfo.region, regionInfo.entityKind, worldData, aliasIndex);
    }
    default:
      return null;
  }
}

export function buildPageById(
  pageId: string, worldData: WorldState, loreData: LoreData | null,
  imageData: ImageMetadata | null, pageIndex: WikiPageIndex,
  chronicles: ChronicleRecord[] = [], staticPages: StaticPage[] = [],
  prominenceScale: Optional<ProminenceScale>, eraNarratives: EraNarrativeViewRecord[] = []
): WikiPage | null {
  const resolvedPS = resolveProminenceScale(worldData, prominenceScale);
  let indexEntry = pageIndex.byId.get(pageId);
  if (!indexEntry) {
    const resolvedId = pageIndex.bySlug.get(pageId);
    if (resolvedId) indexEntry = pageIndex.byId.get(resolvedId);
    if (!indexEntry) return null;
  }
  return buildPageByType(indexEntry, {
    pageId, worldData, loreData, imageData, pageIndex,
    chronicles, staticPages, prominenceScale: resolvedPS, eraNarratives,
  });
}

// --- Category pages ---

function buildCategoryPageById(pageId: string, pageIndex: WikiPageIndex): WikiPage | null {
  const catId = pageId.replace("category-", "");
  const category = pageIndex.categories.find((c) => c.id === catId);
  if (!category) return null;
  const pagesInCategory = pageIndex.entries
    .filter((e) => e.categories.includes(catId))
    .map((e) => ({
      id: e.id, title: e.title, type: e.type, slug: e.slug,
      content: { sections: [], summary: e.summary }, categories: e.categories,
      linkedEntities: e.linkedEntities, images: [], lastUpdated: e.lastUpdated,
    })) as WikiPage[];
  return buildCategoryPage(category, pagesInCategory);
}

export function buildCategories(_worldData: WorldState, pages: WikiPage[]): WikiCategory[] {
  const categoryMap = new Map<string, WikiCategory>();
  for (const page of pages) {
    for (const catId of page.categories) {
      if (!categoryMap.has(catId)) {
        const name = catId.split("-").length >= 2
          ? `${catId.split("-")[0].charAt(0).toUpperCase() + catId.split("-")[0].slice(1)}: ${catId.split("-").slice(1).join("-").replace(/_/g, " ")}`
          : catId.replace(/_/g, " ");
        categoryMap.set(catId, { id: catId, name, type: "auto", pageCount: 0 });
      }
      categoryMap.get(catId)!.pageCount++;
    }
  }
  return Array.from(categoryMap.values()).sort((a, b) => b.pageCount - a.pageCount);
}

function buildCategoryPage(category: WikiCategory, pages: WikiPage[]): WikiPage {
  const pagesInCategory = pages.filter((p) => p.categories.includes(category.id));
  return {
    id: `category-${category.id}`, slug: `category/${slugify(category.name)}`,
    title: `Category: ${category.name}`, type: "category",
    content: { sections: [{ id: "pages", heading: "Pages", level: 2, content: pagesInCategory.map((p) => `- [[${p.title}]]`).join("\n") }] },
    categories: [], linkedEntities: pagesInCategory.map((p) => p.id),
    images: [], lastUpdated: Date.now(),
  };
}

// Re-export for other modules
export { buildEntityCategories };
