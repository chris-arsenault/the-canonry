/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import React, { useMemo, useState, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  WikiPage,
  WikiSectionImage,
  HardState,
  DisambiguationEntry,
  ImageAspect,
  PageLayoutOverride,
} from "../types/world.ts";
import {
  useEntityNarrativeEvents,
  useEntityNarrativeLoading,
} from "@the-canonry/narrative-store";
import { SeedModal } from "@the-canonry/shared-components";
import type { ProminenceScale } from "@canonry/world-schema";

import { CoverHeroImage, ChronicleGallery } from "./WikiPageImages.tsx";
import { WikiPageInfobox } from "./WikiPageInfobox.tsx";
import { EntityPreviewCard } from "./WikiPagePreview.tsx";
import {
  DisambiguationNotice,
  TableOfContents,
  UnmatchedHistorianNotes,
  BacklinkButton,
  CategoryButton,
  SectionBlock,
  type WikiLinkData,
  type SectionCallbacks,
} from "./WikiPageParts.tsx";
import { useWikiPageData } from "../hooks/useWikiPageData.ts";
import EntityTimeline from "./EntityTimeline.tsx";
import ProminenceTimeline from "./ProminenceTimeline.tsx";
import ImageLightbox from "./ImageLightbox.tsx";
import { SectionDivider, FrostEdge } from "./Ornaments.tsx";

function breadcrumbTypeLabel(page: WikiPage, namespace: string | null): string {
  if (page.type === "static") return namespace || "Pages";
  if (page.type === "category") return "Categories";
  if (page.type === "chronicle") return "Chronicles";
  if (page.type === "era_narrative") return "Era Narratives";
  return page.type;
}

interface WikiPageViewProps {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
  disambiguation: Optional<DisambiguationEntry[]>;
  onNavigate: (pageId: string) => void;
  onNavigateToEntity: (entityId: string) => void;
  prominenceScale: ProminenceScale;
  breakpoint: Optional<"mobile" | "tablet" | "desktop">;
  layoutOverride: Optional<PageLayoutOverride>;
  onRefreshChronicle: Optional<(chronicleId: string) => Promise<void>>;
}

// eslint-disable-next-line max-lines-per-function, complexity -- page-level orchestrator combining infobox, sections, timeline, backlinks, modals, and hover preview; the branching comes from conditional rendering of 10+ independent UI blocks based on page type
export default function WikiPageView({
  page, pages, entityIndex, disambiguation,
  onNavigate, onNavigateToEntity, prominenceScale,
  breakpoint = "desktop", layoutOverride, onRefreshChronicle,
}: Readonly<WikiPageViewProps>) {
  const isMobile = breakpoint === "mobile";
  const showInfoboxInline = isMobile || breakpoint === "tablet";
  const isEntityPage = page.type === "entity" || page.type === "era";
  const isChronicle = page.type === "chronicle";
  const isEraNarrative = page.type === "era_narrative";
  const isLongFormProse = isChronicle || isEraNarrative;

  const narrativeEvents = useEntityNarrativeEvents(isEntityPage ? page.id : null);
  const narrativeLoading = useEntityNarrativeLoading(isEntityPage ? page.id : null);

  const [showSeedModal, setShowSeedModal] = useState(false);
  const [activeImage, setActiveImage] = useState<{
    url: string; title: string; summary: Optional<string>;
  } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const data = useWikiPageData({ page, pages, entityIndex });
  const {
    entityNameMap, aliasMap, linkableNames, seedData,
    chronicleLinks, sourceChronicleLinks, backlinks, staticTitle,
    hoveredBacklink, handleEntityHoverEnter, handleEntityHoverLeave,
    hoveredEntity, hoveredSummary, hoveredImageId,
    infoboxImageId, infoboxImageAspect,
    handleInlineImageOpen, handleInfoboxImageClick,
  } = data;

  const effectiveAspect = infoboxImageAspect;

  const handleEntityClick = useCallback(
    (entityId: string) => { handleEntityHoverLeave(); onNavigateToEntity(entityId); },
    [handleEntityHoverLeave, onNavigateToEntity],
  );

  const handleInfoboxClick = useCallback(async () => {
    const result = await handleInfoboxImageClick();
    if (result) setActiveImage(result);
  }, [handleInfoboxImageClick]);

  const handleSectionImageOpen = useCallback(
    (url: string, img: WikiSectionImage) => {
      void handleInlineImageOpen(url, img).then((result) => {
        if (result) setActiveImage(result);
      });
    },
    [handleInlineImageOpen],
  );

  const handleCoverOpen = useCallback((url: string) => {
    setActiveImage({ url, title: page.title });
  }, [page.title]);

  const closeImageModal = useCallback(() => setActiveImage(null), []);
  const handleGoHome = useCallback(() => onNavigate(""), [onNavigate]);
  const handleHomeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onNavigate("");
  }, [onNavigate]);
  const toggleSeedModal = useCallback(() => setShowSeedModal(true), []);
  const closeSeedModal = useCallback(() => setShowSeedModal(false), []);
  const [isRefreshingChronicle, setIsRefreshingChronicle] = useState(false);
  const handleRefreshChronicle = useCallback(async () => {
    if (!onRefreshChronicle || isRefreshingChronicle) return;
    setIsRefreshingChronicle(true);
    try { await onRefreshChronicle(page.id); }
    finally { setIsRefreshingChronicle(false); }
  }, [onRefreshChronicle, isRefreshingChronicle, page.id]);
  const toggleTimeline = useCallback(() => setTimelineOpen((o) => !o), []);

  const sectionLinkData: WikiLinkData = useMemo(
    () => ({ entityNameMap, aliasMap, linkableNames }),
    [entityNameMap, aliasMap, linkableNames],
  );
  const sectionCallbacks: SectionCallbacks = useMemo(
    () => ({
      onNavigate,
      onEntityClick: handleEntityClick,
      onHoverEnter: handleEntityHoverEnter,
      onHoverLeave: handleEntityHoverLeave,
      onImageOpen: handleSectionImageOpen,
    }),
    [onNavigate, handleEntityClick, handleEntityHoverEnter, handleEntityHoverLeave, handleSectionImageOpen],
  );

  const dropcapProps = useMemo(() => {
    if (layoutOverride?.dropcap === "off") return {};
    if (layoutOverride?.dropcap === "on") return { "data-dropcap": "" };
    if (isLongFormProse && page.content.sections[0]?.content) {
      const stripped = page.content.sections[0].content.replace(/^[\s*_#>]+/, "");
      if (/^[a-zA-Z]/.test(stripped) && !/^[IVXLCDM]+\.\s/.test(stripped)) return { "data-dropcap": "" };
    }
    return {};
  }, [layoutOverride?.dropcap, isLongFormProse, page.content.sections]);

  const hasRelationshipsSection = page.content.sections.some((s) => s.heading === "Relationships");

  return (
    <div className="wp-container">
      <div className="breadcrumbs">
        <span className="breadcrumb-link" onClick={handleGoHome} role="button" tabIndex={0} onKeyDown={handleHomeKeyDown}>Home</span>
        {" / "}<span>{breadcrumbTypeLabel(page, staticTitle.namespace)}</span>
        {" / "}<span className="breadcrumb-current">{page.type === "static" ? staticTitle.baseName : page.title}</span>
      </div>

      {isLongFormProse && page.content.coverImageId && (
        <CoverHeroImage imageId={page.content.coverImageId} title={page.title} onOpen={handleCoverOpen} />
      )}

      <div className="wp-header">
        {isLongFormProse && !page.content.coverImageId && <h1 className="chronicle-title">{page.title}</h1>}
        {isEraNarrative && page.eraNarrative && (
          <div className="era-narrative-subtitle">Era Narrative (synthetic) · {page.eraNarrative.tone}</div>
        )}
        {!isLongFormProse && (
          <h1 className="wp-title">{page.type === "static" ? staticTitle.displayTitle : page.title}</h1>
        )}
        {disambiguation && disambiguation.length > 0 && (
          <DisambiguationNotice page={page} entityIndex={entityIndex} disambiguation={disambiguation} onNavigate={onNavigate} />
        )}
        {!isLongFormProse && page.type !== "static" && page.content.summary && (
          <div className="wp-summary">{page.content.summary}</div>
        )}
        {!isChronicle && seedData && (
          <button className="seed-button" onClick={toggleSeedModal}>View Generation Context</button>
        )}
        {isChronicle && onRefreshChronicle && (
          <button className="seed-button" onClick={handleRefreshChronicle} disabled={isRefreshingChronicle}>
            {isRefreshingChronicle ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className={showInfoboxInline ? "wp-content-column" : "wp-content"}>
        <WikiPageInfobox page={page} variant={showInfoboxInline ? "inline" : "float"} isMobile={isMobile}
          imageId={infoboxImageId} effectiveAspect={effectiveAspect}
          onImageClick={handleInfoboxClick}
          onNavigateToEntity={onNavigateToEntity} />

        <div className="wp-main">
          {isEntityPage && page.content.sections.length > 2 && <TableOfContents sections={page.content.sections} />}
          <div
            className={[(isLongFormProse || layoutOverride?.dropcap) ? "chronicle-body" : "", layoutOverride?.customClass || ""].filter(Boolean).join(" ") || undefined}
            data-style={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
            data-content-width={layoutOverride?.contentWidth}
            data-text-align={layoutOverride?.textAlign}
            {...dropcapProps}
          >
            {page.content.sections.map((section, sectionIndex) => (
              <SectionBlock key={section.id} section={section} sectionIndex={sectionIndex}
                isLongFormProse={isLongFormProse}
                sourceChronicleLinks={sourceChronicleLinks} chronicleLinks={chronicleLinks}
                linkData={sectionLinkData} callbacks={sectionCallbacks}
                historianNotes={page.content.historianNotes}
                narrativeStyleId={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
                layoutOverride={layoutOverride} />
            ))}
          </div>

          {!hasRelationshipsSection && sourceChronicleLinks.length > 0 && (
            <ChronicleGallery title="Source Chronicles" links={sourceChronicleLinks} onNavigate={onNavigate} />
          )}
          {!hasRelationshipsSection && chronicleLinks.length > 0 && (
            <ChronicleGallery title="Chronicles" links={chronicleLinks} onNavigate={onNavigate} />
          )}

          {isEntityPage && (
            <div id="timeline" className="wp-section">
              <button className="section-heading-toggle" onClick={toggleTimeline}>
                <span className={timelineOpen ? "expand-arrow-open" : "expand-arrow"}>&#x25B6;</span>
                <h2 className="section-heading">Timeline</h2>
              </button>
              <SectionDivider className="section-divider-svg" />
              {timelineOpen && (
                <>
                  <ProminenceTimeline events={narrativeEvents} entityId={page.id} prominenceScale={prominenceScale} />
                  <EntityTimeline events={narrativeEvents} entityId={page.id} entityIndex={entityIndex}
                    onNavigate={handleEntityClick} onHoverEnter={handleEntityHoverEnter}
                    onHoverLeave={handleEntityHoverLeave} loading={narrativeLoading} />
                </>
              )}
            </div>
          )}

          <UnmatchedHistorianNotes page={page} />

          {backlinks.length > 0 && (
            <div className="backlinks">
              <FrostEdge className="frost-edge-divider" />
              <div className="backlinks-title">What links here ({backlinks.length})</div>
              {backlinks.slice(0, 20).map((link) => <BacklinkButton key={link.id} link={link} onNavigate={onNavigate} />)}
              {backlinks.length > 20 && <div className="more-text">...and {backlinks.length - 20} more</div>}
            </div>
          )}

          {page.categories.length > 0 && (
            <div className="categories">
              <div className="categories-label">Categories:</div>
              {page.categories.map((catId) => <CategoryButton key={catId} catId={catId} onNavigate={onNavigate} />)}
            </div>
          )}
        </div>
      </div>

      {seedData && <SeedModal isOpen={showSeedModal} onClose={closeSeedModal} seed={seedData} title="Generation Context" />}
      <ImageLightbox isOpen={Boolean(activeImage)} imageUrl={activeImage?.url || null}
        title={activeImage?.title || ""} summary={activeImage?.summary} onClose={closeImageModal} />
      {hoveredBacklink && hoveredEntity && (
        <EntityPreviewCard entity={hoveredEntity} summary={hoveredSummary}
          position={hoveredBacklink.position} imageId={hoveredImageId} prominenceScale={prominenceScale} />
      )}
    </div>
  );
}
