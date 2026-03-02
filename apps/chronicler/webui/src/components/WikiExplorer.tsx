/**
 * WikiExplorer - Main layout for the Chronicler wiki
 *
 * MediaWiki-inspired layout with:
 * - Navigation sidebar (left)
 * - Content area (center)
 * - Mobile-responsive drawer navigation
 */

import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { SerializedPageIndex, LoreData, WorldState } from "../types/world.ts";
import type { ChronicleRecord } from "../lib/chronicleStorage.ts";
import type { StaticPage } from "../lib/staticPageStorage.ts";
import type { EraNarrativeViewRecord } from "../lib/eraNarrativeStorage.ts";
import { useBreakpoint } from "../hooks/useBreakpoint.ts";
import { useWikiExplorerData } from "../hooks/useWikiExplorerData.ts";
import WikiNav from "./WikiNav.tsx";
import ChronicleIndex from "./ChronicleIndex.tsx";
import WikiPageView from "./WikiPage.tsx";
import { HomePage } from "./WikiExplorerHome.tsx";
import { PagesIndex, PageCategoryIndex } from "./WikiExplorerPages.tsx";
import { ParchmentTexture, PageFrame, DEFAULT_PARCHMENT_CONFIG } from "./Ornaments.tsx";
import styles from "./WikiExplorer.module.css";

function parseHashPageId(): string | null {
  const hash = window.location.hash;
  if (!hash || hash === "#/" || hash === "#") return null;
  const match = hash.match(/^#\/page\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildPageHash(pageId: string | null): string {
  if (!pageId) return "#/";
  return `#/page/${pageId.split("/").map((s) => encodeURIComponent(s)).join("/")}`;
}

function buildChronicleFilter(currentPageId: string | null) {
  if (currentPageId === "chronicles-story") return { kind: "format" as const, format: "story" as const };
  if (currentPageId === "chronicles-document") return { kind: "format" as const, format: "document" as const };
  if (currentPageId?.startsWith("chronicles-type-")) {
    return { kind: "type" as const, typeId: currentPageId.replace("chronicles-type-", "") };
  }
  if (currentPageId?.startsWith("chronicles-era-")) {
    const suffix = currentPageId.replace("chronicles-era-", "");
    if (suffix.endsWith("-story")) return { kind: "era" as const, eraId: suffix.replace(/-story$/, ""), format: "story" as const };
    if (suffix.endsWith("-document")) return { kind: "era" as const, eraId: suffix.replace(/-document$/, ""), format: "document" as const };
    return { kind: "era" as const, eraId: suffix };
  }
  return { kind: "all" as const };
}

function DataErrorScreen({ error }: Readonly<{ error: { message: string; details: string } }>) {
  return (
    <div className={styles.container}>
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2 className={styles.errorTitle}>{error.message}</h2>
          <p className={styles.errorDetails}>{error.details}</p>
          <div className={styles.errorFix}>
            <strong>How to fix:</strong>
            <ol>
              <li>In the Canonry shell, click the <strong>&quot;Run Slots&quot;</strong> dropdown in the top navigation bar</li>
              <li>Click the <strong>×</strong> button next to the saved simulation slot to delete it</li>
              <li>Re-run the simulation to generate fresh data</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

interface WikiExplorerProps {
  projectId: Optional<string>;
  worldData: WorldState;
  loreData: LoreData | null;
  requestedPageId: Optional<string | null>;
  onRequestedPageConsumed: Optional<() => void>;
  preloadedChronicles: Optional<ChronicleRecord[]>;
  preloadedStaticPages: Optional<StaticPage[]>;
  preloadedEraNarratives: Optional<EraNarrativeViewRecord[]>;
  prebakedParchmentUrl: Optional<string>;
  precomputedPageIndex: Optional<SerializedPageIndex>;
}

function WikiExplorerSidebar({ children, isMobile, isSidebarOpen, onOpenSidebar, onCloseSidebar }: Readonly<{
  children: React.ReactNode; isMobile: boolean;
  isSidebarOpen: boolean; onOpenSidebar: () => void; onCloseSidebar: () => void;
}>) {
  const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onCloseSidebar();
  }, [onCloseSidebar]);

  if (!isMobile) return <div className={styles.sidebar}>{children}</div>;
  return (
    <>
      <button className={styles.menuButton} onClick={onOpenSidebar} aria-label="Open navigation menu">☰</button>
      {isSidebarOpen && (
        <>
          <div className={styles.sidebarBackdrop} onClick={onCloseSidebar} role="button" tabIndex={0} onKeyDown={handleBackdropKeyDown} />
          <div className={styles.sidebarDrawer}>{children}</div>
        </>
      )}
    </>
  );
}

function useHashNavigation(
  resolvePageId: (id: string | null) => string | null,
  resolveUrlId: (id: string | null) => string | null,
  requestedPageId: Optional<string | null>,
  onRequestedPageConsumed: Optional<() => void>,
) {
  const [currentPageId, setCurrentPageId] = useState<string | null>(() => parseHashPageId());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleHashChange = () => {
      const rawPageId = parseHashPageId();
      const pageId = resolvePageId(rawPageId);
      setCurrentPageId(pageId);
      setSearchQuery("");
      if (rawPageId) {
        const canonicalUrlId = resolveUrlId(rawPageId);
        if (canonicalUrlId) {
          const canonicalHash = buildPageHash(canonicalUrlId);
          if (window.location.hash !== canonicalHash) window.history.replaceState(null, "", canonicalHash);
        }
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [resolvePageId, resolveUrlId]);

  useLayoutEffect(() => {
    if (!requestedPageId) return;
    const resolvedPageId = resolvePageId(requestedPageId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- useLayoutEffect intentionally sets state before paint to avoid home page flash on external navigation
    setCurrentPageId(resolvedPageId);
    setSearchQuery("");
    const urlId = resolveUrlId(requestedPageId) ?? requestedPageId;
    const newHash = buildPageHash(urlId);
    if (window.location.hash !== newHash) window.location.hash = newHash;
    onRequestedPageConsumed?.();
  }, [requestedPageId, onRequestedPageConsumed, resolvePageId, resolveUrlId]);

  return { currentPageId, searchQuery, setSearchQuery };
}

// eslint-disable-next-line complexity -- content router dispatching to 5 page types (chronicle index, pages index, category, entity page, home) based on URL path classification
function WikiExplorerContent({ currentPageId, data, onNavigate, onNavigateToEntity, worldData, breakpoint }: Readonly<{
  currentPageId: string | null;
  data: ReturnType<typeof useWikiExplorerData>;
  onNavigate: (id: string) => void;
  onNavigateToEntity: (id: string) => void;
  worldData: WorldState;
  breakpoint: "mobile" | "tablet" | "desktop";
}>) {
  const { getPage, pageIndex, entityIndex, indexAsPages, chroniclePages,
    eraNarrativePages, staticPagesAsWikiPages, eraNarrativeByEraId, prominenceScale } = data;

  const isChronicleIndex = currentPageId?.startsWith("chronicles") === true;
  const isPagesIndex = currentPageId === "pages";
  const isPageCategory = currentPageId?.startsWith("page-category-");
  const pageCategoryNamespace = isPageCategory ? currentPageId!.replace("page-category-", "") : null;
  const needsPageResolution = !isChronicleIndex && !isPagesIndex && !isPageCategory;
  const currentPage = needsPageResolution && currentPageId ? getPage(currentPageId) : null;

  const currentDisambiguation = useMemo(() => {
    if (!currentPage) return undefined;
    const colonIdx = currentPage.title.indexOf(":");
    const baseName = colonIdx > 0 && colonIdx < currentPage.title.length - 1
      ? currentPage.title.slice(colonIdx + 1).trim().toLowerCase()
      : currentPage.title.toLowerCase();
    return pageIndex.byBaseName.get(baseName);
  }, [currentPage, pageIndex.byBaseName]);

  const pageTitle = useMemo(() => {
    if (currentPage) {
      if (currentPage.type === "static") {
        const colonIdx = currentPage.title.indexOf(":");
        if (colonIdx > 0 && colonIdx < currentPage.title.length - 1) return currentPage.title.slice(colonIdx + 1).trim() || currentPage.title;
      }
      return currentPage.title;
    }
    if (isChronicleIndex) return "Chronicles";
    if (isPagesIndex) return "Pages";
    if (isPageCategory && pageCategoryNamespace) return pageCategoryNamespace;
    return null;
  }, [currentPage, isChronicleIndex, isPagesIndex, isPageCategory, pageCategoryNamespace]);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | The Ice Remembers` : "The Ice Remembers";
  }, [pageTitle]);

  if (isChronicleIndex) {
    return <ChronicleIndex chronicles={chroniclePages} eraNarrativePages={eraNarrativePages}
      filter={buildChronicleFilter(currentPageId)} onNavigate={onNavigate} />;
  }
  if (isPagesIndex) return <PagesIndex pages={staticPagesAsWikiPages} onNavigate={onNavigate} />;
  if (isPageCategory && pageCategoryNamespace) {
    return <PageCategoryIndex namespace={pageCategoryNamespace} pages={staticPagesAsWikiPages} onNavigate={onNavigate} />;
  }
  if (currentPage) {
    return <WikiPageView page={currentPage} pages={indexAsPages} entityIndex={entityIndex}
      disambiguation={currentDisambiguation} onNavigate={onNavigate}
      onNavigateToEntity={onNavigateToEntity} prominenceScale={prominenceScale} breakpoint={breakpoint} />;
  }
  return <HomePage worldData={worldData} pages={indexAsPages} chronicles={chroniclePages}
    staticPages={staticPagesAsWikiPages} categories={pageIndex.categories}
    onNavigate={onNavigate} prominenceScale={prominenceScale}
    breakpoint={breakpoint} eraNarrativeByEraId={eraNarrativeByEraId} />;
}

export default function WikiExplorer({
  projectId, worldData, loreData,
  requestedPageId, onRequestedPageConsumed,
  preloadedChronicles, preloadedStaticPages, preloadedEraNarratives,
  prebakedParchmentUrl, precomputedPageIndex,
}: Readonly<WikiExplorerProps>) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const data = useWikiExplorerData({
    projectId, worldData, loreData,
    preloadedChronicles, preloadedStaticPages, preloadedEraNarratives, precomputedPageIndex,
  });
  const { resolvePageId, resolveUrlId, resolveEntityId,
    handleRefreshIndex: refreshIndex, dataError } = data;

  const { currentPageId, searchQuery, setSearchQuery } = useHashNavigation(
    resolvePageId, resolveUrlId, requestedPageId, onRequestedPageConsumed
  );

  const handleNavigate = useCallback((pageId: string) => {
    const urlId = resolveUrlId(pageId) ?? pageId;
    const newHash = buildPageHash(urlId);
    if (window.location.hash !== newHash) window.location.hash = newHash;
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile, resolveUrlId]);

  const handleNavigateToEntity = useCallback((entityId: string) => {
    const resolved = resolveEntityId(entityId);
    if (resolved) handleNavigate(resolved);
  }, [resolveEntityId, handleNavigate]);

  const handleGoHome = useCallback(() => { window.location.hash = "#/"; }, []);
  const handleRefresh = useCallback(() => void refreshIndex(), [refreshIndex]);
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  if (dataError) return <DataErrorScreen error={dataError} />;

  return (
    <div className={styles.container}>
      <WikiExplorerSidebar isMobile={isMobile} isSidebarOpen={isSidebarOpen}
        onOpenSidebar={openSidebar} onCloseSidebar={closeSidebar}>
        {/* eslint-disable-next-line local/max-jsx-props -- WikiNav genuinely requires 13 props covering navigation state, search, data sources, and mobile drawer control */}
        <WikiNav
          categories={data.pageIndex.categories} pages={data.indexAsPages}
          chronicles={data.chroniclePages} staticPages={data.staticPagesAsWikiPages}
          currentPageId={currentPageId} searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery} onNavigate={handleNavigate}
          onGoHome={handleGoHome} onRefreshIndex={handleRefresh}
          isRefreshing={data.isRefreshing} isDrawer={isMobile} onCloseDrawer={closeSidebar}
        />
      </WikiExplorerSidebar>
      <div className={styles.main}>
        <ParchmentTexture className={styles.parchmentOverlay} config={DEFAULT_PARCHMENT_CONFIG} prebakedUrl={prebakedParchmentUrl} />
        <PageFrame className={styles.pageFrame} />
        <div className={isMobile ? styles.contentMobile : styles.content}>
          <WikiExplorerContent currentPageId={currentPageId} data={data}
            onNavigate={handleNavigate} onNavigateToEntity={handleNavigateToEntity}
            worldData={worldData} breakpoint={breakpoint} />
        </div>
      </div>
    </div>
  );
}
