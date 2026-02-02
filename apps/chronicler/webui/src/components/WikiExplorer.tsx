/**
 * WikiExplorer - Main layout for the Chronicler wiki
 *
 * MediaWiki-inspired layout with:
 * - Search bar at top
 * - Navigation sidebar (left)
 * - Content area (center)
 * - Page actions/info (right, optional)
 */

import { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import type { WorldState, LoreData, WikiPage, HardState } from '../types/world.ts';
import { useImageUrl } from '@penguin-tales/image-store';
import { buildPageIndex, buildPageById } from '../lib/wikiBuilder.ts';
import { getCompletedChroniclesForSimulation, type ChronicleRecord } from '../lib/chronicleStorage.ts';
import { getPublishedStaticPagesForProject, type StaticPage } from '../lib/staticPageStorage.ts';
import { useBreakpoint } from '../hooks/useBreakpoint.ts';
import WikiNav from './WikiNav.tsx';
import ChronicleIndex from './ChronicleIndex.tsx';
import ConfluxesIndex from './ConfluxesIndex.tsx';
import HuddlesIndex from './HuddlesIndex.tsx';
import WikiPageView from './WikiPage.tsx';
import ImageLightbox from './ImageLightbox.tsx';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  type ProminenceScale,
} from '@canonry/world-schema';
import styles from './WikiExplorer.module.css';

/**
 * Parse page ID from URL hash
 * Hash format: #/page/{pageId} or #/ for home
 */
function parseHashPageId(): string | null {
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    return null;
  }
  // Match #/page/{pageId}
  const match = hash.match(/^#\/page\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Build hash URL for a page
 */
function buildPageHash(pageId: string | null): string {
  if (!pageId) {
    return '#/';
  }
  return `#/page/${encodePageIdForHash(pageId)}`;
}

/**
 * Encode a page ID for hash routing while preserving slashes in slug paths.
 */
function encodePageIdForHash(pageId: string): string {
  return pageId.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function normalizeChronicles(records?: ChronicleRecord[]): ChronicleRecord[] {
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

function normalizeStaticPages(pages?: StaticPage[]): StaticPage[] {
  if (!pages) return [];
  return pages
    .filter((page) => page && page.pageId && page.title && page.slug)
    .map((page) => ({
      ...page,
      status: page.status || 'published',
    }))
    .filter((page) => page.status === 'published')
    .sort((a, b) => b.updatedAt - a.updatedAt);
}


interface WikiExplorerProps {
  /** Project ID - used to load static pages (project-scoped, not simulation-scoped) */
  projectId?: string;
  worldData: WorldState;
  loreData: LoreData | null;
  chronicles?: ChronicleRecord[];
  staticPages?: StaticPage[];
  /** Page ID requested by external navigation (e.g., from Archivist) */
  requestedPageId?: string | null;
  /** Callback to signal that the requested page has been consumed */
  onRequestedPageConsumed?: () => void;
  /** Whether narrative history chunks are still loading (affects confluxes, timelines) */
  narrativeHistoryLoading?: boolean;
}

export default function WikiExplorer({
  projectId,
  worldData,
  loreData,
  chronicles: chroniclesOverride,
  staticPages: staticPagesOverride,
  requestedPageId,
  onRequestedPageConsumed,
  narrativeHistoryLoading = false,
}: WikiExplorerProps) {
  // Initialize from hash on mount
  const [currentPageId, setCurrentPageId] = useState<string | null>(() => parseHashPageId());
  const [searchQuery, setSearchQuery] = useState('');

  // Responsive layout
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chronicles and static pages loaded from IndexedDB
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>(() => normalizeChronicles(chroniclesOverride));
  const [staticPages, setStaticPages] = useState<StaticPage[]>(() => normalizeStaticPages(staticPagesOverride));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const simulationRunId = (worldData as { metadata?: { simulationRunId?: string } }).metadata?.simulationRunId;
  const hasChroniclesOverride = chroniclesOverride !== undefined;
  const hasStaticPagesOverride = staticPagesOverride !== undefined;

  // Load chronicles from IndexedDB when simulationRunId changes
  useEffect(() => {
    if (hasChroniclesOverride) {
      setChronicles(normalizeChronicles(chroniclesOverride));
      return;
    }
    if (!simulationRunId) {
      setChronicles([]);
      return;
    }

    let cancelled = false;

    async function loadChronicles() {
      try {
        const loadedChronicles = await getCompletedChroniclesForSimulation(simulationRunId!);
        if (!cancelled) {
          setChronicles(loadedChronicles);
        }
      } catch (err) {
        console.error('[WikiExplorer] Failed to load chronicles:', err);
        if (!cancelled) {
          setChronicles([]);
        }
      }
    }

    loadChronicles();

    return () => {
      cancelled = true;
    };
  }, [chroniclesOverride, hasChroniclesOverride, simulationRunId]);

  // Load static pages from IndexedDB when projectId changes
  useEffect(() => {
    if (hasStaticPagesOverride) {
      setStaticPages(normalizeStaticPages(staticPagesOverride));
      return;
    }
    if (!projectId) {
      setStaticPages([]);
      return;
    }

    let cancelled = false;

    async function loadStaticPages() {
      try {
        const loadedPages = await getPublishedStaticPagesForProject(projectId!);
        if (!cancelled) {
          setStaticPages(loadedPages);
        }
      } catch (err) {
        console.error('[WikiExplorer] Failed to load static pages:', err);
        if (!cancelled) {
          setStaticPages([]);
        }
      }
    }

    loadStaticPages();

    return () => {
      cancelled = true;
    };
  }, [projectId, staticPagesOverride, hasStaticPagesOverride]);

  // Sync hash changes to state (for back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const pageId = parseHashPageId();
      setCurrentPageId(pageId);
      setSearchQuery('');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle external navigation requests (e.g., from Archivist)
  // Use useLayoutEffect to update state synchronously before paint, avoiding flash of home page
  useLayoutEffect(() => {
    if (!requestedPageId) return;

    // Update state immediately (before paint)
    setCurrentPageId(requestedPageId);
    setSearchQuery('');

    // Update hash (this will be picked up by hashchange listener for future back navigation)
    const newHash = buildPageHash(requestedPageId);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }

    // Signal that the request has been handled
    onRequestedPageConsumed?.();
  }, [requestedPageId, onRequestedPageConsumed]);

  // Validate world data before building index
  // Returns first validation error found, or null if valid
  const dataError = useMemo((): { message: string; details: string } | null => {
    for (const entity of worldData.hardState) {
      // Validate prominence is numeric
      if (typeof entity.prominence !== 'number') {
        return {
          message: 'Invalid entity data format',
          details: `Entity "${entity.name}" (${entity.id}) has prominence="${entity.prominence}" (${typeof entity.prominence}). ` +
            `Expected a number (0-5). The saved simulation data may be from an older format.`,
        };
      }
    }
    return null;
  }, [worldData]);

  const prominenceScale = useMemo(() => {
    if (dataError) {
      return buildProminenceScale([], { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
    }
    const values = worldData.hardState
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [worldData, dataError]);

  // Build lightweight page index (fast) - only if data is valid
  const { pageIndex, entityIndex } = useMemo(() => {
    if (dataError) {
      // Return empty index when data is invalid
      return {
        pageIndex: { entries: [], byId: new Map(), byName: new Map(), byAlias: new Map(), bySlug: new Map(), categories: [], byBaseName: new Map() },
        entityIndex: new Map<string, HardState>(),
      };
    }
    const pageIndex = buildPageIndex(worldData, loreData, chronicles, staticPages, prominenceScale);
    const entityIndex = new Map<string, HardState>();
    for (const entity of worldData.hardState) {
      entityIndex.set(entity.id, entity);
    }
    return { pageIndex, entityIndex };
  }, [worldData, loreData, chronicles, staticPages, dataError, prominenceScale]);

  // Page cache - stores fully built pages by ID
  // Use useMemo to create a NEW cache when data changes, ensuring synchronous invalidation
  // (useEffect runs after render, which causes stale cache reads when chunks load)
  const pageCache = useMemo(() => new Map<string, WikiPage>(), [worldData, loreData, chronicles, staticPages]);

  // Get a page from cache or build it on-demand
  const getPage = useCallback((pageId: string): WikiPage | null => {
    // Resolve slug to canonical ID for consistent caching
    const canonicalId = pageIndex.byId.has(pageId)
      ? pageId
      : (pageIndex.bySlug.get(pageId) ?? pageId);

    if (pageCache.has(canonicalId)) {
      return pageCache.get(canonicalId)!;
    }

    const page = buildPageById(
      canonicalId,
      worldData,
      loreData,
      null,
      pageIndex,
      chronicles,
      staticPages,
      prominenceScale
    );
    if (page) {
      pageCache.set(canonicalId, page);
    }
    return page;
  }, [worldData, loreData, pageIndex, chronicles, staticPages, prominenceScale, pageCache]);

  // Convert index entries to minimal WikiPage objects for navigation components
  const indexAsPages = useMemo(() => {
    return pageIndex.entries.map(entry => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      slug: entry.slug,
      chronicle: entry.chronicle,
      aliases: entry.aliases,
      content: { sections: [], summary: entry.summary },
      categories: entry.categories,
      linkedEntities: entry.linkedEntities,
      images: [],
      lastUpdated: entry.lastUpdated,
    })) as WikiPage[];
  }, [pageIndex]);

  const chroniclePages = useMemo(
    () => indexAsPages.filter((page) => page.type === 'chronicle' && page.chronicle),
    [indexAsPages]
  );

  const staticPagesAsWikiPages = useMemo(
    () => indexAsPages.filter((page) => page.type === 'static'),
    [indexAsPages]
  );

  // Get conflux pages from page index entries (need PageIndexEntry type for conflux data)
  const confluxPages = useMemo(
    () => pageIndex.entries.filter((entry) => entry.type === 'conflux'),
    [pageIndex.entries]
  );

  // Get huddle pages from page index entries
  const huddlePages = useMemo(
    () => pageIndex.entries.filter((entry) => entry.type === 'huddle-type'),
    [pageIndex.entries]
  );

  // Get current page
  const isChronicleIndex = currentPageId === 'chronicles'
    || currentPageId === 'chronicles-story'
    || currentPageId === 'chronicles-document'
    || currentPageId?.startsWith('chronicles-type-');

  const isPagesIndex = currentPageId === 'pages';

  const isConfluxesIndex = currentPageId === 'confluxes';

  const isHuddlesIndex = currentPageId === 'huddles';

  // Check if it's a page category (e.g., "page-category-System")
  const isPageCategory = currentPageId?.startsWith('page-category-');
  const pageCategoryNamespace = isPageCategory
    ? currentPageId!.replace('page-category-', '')
    : null;

  // Build current page on-demand
  const currentPage = !isChronicleIndex && !isPagesIndex && !isConfluxesIndex && !isHuddlesIndex && !isPageCategory && currentPageId
    ? getPage(currentPageId)
    : null;

  // Get disambiguation entries for current page (if any)
  const currentDisambiguation = useMemo(() => {
    if (!currentPage) return undefined;
    // Parse namespace from title (e.g., "Cultures:Aurora Stack" -> baseName: "Aurora Stack")
    const colonIdx = currentPage.title.indexOf(':');
    const baseName = colonIdx > 0 && colonIdx < currentPage.title.length - 1
      ? currentPage.title.slice(colonIdx + 1).trim().toLowerCase()
      : currentPage.title.toLowerCase();
    return pageIndex.byBaseName.get(baseName);
  }, [currentPage, pageIndex.byBaseName]);

  // Update page/tab title based on current page
  useEffect(() => {
    if (currentPage) {
      document.title = `${currentPage.title} | The Canonry`;
    } else if (isChronicleIndex) {
      document.title = 'Chronicles | The Canonry';
    } else if (isPagesIndex) {
      document.title = 'Pages | The Canonry';
    } else if (isConfluxesIndex) {
      document.title = 'Confluxes | The Canonry';
    } else if (isHuddlesIndex) {
      document.title = 'Huddles | The Canonry';
    } else if (isPageCategory && pageCategoryNamespace) {
      document.title = `${pageCategoryNamespace} | The Canonry`;
    } else {
      document.title = 'The Canonry';
    }
  }, [currentPage, isChronicleIndex, isPagesIndex, isConfluxesIndex, isHuddlesIndex, isPageCategory, pageCategoryNamespace]);

  // Handle navigation - updates hash which triggers state update via hashchange
  // Uses slug for entity/chronicle page URLs (prettier, rename-friendly)
  const handleNavigate = useCallback((pageId: string) => {
    const entry = pageIndex.byId.get(pageId);
    const urlId = (entry && (entry.type === 'entity' || entry.type === 'chronicle') && entry.slug)
      ? entry.slug
      : pageId;
    const newHash = buildPageHash(urlId);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, pageIndex]);

  const handleNavigateToEntity = useCallback((entityId: string) => {
    // Check if entity ID exists in index
    if (pageIndex.byId.has(entityId)) {
      handleNavigate(entityId);
    } else if (pageIndex.byId.has(`entity-${entityId}`)) {
      handleNavigate(`entity-${entityId}`);
    } else {
      // Try slug resolution (supports renamed entities)
      const resolvedId = pageIndex.bySlug.get(entityId);
      if (resolvedId && pageIndex.byId.has(resolvedId)) {
        handleNavigate(resolvedId);
      }
    }
  }, [pageIndex, handleNavigate]);

  const handleGoHome = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  // Refresh index by reloading chronicles and static pages from IndexedDB
  const handleRefreshIndex = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      if (hasChroniclesOverride || hasStaticPagesOverride) {
        if (hasChroniclesOverride) {
          setChronicles(normalizeChronicles(chroniclesOverride));
        }
        if (hasStaticPagesOverride) {
          setStaticPages(normalizeStaticPages(staticPagesOverride));
        }
      } else {
        const [loadedChronicles, loadedStaticPages] = await Promise.all([
          simulationRunId ? getCompletedChroniclesForSimulation(simulationRunId) : Promise.resolve([]),
          projectId ? getPublishedStaticPagesForProject(projectId) : Promise.resolve([]),
        ]);
        setChronicles(loadedChronicles);
        setStaticPages(loadedStaticPages);
      }
      // Note: Page cache automatically invalidates via useMemo when data changes
    } catch (err) {
      console.error('[WikiExplorer] Failed to refresh index:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    chroniclesOverride,
    hasChroniclesOverride,
    hasStaticPagesOverride,
    projectId,
    simulationRunId,
    staticPagesOverride,
    isRefreshing,
  ]);

  // Show data error UI
  if (dataError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h2 className={styles.errorTitle}>
              {dataError.message}
            </h2>
            <p className={styles.errorDetails}>
              {dataError.details}
            </p>
            <div className={styles.errorFix}>
              <strong>How to fix:</strong>
              <ol>
                <li>In the Canonry shell, click the <strong>"Run Slots"</strong> dropdown in the top navigation bar</li>
                <li>Click the <strong>×</strong> button next to the saved simulation slot to delete it</li>
                <li>Re-run the simulation to generate fresh data</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <WikiNav
      categories={pageIndex.categories}
      pages={indexAsPages}
      chronicles={chroniclePages}
      staticPages={staticPagesAsWikiPages}
      confluxPages={confluxPages}
      huddlePages={huddlePages}
      currentPageId={currentPageId}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onNavigate={handleNavigate}
      onGoHome={handleGoHome}
      onRefreshIndex={handleRefreshIndex}
      isRefreshing={isRefreshing}
      isDrawer={isMobile}
      onCloseDrawer={() => setIsSidebarOpen(false)}
    />
  );

  return (
    <div className={styles.container}>
      {/* Mobile: Floating menu button */}
      {isMobile && (
        <button
          className={styles.menuButton}
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
      )}

      {/* Mobile: Drawer overlay */}
      {isMobile && isSidebarOpen && (
        <>
          <div
            className={styles.sidebarBackdrop}
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className={styles.sidebarDrawer}>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Desktop/Tablet: Static sidebar */}
      {!isMobile && (
        <div className={styles.sidebar}>
          {sidebarContent}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.main}>
        <div className={isMobile ? styles.contentMobile : styles.content}>
          {isChronicleIndex ? (
            <ChronicleIndex
              chronicles={chroniclePages}
              filter={
                currentPageId === 'chronicles-story'
                  ? { kind: 'format', format: 'story' }
                  : currentPageId === 'chronicles-document'
                  ? { kind: 'format', format: 'document' }
                  : currentPageId?.startsWith('chronicles-type-')
                  ? { kind: 'type', typeId: currentPageId.replace('chronicles-type-', '') }
                  : { kind: 'all' }
              }
              onNavigate={handleNavigate}
            />
          ) : isPagesIndex ? (
            <PagesIndex
              pages={staticPagesAsWikiPages}
              onNavigate={handleNavigate}
            />
          ) : isConfluxesIndex ? (
            <ConfluxesIndex
              confluxPages={confluxPages}
              onNavigate={handleNavigate}
              narrativeHistoryLoading={narrativeHistoryLoading}
            />
          ) : isHuddlesIndex ? (
            <HuddlesIndex
              huddlePages={huddlePages}
              onNavigate={handleNavigate}
            />
          ) : isPageCategory && pageCategoryNamespace ? (
            <PageCategoryIndex
              namespace={pageCategoryNamespace}
              pages={staticPagesAsWikiPages}
              onNavigate={handleNavigate}
            />
          ) : currentPage ? (
            <WikiPageView
              page={currentPage}
              pages={indexAsPages}
              entityIndex={entityIndex}
              disambiguation={currentDisambiguation}
              onNavigate={handleNavigate}
              onNavigateToEntity={handleNavigateToEntity}
              prominenceScale={prominenceScale}
              breakpoint={breakpoint}
            />
          ) : (
            <HomePage
              worldData={worldData}
              pages={indexAsPages}
              chronicles={chroniclePages}
              staticPages={staticPagesAsWikiPages}
              categories={pageIndex.categories}
              onNavigate={handleNavigate}
              prominenceScale={prominenceScale}
              breakpoint={breakpoint}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Home page component
interface HomePageProps {
  worldData: WorldState;
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  categories: { id: string; name: string; pageCount: number }[];
  onNavigate: (pageId: string) => void;
  prominenceScale: ProminenceScale;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Weighted random selection - higher prominence = higher weight
 */
function weightedRandomSelect<T extends { prominence?: number }>(
  items: T[],
  count: number,
  prominenceScale: ProminenceScale
): T[] {
  if (items.length <= count) return items;

  // Assign weights based on prominence
  const weights: Record<string, number> = {
    mythic: 10,
    renowned: 6,
    recognized: 3,
    marginal: 1,
    forgotten: 0.5,
  };

  const weighted = items.map(item => ({
    item,
    weight: item.prominence != null
      ? weights[prominenceLabelFromScale(item.prominence, prominenceScale)] || 1
      : 1,
  }));

  const selected: T[] = [];
  const available = [...weighted];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
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

function HomePage({
  worldData,
  chronicles,
  staticPages,
  onNavigate,
  prominenceScale,
  breakpoint,
}: HomePageProps) {
  const isMobile = breakpoint === 'mobile';
  // Find System:About This Project page
  const aboutPage = useMemo(() => {
    return staticPages.find(p =>
      p.title.toLowerCase() === 'system:about this project' ||
      p.title.toLowerCase() === 'about this project'
    );
  }, [staticPages]);
  const [activeImage, setActiveImage] = useState<{
    url: string;
    title: string;
    summary?: string;
  } | null>(null);

  // Get eras
  const eras = useMemo(() =>
    worldData.hardState.filter(e => e.kind === 'era'),
    [worldData.hardState]
  );

  // Calculate link counts for each entity
  const linkStats = useMemo(() => {
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
      .filter(e => e.kind !== 'era')
      .sort((a, b) => (totalLinks.get(b.id) || 0) - (totalLinks.get(a.id) || 0));

    const mostLinked = sortedByLinks.slice(0, 5);
    const leastLinked = sortedByLinks
      .filter(e => (totalLinks.get(e.id) || 0) > 0)
      .slice(-5)
      .reverse();

    const isolated = worldData.hardState.filter(e =>
      e.kind !== 'era' && (totalLinks.get(e.id) || 0) === 0
    );

    return { totalLinks, mostLinked, leastLinked, isolated };
  }, [worldData]);

  // Featured article - single prominent entity with image and full summary
  const featuredArticle = useMemo(() => {
    // Find entities with images and summaries, prefer mythic/renowned
    const candidates = worldData.hardState.filter(e =>
      e.kind !== 'era' &&
      e.summary &&
      e.enrichment?.image?.imageId
    );
    if (candidates.length === 0) {
      // Fallback to any entity with a summary
      const withSummary = worldData.hardState.filter(e => e.kind !== 'era' && e.summary);
      if (withSummary.length === 0) return null;
      return weightedRandomSelect(withSummary, 1, prominenceScale)[0];
    }
    return weightedRandomSelect(candidates, 1, prominenceScale)[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load featured article image from the shared image store
  const featuredImageId = featuredArticle?.enrichment?.image?.imageId;
  const { url: featuredImageUrl } = useImageUrl(featuredImageId);

  const openFeaturedImage = useCallback(async () => {
    if (!featuredImageUrl || !featuredArticle) return;
    // Try to load full-size image for lightbox
    let fullUrl = featuredImageUrl;
    if (featuredArticle.enrichment?.image?.imageId) {
      try {
        const { useImageStore } = await import('@penguin-tales/image-store');
        const loaded = await useImageStore.getState().loadUrl(featuredArticle.enrichment.image.imageId, 'full');
        if (loaded) fullUrl = loaded;
      } catch {
        // Fall back to thumbnail
      }
    }
    setActiveImage({
      url: fullUrl,
      title: featuredArticle.name,
      summary: featuredArticle.summary,
    });
  }, [featuredArticle, featuredImageUrl]);

  const closeImageModal = useCallback(() => {
    setActiveImage(null);
  }, []);

  // "Did you know" - 5 random relationships as interesting facts
  const didYouKnow = useMemo(() => {
    if (worldData.relationships.length === 0) return [];
    const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

    // Shuffle and pick 5 interesting relationships
    const shuffled = [...worldData.relationships]
      .sort(() => Math.random() - 0.5)
      .slice(0, 20); // Get more, then filter for good ones

    const facts: Array<{
      srcEntity: typeof worldData.hardState[0];
      dstEntity: typeof worldData.hardState[0];
      kind: string;
    }> = [];

    for (const rel of shuffled) {
      if (facts.length >= 5) break;
      const src = entityMap.get(rel.src);
      const dst = entityMap.get(rel.dst);
      // Skip era relationships and self-references
      if (!src || !dst || src.kind === 'era' || dst.kind === 'era' || src.id === dst.id) continue;
      facts.push({ srcEntity: src, dstEntity: dst, kind: rel.kind });
    }
    return facts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entity kind distribution
  const kindDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of worldData.hardState) {
      if (entity.kind !== 'era') {
        counts.set(entity.kind, (counts.get(entity.kind) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [worldData.hardState]);

  // Format relationship kind for display
  const formatRelKind = (kind: string) => {
    return kind.replace(/_/g, ' ');
  };

  // Truncate summary to max length
  const truncateSummary = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
  };

  return (
    <div className={styles.homeContainer}>
      {/* Header with stats */}
      <div className={styles.homeHeader}>
        <h1 className={styles.homeTitle}>World Chronicle</h1>
        <div className={styles.homeStats}>
          {worldData.hardState.filter(e => e.kind !== 'era').length} entities
          {' · '}
          {worldData.relationships.length} relationships
          {eras.length > 0 && <> · {eras.length} eras</>}
        </div>
      </div>

      {/* About This Project banner - if exists */}
      {aboutPage && (
        <div className={styles.aboutBanner}>
          <div className={styles.aboutBannerText}>
            {aboutPage.content.summary || 'Learn about this world and its lore.'}
          </div>
          <button
            onClick={() => onNavigate(aboutPage.id)}
            className={styles.aboutBannerButton}
          >
            Read more &rarr;
          </button>
        </div>
      )}

      {/* Two-column layout (single column on mobile) */}
      <div className={isMobile ? styles.homeGridMobile : styles.homeGrid}>
        {/* Left column */}
        <div>
          {/* Featured Article - Wikipedia style */}
          {featuredArticle && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Featured Article</h2>
              <div className={isMobile ? styles.featuredLayoutMobile : styles.featuredLayout}>
                {featuredImageUrl && (
                  <button
                    onClick={openFeaturedImage}
                    className={isMobile ? styles.featuredImageMobile : styles.featuredImage}
                    aria-label={`Enlarge ${featuredArticle.name} image`}
                  >
                    <img
                      src={featuredImageUrl}
                      alt={featuredArticle.name}
                      className={styles.featuredImageInner}
                    />
                  </button>
                )}
                <div className={styles.featuredContent}>
                  <button
                    onClick={() => onNavigate(featuredArticle.id)}
                    className={styles.titleButton}
                  >
                    <h3 className={styles.titleButtonText}>
                      {featuredArticle.name}
                    </h3>
                  </button>
                  <div className={styles.featuredMeta}>
                    {featuredArticle.kind}
                    {featuredArticle.subtype && featuredArticle.subtype !== featuredArticle.kind && (
                      <> · {featuredArticle.subtype}</>
                    )}
                    {featuredArticle.culture && <> · {featuredArticle.culture}</>}
                  </div>
                  <p className={styles.featuredSummary}>
                    {truncateSummary(featuredArticle.summary || '', 280)}
                    {' '}
                    <button
                      onClick={() => onNavigate(featuredArticle.id)}
                      className={styles.inlineLink}
                    >
                      (Full article...)
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Did You Know - Wikipedia style */}
          {didYouKnow.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Did you know...</h2>
              <ul className={styles.didYouKnowList}>
                {didYouKnow.map((fact, idx) => (
                  <li key={idx} className={styles.didYouKnowItem}>
                    ...that{' '}
                    <button
                      onClick={() => onNavigate(fact.srcEntity.id)}
                      className={styles.entityLinkBold}
                    >
                      {fact.srcEntity.name}
                    </button>
                    {' '}has a <em>{formatRelKind(fact.kind)}</em> relationship with{' '}
                    <button
                      onClick={() => onNavigate(fact.dstEntity.id)}
                      className={styles.entityLinkBold}
                    >
                      {fact.dstEntity.name}
                    </button>
                    ?
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Eras */}
          {eras.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Eras of History</h2>
              <div className={styles.eraList}>
                {eras.map((era, idx) => (
                  <button
                    key={era.id}
                    onClick={() => onNavigate(era.id)}
                    className={styles.eraButton}
                  >
                    <span className={styles.eraNumber}>{idx + 1}</span>
                    <span className={styles.eraButtonName}>{era.name}</span>
                    {era.summary && (
                      <span className={styles.eraButtonSummary}>
                        {truncateSummary(era.summary, 40)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Most Connected - with more context */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Most Connected</h2>
            <div className={styles.entityListColumn}>
              {linkStats.mostLinked.map(entity => {
                const linkCount = linkStats.totalLinks.get(entity.id) || 0;
                return (
                  <button
                    key={entity.id}
                    onClick={() => onNavigate(entity.id)}
                    className={styles.entityListItem}
                  >
                    <div className={styles.entityListHeader}>
                      <span className={styles.entityListName}>{entity.name}</span>
                      <span className={styles.entityListBadge}>{linkCount} links</span>
                    </div>
                    <div className={styles.entityListMeta}>
                      {entity.kind}
                      {entity.culture && <> · {entity.culture}</>}
                    </div>
                    {entity.summary && (
                      <div className={styles.entityListSummary}>
                        {truncateSummary(entity.summary, 80)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hidden Gems - with more context */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Hidden Gems</h2>
            <p className={styles.sectionSubtext}>
              Lesser-known entities worth exploring
            </p>
            <div className={styles.entityListColumn}>
              {linkStats.leastLinked.map(entity => {
                const linkCount = linkStats.totalLinks.get(entity.id) || 0;
                return (
                  <button
                    key={entity.id}
                    onClick={() => onNavigate(entity.id)}
                    className={styles.entityListItem}
                  >
                    <div className={styles.entityListHeader}>
                      <span className={styles.entityListName}>{entity.name}</span>
                      <span className={styles.entityListBadge}>{linkCount} links</span>
                    </div>
                    <div className={styles.entityListMeta}>
                      {entity.kind}
                      {entity.culture && <> · {entity.culture}</>}
                    </div>
                    {entity.summary && (
                      <div className={styles.entityListSummary}>
                        {truncateSummary(entity.summary, 80)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {linkStats.isolated.length > 0 && (
              <div className={styles.sectionFootnote}>
                + {linkStats.isolated.length} isolated entities with no connections
              </div>
            )}
          </div>

          {/* Browse by Type */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Browse by Type</h2>
            <div className={styles.browseTypeGrid}>
              {kindDistribution.map(([kind, count]) => (
                <button
                  key={kind}
                  onClick={() => onNavigate(`category-kind-${kind}`)}
                  className={styles.browseTypeButton}
                >
                  {kind} <span className={styles.browseTypeCount}>({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chronicles */}
          {chronicles.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Chronicles</h2>
              <div className={styles.chroniclesList}>
                {chronicles.slice(0, 4).map(chronicle => (
                  <button
                    key={chronicle.id}
                    onClick={() => onNavigate(chronicle.id)}
                    className={styles.chronicleItem}
                  >
                    <span>{chronicle.title}</span>
                    <span className={styles.chronicleFormat}>
                      {chronicle.chronicle?.format === 'story' ? 'Story' : 'Document'}
                    </span>
                  </button>
                ))}
              </div>
              {chronicles.length > 4 && (
                <button
                  onClick={() => onNavigate('chronicles')}
                  className={styles.viewAllButton}
                >
                  View all {chronicles.length} chronicles &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ImageLightbox
        isOpen={Boolean(activeImage)}
        imageUrl={activeImage?.url || null}
        title={activeImage?.title || ''}
        summary={activeImage?.summary}
        onClose={closeImageModal}
      />
    </div>
  );
}

// Pages Index component
interface PagesIndexProps {
  pages: WikiPage[];
  onNavigate: (pageId: string) => void;
}

function PagesIndex({ pages, onNavigate }: PagesIndexProps) {
  // Group pages by namespace
  const pagesByNamespace = useMemo(() => {
    const grouped = new Map<string, WikiPage[]>();
    for (const page of pages) {
      const colonIndex = page.title.indexOf(':');
      const namespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
      if (!grouped.has(namespace)) {
        grouped.set(namespace, []);
      }
      grouped.get(namespace)!.push(page);
    }
    // Sort namespaces, keeping General at end
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === 'General') return 1;
      if (b[0] === 'General') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [pages]);

  return (
    <div className={styles.pagesIndexContainer}>
      <h1 className={styles.pagesIndexTitle}>Pages</h1>
      <p className={styles.pagesIndexDescription}>
        User-authored pages providing additional world context, cultural overviews, and lore articles.
      </p>

      {pages.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📝</div>
          <div className={styles.emptyStateTitle}>No pages yet</div>
          <div className={styles.emptyStateDescription}>
            Create and publish pages in Illuminator to see them here.
          </div>
        </div>
      ) : (
        <div className={styles.pageList}>
          {pagesByNamespace.map(([namespace, pagesInNs]) => (
            <div key={namespace} className={styles.namespaceGroup}>
              <h2 className={styles.namespaceTitle}>{namespace}</h2>
              <div className={styles.pageList}>
                {pagesInNs.map(page => (
                  <button
                    key={page.id}
                    onClick={() => onNavigate(page.id)}
                    className={styles.pageItem}
                  >
                    {page.title}
                    {page.content.summary && (
                      <div className={styles.pageItemSummary}>
                        {page.content.summary}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Page Category Index - shows pages filtered by namespace
interface PageCategoryIndexProps {
  namespace: string;
  pages: WikiPage[];
  onNavigate: (pageId: string) => void;
}

function PageCategoryIndex({ namespace, pages, onNavigate }: PageCategoryIndexProps) {
  // Filter pages to this namespace
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const colonIndex = page.title.indexOf(':');
      const pageNamespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
      return pageNamespace === namespace;
    });
  }, [pages, namespace]);

  return (
    <div className={styles.pagesIndexContainer}>
      <h1 className={styles.pagesIndexTitle}>{namespace} Pages</h1>
      <p className={styles.pagesIndexDescription}>
        {namespace === 'General'
          ? 'Pages without a namespace prefix.'
          : `Pages in the ${namespace} namespace.`}
      </p>

      {filteredPages.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📝</div>
          <div className={styles.emptyStateTitle}>No pages in this category</div>
        </div>
      ) : (
        <div className={styles.pageList}>
          {filteredPages.map(page => (
            <button
              key={page.id}
              onClick={() => onNavigate(page.id)}
              className={styles.pageItem}
            >
              {page.title}
              {page.content.summary && (
                <div className={styles.pageItemSummary}>
                  {page.content.summary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
