/**
 * WikiExplorerHome - Home page and page index components for WikiExplorer
 */

import React, { useMemo, useState, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { ImageDisplay } from "@the-canonry/shared-components";
import type { WorldState, WikiPage, HardState } from "../types/world.ts";
import {
  prominenceLabelFromScale,
  type ProminenceScale,
} from "@canonry/world-schema";
import ImageLightbox from "./ImageLightbox.tsx";
import styles from "./WikiExplorer.module.css";

function formatRelKind(kind: string): string {
  return kind.replace(/_/g, " ");
}

function truncateSummary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // eslint-disable-next-line sonarjs/slow-regex -- bounded by maxLen slice (short string)
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

/**
 * Weighted random selection - higher prominence = higher weight
 */
function weightedRandomSelect<T extends { prominence: Optional<number> }>(
  items: T[],
  count: number,
  prominenceScale: ProminenceScale
): T[] {
  if (items.length <= count) return items;

  const weights: Record<string, number> = {
    mythic: 10, renowned: 6, recognized: 3, marginal: 1, forgotten: 0.5,
  };

  const weighted = items.map((item) => ({
    item,
    weight:
      item.prominence != null
        ? weights[prominenceLabelFromScale(item.prominence, prominenceScale)] || 1
        : 1,
  }));

  const selected: T[] = [];
  const available = [...weighted];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
    // eslint-disable-next-line sonarjs/pseudo-random -- non-security weighted selection for UI display
    let random = Math.random() * totalWeight;
    for (let j = 0; j < available.length; j++) {
      random -= available[j].weight;
      if (random <= 0) {
        selected.push(available[j].item);
        available.splice(j, 1);
        break;
      }
    }
  }
  return selected;
}

// --- Sub-components ---

async function loadFullSizeImage(imageId: string, thumbnailUrl: string): Promise<string> {
  try {
    const { useImageStore } = await import("@the-canonry/image-store");
    const loaded = await useImageStore.getState().loadUrl(imageId, "full");
    return loaded || thumbnailUrl;
  } catch { return thumbnailUrl; }
}

function FeaturedArticleSection({ featuredArticle, onNavigate }: Readonly<{
  featuredArticle: HardState; onNavigate: (id: string) => void;
}>) {
  const featuredImageId = featuredArticle.enrichment?.image?.imageId;
  const [activeImage, setActiveImage] = useState<{
    url: string; title: string; summary: Optional<string>;
  } | null>(null);

  const handleImageClick = useCallback(async (imageId: string, thumbUrl: string) => {
    const fullUrl = await loadFullSizeImage(imageId, thumbUrl);
    setActiveImage({ url: fullUrl, title: featuredArticle.name, summary: featuredArticle.summary });
  }, [featuredArticle]);

  const closeImageModal = useCallback(() => setActiveImage(null), []);

  return (
    <div className="section">
      <h2 className="section-title">Featured</h2>
      <div className="featured-layout">
        <ImageDisplay
          imageId={featuredImageId}
          alt={featuredArticle.name}
          className="featured-image-inner"
          containerClassName="featured-image"
          onClick={(id, url) => void handleImageClick(id, url)}
          enableVersionCycling
        />
        <div className="featured-content">
          <button onClick={() => onNavigate(featuredArticle.id)} className="title-button">
            <h3 className="title-button-text">{featuredArticle.name}</h3>
          </button>
          <div className="featured-meta">
            {featuredArticle.kind}
            {featuredArticle.subtype && featuredArticle.subtype !== featuredArticle.kind && <> · {featuredArticle.subtype}</>}
            {featuredArticle.culture && <> · {featuredArticle.culture}</>}
          </div>
          <p className="featured-summary">
            {truncateSummary(featuredArticle.summary || "", 280)}{" "}
            <button onClick={() => onNavigate(featuredArticle.id)} className="inline-link">(Full article...)</button>
          </p>
        </div>
      </div>
      <ImageLightbox
        isOpen={Boolean(activeImage)}
        imageUrl={activeImage?.url || null}
        title={activeImage?.title || ""}
        summary={activeImage?.summary}
        onClose={closeImageModal}
      />
    </div>
  );
}

function HistorianDeskSection({ facts, onNavigate }: Readonly<{
  facts: Array<{ srcEntity: HardState; dstEntity: HardState; kind: string }>;
  onNavigate: (id: string) => void;
}>) {
  if (facts.length === 0) return null;
  return (
    <div className="section">
      <h2 className="section-title">From the Historian&apos;s Desk</h2>
      <ul className="did-you-know-list">
        {facts.map((fact, idx) => (
          <li key={idx} className="did-you-know-item">
            ...that{" "}
            <button onClick={() => onNavigate(fact.srcEntity.id)} className="entity-link-bold">{fact.srcEntity.name}</button>{" "}
            has a <em>{formatRelKind(fact.kind)}</em> relationship with{" "}
            <button onClick={() => onNavigate(fact.dstEntity.id)} className="entity-link-bold">{fact.dstEntity.name}</button>?
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErasOfHistorySection({ eras, eraNarrativeByEraId, onNavigate }: Readonly<{
  eras: HardState[]; eraNarrativeByEraId: Map<string, string>; onNavigate: (id: string) => void;
}>) {
  if (eras.length === 0) return null;
  return (
    <div className="section">
      <h2 className="section-title">Eras of History</h2>
      <div className="era-list">
        {eras.map((era, idx) => {
          const narrativePageId = eraNarrativeByEraId.get(era.id);
          return (
            <button key={era.id} onClick={() => onNavigate(narrativePageId || era.id)} className="era-button">
              <span className="era-number">{idx + 1}</span>
              <span className="era-button-name">{era.name}</span>
              {era.summary && <span className="era-button-summary">{truncateSummary(era.summary, 40)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EntityListSection({ title, subtext, entities, totalLinks, onNavigate }: Readonly<{
  title: string; subtext: Optional<string>;
  entities: HardState[]; totalLinks: Map<string, number>; onNavigate: (id: string) => void;
}>) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      {subtext && <p className="section-subtext">{subtext}</p>}
      <div className="entity-list-column">
        {entities.map((entity) => {
          const linkCount = totalLinks.get(entity.id) || 0;
          return (
            <button key={entity.id} onClick={() => onNavigate(entity.id)} className="entity-list-item">
              <div className="entity-list-header">
                <span className="entity-list-name">{entity.name}</span>
                <span className="entity-list-badge">{linkCount} links</span>
              </div>
              <div className="entity-list-meta">
                {entity.kind}
                {entity.culture && <> · {entity.culture}</>}
              </div>
              {entity.summary && <div className="entity-list-summary">{truncateSummary(entity.summary, 80)}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrowseByTypeSection({ kindDistribution, onNavigate }: Readonly<{
  kindDistribution: Array<[string, number]>; onNavigate: (id: string) => void;
}>) {
  return (
    <div className="section">
      <h2 className="section-title">Browse by Type</h2>
      <div className="browse-type-grid">
        {kindDistribution.map(([kind, count]) => (
          <button key={kind} onClick={() => onNavigate(`category-kind-${kind}`)} className="browse-type-button">
            {kind} <span className="browse-type-count">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChroniclesPreviewSection({ chronicles, onNavigate }: Readonly<{
  chronicles: WikiPage[]; onNavigate: (id: string) => void;
}>) {
  const handleViewAll = useCallback(() => onNavigate("chronicles"), [onNavigate]);
  if (chronicles.length === 0) return null;
  return (
    <div className="section">
      <h2 className="section-title">Chronicles</h2>
      <div className="chronicles-list">
        {chronicles.slice(0, 4).map((chronicle) => (
          <button key={chronicle.id} onClick={() => onNavigate(chronicle.id)} className="chronicle-item">
            <span>{chronicle.title}</span>
            <span className="chronicle-format">
              {chronicle.chronicle?.format === "story" ? "Story" : "Document"}
            </span>
          </button>
        ))}
      </div>
      {chronicles.length > 4 && (
        <button onClick={handleViewAll} className="view-all-button">
          View all {chronicles.length} chronicles &rarr;
        </button>
      )}
    </div>
  );
}

// --- Data computation ---

interface LinkStats {
  totalLinks: Map<string, number>;
  mostLinked: HardState[];
  leastLinked: HardState[];
  isolated: HardState[];
}

function computeLinkStats(worldData: WorldState): LinkStats {
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();
  for (const rel of worldData.relationships) {
    incomingCounts.set(rel.dst, (incomingCounts.get(rel.dst) || 0) + 1);
    outgoingCounts.set(rel.src, (outgoingCounts.get(rel.src) || 0) + 1);
  }
  const totalLinks = new Map<string, number>();
  for (const entity of worldData.hardState) {
    const incoming = incomingCounts.get(entity.id) || 0;
    const outgoing = outgoingCounts.get(entity.id) || 0;
    totalLinks.set(entity.id, incoming + outgoing);
  }
  const sortedByLinks = [...worldData.hardState]
    .filter((e) => e.kind !== "era")
    .sort((a, b) => (totalLinks.get(b.id) || 0) - (totalLinks.get(a.id) || 0));

  return {
    totalLinks,
    mostLinked: sortedByLinks.slice(0, 5),
    leastLinked: sortedByLinks.filter((e) => (totalLinks.get(e.id) || 0) > 0).slice(-5).reverse(),
    isolated: worldData.hardState.filter((e) => e.kind !== "era" && (totalLinks.get(e.id) || 0) === 0),
  };
}

function computeDidYouKnow(worldData: WorldState): Array<{ srcEntity: HardState; dstEntity: HardState; kind: string }> {
  if (worldData.relationships.length === 0) return [];
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));
  // eslint-disable-next-line sonarjs/pseudo-random -- non-security shuffle for UI display
  const shuffled = [...worldData.relationships].sort(() => Math.random() - 0.5).slice(0, 20);
  const facts: Array<{ srcEntity: HardState; dstEntity: HardState; kind: string }> = [];
  for (const rel of shuffled) {
    if (facts.length >= 5) break;
    const src = entityMap.get(rel.src);
    const dst = entityMap.get(rel.dst);
    if (!src || !dst || src.kind === "era" || dst.kind === "era" || src.id === dst.id) continue;
    facts.push({ srcEntity: src, dstEntity: dst, kind: rel.kind });
  }
  return facts;
}

function computeKindDistribution(hardState: HardState[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const entity of hardState) {
    if (entity.kind !== "era") {
      counts.set(entity.kind, (counts.get(entity.kind) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

// --- Main components ---

export interface HomePageProps {
  worldData: WorldState;
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  categories: { id: string; name: string; pageCount: number }[];
  onNavigate: (pageId: string) => void;
  prominenceScale: ProminenceScale;
  breakpoint: "mobile" | "tablet" | "desktop";
  eraNarrativeByEraId: Map<string, string>;
}

export function HomePage({
  worldData, chronicles, staticPages, onNavigate,
  prominenceScale, breakpoint, eraNarrativeByEraId,
}: Readonly<HomePageProps>) {
  const isMobile = breakpoint === "mobile";

  const aboutPage = useMemo(
    () => staticPages.find((p) => p.title.toLowerCase() === "system:about this project" || p.title.toLowerCase() === "about this project"),
    [staticPages]
  );
  const eras = useMemo(() => worldData.hardState.filter((e) => e.kind === "era"), [worldData.hardState]);
  const linkStats = useMemo(() => computeLinkStats(worldData), [worldData]);

  const featuredArticle = useMemo(() => {
    const candidates = worldData.hardState.filter((e) => e.kind !== "era" && e.summary && e.enrichment?.image?.imageId);
    if (candidates.length === 0) {
      const withSummary = worldData.hardState.filter((e) => e.kind !== "era" && e.summary);
      if (withSummary.length === 0) return null;
      return weightedRandomSelect(withSummary, 1, prominenceScale)[0];
    }
    return weightedRandomSelect(candidates, 1, prominenceScale)[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const didYouKnow = useMemo(() => computeDidYouKnow(worldData), []);
  const kindDistribution = useMemo(() => computeKindDistribution(worldData.hardState), [worldData.hardState]);

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">World Chronicle</h1>
        <div className="home-stats">
          {worldData.hardState.filter((e) => e.kind !== "era").length} entries
          {" · "}
          {eras.length > 0 && <>{eras.length} eras · </>}
          {chronicles.length > 0 && <>{chronicles.length} chronicles</>}
        </div>
      </div>

      {aboutPage && (
        <div className="about-banner">
          <div className="about-banner-text">{aboutPage.content.summary || "Learn about this world and its lore."}</div>
          <button onClick={() => onNavigate(aboutPage.id)} className="about-banner-button">Read more &rarr;</button>
        </div>
      )}

      <div className={isMobile ? "home-grid-mobile" : "home-grid"}>
        <div>
          {featuredArticle && <FeaturedArticleSection featuredArticle={featuredArticle} onNavigate={onNavigate} />}
          <HistorianDeskSection facts={didYouKnow} onNavigate={onNavigate} />
          <ErasOfHistorySection eras={eras} eraNarrativeByEraId={eraNarrativeByEraId} onNavigate={onNavigate} />
        </div>
        <div>
          <EntityListSection title="Notable Figures" entities={linkStats.mostLinked} totalLinks={linkStats.totalLinks} onNavigate={onNavigate} />
          <EntityListSection title="Undiscovered" subtext="Corners of the world awaiting a curious reader" entities={linkStats.leastLinked} totalLinks={linkStats.totalLinks} onNavigate={onNavigate} />
          {linkStats.isolated.length > 0 && (
            <div className="section-footnote">+ {linkStats.isolated.length} isolated entities with no connections</div>
          )}
          <BrowseByTypeSection kindDistribution={kindDistribution} onNavigate={onNavigate} />
          <ChroniclesPreviewSection chronicles={chronicles} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

