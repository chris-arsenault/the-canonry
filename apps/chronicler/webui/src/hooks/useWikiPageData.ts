/**
 * useWikiPageData - Data preparation for WikiPageView
 *
 * Computes entity name maps, alias maps, linkable names, seed data,
 * backlinks, and other derived data needed for wiki page rendering.
 */

import { useMemo, useCallback, useRef, useState } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  WikiPage,
  HardState,
  ChronicleRoleAssignment,
  ChronicleTemporalContext,
} from "../types/world.ts";
import {
  useImageUrl,
  useImageMetadata,
  useImageStore,
} from "@the-canonry/image-store";

/** Seed data shape for the generation context modal */
export interface ChronicleSeedData {
  narrativeStyleId: string;
  narrativeStyleName: Optional<string>;
  entrypointId: Optional<string>;
  entrypointName: Optional<string>;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext: Optional<ChronicleTemporalContext>;
}

// ============================================================================
// Linkable name builders
// ============================================================================

/** Collect entity-alias linkable names from wiki pages. */
function collectAliasNames(pages: WikiPage[]): Array<{ name: string; id: string }> {
  const names: Array<{ name: string; id: string }> = [];
  for (const candidate of pages) {
    if (candidate.type !== "entity" || !candidate.aliases?.length) continue;
    for (const alias of candidate.aliases) {
      if (alias.length >= 3) names.push({ name: alias, id: candidate.id });
    }
  }
  return names;
}

/** Collect static-page linkable names, including colon-split base names. */
function collectStaticPageNames(pages: WikiPage[]): Array<{ name: string; id: string }> {
  const names: Array<{ name: string; id: string }> = [];
  for (const p of pages) {
    if (p.type !== "static") continue;
    names.push({ name: p.title, id: p.id });
    const colonIdx = p.title.indexOf(":");
    if (colonIdx > 0 && colonIdx < p.title.length - 1) {
      const baseName = p.title.slice(colonIdx + 1).trim();
      if (baseName && baseName !== p.title) names.push({ name: baseName, id: p.id });
    }
  }
  return names;
}

/** Build the array of linkable names for auto-linking in WikiPageView. */
function buildLinkableNames(
  entityIndex: Map<string, HardState>,
  pages: WikiPage[],
): Array<{ name: string; id: string }> {
  const names: Array<{ name: string; id: string }> = [];
  for (const [id, entity] of entityIndex) {
    names.push({ name: entity.name, id });
  }
  names.push(...collectAliasNames(pages));
  names.push(...collectStaticPageNames(pages));
  return names;
}

// ============================================================================
// Image details resolution
// ============================================================================

/** Info bag passed to the image details resolver. */
export interface ImageDetailsInfo {
  entityId: Optional<string>;
  imageId: Optional<string>;
  caption: Optional<string>;
  fallbackTitle: Optional<string>;
  fallbackSummary: Optional<string>;
  suppressSummaryFallback: Optional<boolean>;
  captionOnly: Optional<boolean>;
}

/** Resolve the entity ID for an image, falling back to imageId→entity mapping. */
function resolveEntityId(
  info: ImageDetailsInfo,
  imageIdToEntityId: Map<string, string>,
): Optional<string> {
  if (info.entityId) return info.entityId;
  if (info.imageId) return imageIdToEntityId.get(info.imageId);
  return undefined;
}

/** Resolve lightbox title from entity/page indices with cascading fallbacks. */
function resolveImageTitle(
  entityId: Optional<string>,
  entityIndex: Map<string, HardState>,
  pageById: Map<string, WikiPage>,
  fallbackTitle: Optional<string>,
  caption: Optional<string>,
  pageTitle: string,
): string {
  if (entityId) {
    const entity = entityIndex.get(entityId);
    const entityPage = pageById.get(entityId);
    const fromEntity = entity?.name || entityPage?.title;
    if (fromEntity) return fromEntity;
  }
  return fallbackTitle || caption || pageTitle;
}

/** Resolve lightbox summary from entity page with cascading fallbacks. */
function resolveImageSummary(
  entityId: Optional<string>,
  pageById: Map<string, WikiPage>,
  fallbackSummary: Optional<string>,
  caption: Optional<string>,
  pageSummary: Optional<string>,
  suppressSummaryFallback: Optional<boolean>,
): string {
  if (entityId) {
    const entityPage = pageById.get(entityId);
    if (entityPage?.content.summary) return entityPage.content.summary;
  }
  if (suppressSummaryFallback) return fallbackSummary || caption || "";
  return fallbackSummary || pageSummary || caption || "";
}

/** Resolve title + summary for a lightbox image from entity/page indices. */
function resolveImageDetailsImpl(
  info: ImageDetailsInfo,
  imageIdToEntityId: Map<string, string>,
  entityIndex: Map<string, HardState>,
  pageById: Map<string, WikiPage>,
  pageTitle: string,
  pageSummary: Optional<string>,
): { title: string; summary: string } {
  if (info.captionOnly) return { title: info.caption || "", summary: "" };
  const entityId = resolveEntityId(info, imageIdToEntityId);
  return {
    title: resolveImageTitle(entityId, entityIndex, pageById, info.fallbackTitle, info.caption, pageTitle),
    summary: resolveImageSummary(entityId, pageById, info.fallbackSummary, info.caption, pageSummary, info.suppressSummaryFallback),
  };
}

// ============================================================================
// Seed data builder
// ============================================================================

/** Build seed data for chronicle generation context modal. */
// eslint-disable-next-line complexity -- excess from 5 independent || operators providing empty defaults for optional chronicle fields; data normalization, not decision logic
function buildSeedData(page: WikiPage, entityIndex: Map<string, HardState>): ChronicleSeedData | null {
  if (page.type !== "chronicle" || !page.chronicle) return null;
  const chronicle = page.chronicle;
  if (!chronicle.narrativeStyleId && !chronicle.roleAssignments?.length) return null;
  const entrypoint = chronicle.entrypointId ? entityIndex.get(chronicle.entrypointId) : undefined;
  return {
    narrativeStyleId: chronicle.narrativeStyleId || "",
    entrypointId: chronicle.entrypointId,
    entrypointName: entrypoint?.name,
    roleAssignments: chronicle.roleAssignments || [],
    selectedEventIds: chronicle.selectedEventIds || [],
    selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
    temporalContext: chronicle.temporalContext,
  };
}

// ============================================================================
// Hook
// ============================================================================

interface UseWikiPageDataOptions {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
}

// eslint-disable-next-line max-lines-per-function, complexity -- composition hook assembling name maps, linkable names, backlinks, seed data, and image state; complexity from independent conditional data lookups across entity/page indices
export function useWikiPageData({ page, pages, entityIndex }: Readonly<UseWikiPageDataOptions>) {
  // Build name to ID map for link resolution (entities + static pages)
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, entity] of entityIndex) {
      map.set(entity.name.toLowerCase().normalize("NFC"), id);
    }
    for (const p of pages) {
      if (p.type !== "static") continue;
      const titleLower = p.title.toLowerCase().normalize("NFC");
      if (!map.has(titleLower)) map.set(titleLower, p.id);
      const colonIdx = p.title.indexOf(":");
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim().toLowerCase().normalize("NFC");
        if (baseName && !map.has(baseName)) map.set(baseName, p.id);
      }
    }
    return map;
  }, [entityIndex, pages]);

  const aliasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of pages) {
      if (candidate.type !== "entity" || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        const normalized = alias.toLowerCase().trim().normalize("NFC");
        if (!normalized || entityNameMap.has(normalized)) continue;
        if (!map.has(normalized)) map.set(normalized, candidate.id);
      }
    }
    return map;
  }, [pages, entityNameMap]);

  const linkableNames = useMemo(
    () => buildLinkableNames(entityIndex, pages),
    [entityIndex, pages],
  );

  const seedData = useMemo(
    () => buildSeedData(page, entityIndex),
    [page, entityIndex],
  );

  // Backlinks and cross-references
  const chronicleLinks = useMemo(() => {
    return pages.filter(
      (p) => p.type === "chronicle" && p.chronicle && p.id !== page.id && p.linkedEntities.includes(page.id),
    );
  }, [pages, page.id]);

  const sourceChronicleLinks = useMemo(() => {
    const ids = page.eraNarrative?.sourceChronicleIds;
    if (!ids || ids.length === 0) return [];
    return ids.map((id) => pages.find((p) => p.id === id)).filter((p): p is WikiPage => p != null);
  }, [pages, page.eraNarrative?.sourceChronicleIds]);

  const backlinks = useMemo(() => {
    return pages.filter(
      (p) => p.id !== page.id && p.type !== "chronicle" && p.type !== "category" && p.linkedEntities.includes(page.id),
    );
  }, [pages, page.id]);

  // Static page title parsing
  const staticTitle = useMemo(() => {
    if (page.type !== "static") {
      return { namespace: null as string | null, baseName: page.title, displayTitle: page.title };
    }
    const colonIdx = page.title.indexOf(":");
    if (colonIdx > 0 && colonIdx < page.title.length - 1) {
      const namespace = page.title.slice(0, colonIdx).trim();
      const baseName = page.title.slice(colonIdx + 1).trim();
      return {
        namespace: namespace || null,
        baseName: baseName || page.title,
        displayTitle: baseName || page.title,
      };
    }
    return { namespace: null, baseName: page.title, displayTitle: page.title };
  }, [page.title, page.type]);

  // Image-to-entity mapping for lightbox title resolution
  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const imageIdToEntityId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entity of entityIndex.values()) {
      const imageId = entity.enrichment?.image?.imageId;
      if (imageId && !map.has(imageId)) map.set(imageId, entity.id);
    }
    return map;
  }, [entityIndex]);

  const resolveImageDetails = useCallback(
    (info: ImageDetailsInfo) => resolveImageDetailsImpl(
      info, imageIdToEntityId, entityIndex, pageById, page.title, page.content.summary,
    ),
    [imageIdToEntityId, entityIndex, pageById, page.content.summary, page.title],
  );

  // Entity hover preview
  const [hoveredBacklink, setHoveredBacklink] = useState<{
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleEntityHoverEnter = useCallback((id: string, e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredBacklink({ id, position: { x, y } });
    }, 200);
  }, []);

  const handleEntityHoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredBacklink(null);
  }, []);

  const hoveredEntity = useMemo(() => {
    if (!hoveredBacklink) return null;
    return entityIndex.get(hoveredBacklink.id) || null;
  }, [hoveredBacklink, entityIndex]);

  const hoveredSummary = useMemo(() => {
    if (!hoveredBacklink) return undefined;
    const found = pages.find((p) => p.id === hoveredBacklink.id);
    return found?.content?.summary;
  }, [hoveredBacklink, pages]);

  const hoveredImageId = hoveredEntity?.enrichment?.image?.imageId;
  const { url: hoveredImageUrl } = useImageUrl(hoveredImageId);

  // Infobox image
  const infoboxEntity = entityIndex.get(page.id);
  const infoboxImageId = infoboxEntity?.enrichment?.image?.imageId;
  const { url: infoboxImageUrl } = useImageUrl(infoboxImageId);
  const infoboxMetadataMap = useImageMetadata(infoboxImageId ? [infoboxImageId] : []);
  const infoboxMetadata = infoboxImageId ? infoboxMetadataMap.get(infoboxImageId) : undefined;
  const infoboxImageAspect = infoboxMetadata?.aspect;

  // Image lightbox
  const openImageModal = useCallback(
    (imageUrl: string, info: ImageDetailsInfo) => {
      if (!imageUrl) return null;
      const { title, summary } = resolveImageDetails(info);
      return { url: imageUrl, title, summary };
    },
    [resolveImageDetails],
  );

  const handleInlineImageOpen = useCallback(
    async (thumbUrl: string, image: { imageId: Optional<string>; entityId: Optional<string>; caption: Optional<string>; type: Optional<string> }) => {
      let fullUrl = thumbUrl;
      if (image.imageId) {
        try {
          const loaded = await useImageStore.getState().loadUrl(image.imageId, "full");
          if (loaded) fullUrl = loaded;
        } catch {
          // Fall back to thumbnail
        }
      }
      return openImageModal(fullUrl, {
        entityId: image.entityId,
        imageId: image.imageId,
        caption: image.caption,
        suppressSummaryFallback: image.type === "chronicle_image",
        captionOnly: image.type === "chronicle_image",
        fallbackTitle: undefined,
        fallbackSummary: undefined,
      });
    },
    [openImageModal],
  );

  const handleInfoboxImageClick = useCallback(async () => {
    if (!infoboxImageUrl) return null;
    const entityId = entityIndex.has(page.id) ? page.id : undefined;
    let fullUrl = infoboxImageUrl;
    if (entityId && infoboxImageId) {
      try {
        const loaded = await useImageStore.getState().loadUrl(infoboxImageId, "full");
        if (loaded) fullUrl = loaded;
      } catch {
        // Fall back to infobox image path
      }
    }
    return openImageModal(fullUrl, {
      entityId,
      fallbackTitle: page.title,
      fallbackSummary: page.content.summary,
      imageId: undefined,
      caption: undefined,
      suppressSummaryFallback: undefined,
      captionOnly: undefined,
    });
  }, [infoboxImageUrl, infoboxImageId, entityIndex, page.id, page.title, page.content.summary, openImageModal]);

  return {
    entityNameMap,
    aliasMap,
    linkableNames,
    seedData,
    chronicleLinks,
    sourceChronicleLinks,
    backlinks,
    staticTitle,
    resolveImageDetails,
    hoveredBacklink,
    handleEntityHoverEnter,
    handleEntityHoverLeave,
    hoveredEntity,
    hoveredSummary,
    hoveredImageUrl,
    infoboxImageUrl,
    infoboxImageAspect,
    openImageModal,
    handleInlineImageOpen,
    handleInfoboxImageClick,
  };
}
