/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Browse by category
 * - Search, Home, Random at bottom
 */

import React, { useCallback } from "react";
import type { WikiPage, WikiCategory } from "../types/world.ts";
import { useExpandSet } from "@the-canonry/shared-components";
import WikiSearch from "./WikiSearch.tsx";
import styles from "./WikiNav.module.css";

interface WikiNavProps {
  categories: WikiCategory[];
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  currentPageId: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onNavigate: (pageId: string) => void;
  onGoHome: () => void;
  onRefreshIndex?: () => void;
  isRefreshing?: boolean;
  /** When true, nav is displayed as a mobile drawer */
  isDrawer?: boolean;
  /** Callback to close the drawer */
  onCloseDrawer?: () => void;
}

interface EraGroup {
  eraId: string;
  eraName: string;
  eraOrder: number;
  stories: WikiPage[];
  documents: WikiPage[];
  all: WikiPage[];
}

/** Categorize static pages by namespace prefix */
function categorizeStaticPages(staticPages: readonly WikiPage[]) {
  const frontMatterPages: WikiPage[] = [];
  const lorePages: WikiPage[] = [];
  const culturePages: WikiPage[] = [];
  const systemPages: WikiPage[] = [];
  const otherPages: WikiPage[] = [];

  for (const page of staticPages) {
    const title = page.title;
    if (title === "Lore:Foreword to the Annotated Chronicle") {
      frontMatterPages.unshift(page);
    } else if (title === "System:About This Project") {
      frontMatterPages.push(page);
    } else if (title.startsWith("Lore:")) {
      lorePages.push(page);
    } else if (title.startsWith("Cultures:")) {
      culturePages.push(page);
    } else if (title.startsWith("System:")) {
      systemPages.push(page);
    } else {
      otherPages.push(page);
    }
  }

  lorePages.sort((a, b) =>
    a.title.replace("Lore:", "").localeCompare(b.title.replace("Lore:", ""))
  );
  culturePages.sort((a, b) =>
    a.title.replace("Cultures:", "").localeCompare(b.title.replace("Cultures:", ""))
  );
  systemPages.sort((a, b) =>
    a.title.replace("System:", "").localeCompare(b.title.replace("System:", ""))
  );

  return { frontMatterPages, lorePages, culturePages, systemPages, otherPages };
}

/** Group chronicle pages by era and sort chronologically */
function buildChronicleEras(chroniclePages: readonly WikiPage[], allPages: readonly WikiPage[]) {
  const eraNarrativeByEraId = new Map<string, WikiPage>();
  for (const page of allPages) {
    if (page.type === "era_narrative" && page.eraNarrative?.eraId) {
      eraNarrativeByEraId.set(page.eraNarrative.eraId, page);
    }
  }

  const chroniclesByEra = new Map<string, EraGroup>();
  for (const page of chroniclePages) {
    const focalEra = page.chronicle?.temporalContext?.focalEra;
    const eraId = focalEra?.id || "unknown";
    const eraName = focalEra?.name || "Unknown Era";
    const eraOrder = focalEra?.order ?? focalEra?.startTick ?? Infinity;

    if (!chroniclesByEra.has(eraId)) {
      chroniclesByEra.set(eraId, { eraId, eraName, eraOrder, stories: [], documents: [], all: [] });
    }

    const group = chroniclesByEra.get(eraId)!;
    group.all.push(page);
    if (page.chronicle?.format === "story") {
      group.stories.push(page);
    } else if (page.chronicle?.format === "document") {
      group.documents.push(page);
    }
  }

  const sortedEras = Array.from(chroniclesByEra.values()).sort((a, b) => a.eraOrder - b.eraOrder);
  return { sortedEras, eraNarrativeByEraId };
}

// ---------------------------------------------------------------------------
// Sub-components extracted to reduce complexity
// ---------------------------------------------------------------------------

function NavPageButton({
  page,
  currentPageId,
  onNavigate,
  displayName,
}: Readonly<{
  page: WikiPage;
  currentPageId: string | null;
  onNavigate: (id: string) => void;
  displayName?: string;
}>) {
  const isActive = currentPageId === page.id;
  return (
    <button
      key={page.id}
      className={isActive ? styles.navItemActive : styles.navItem}
      onClick={() => onNavigate(page.id)}
    >
      {displayName ?? page.title}
    </button>
  );
}

function CollapsibleSection({
  label,
  count,
  expanded,
  onToggle,
  children,
}: Readonly<{
  label: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.section}>
      <button
        className={styles.sectionTitleCollapsible}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.collapseIcon}>{expanded ? "\u25BC" : "\u25B6"}</span>
        {label}
        {count != null && <span className={styles.badge}>({count})</span>}
      </button>
      {expanded && children}
    </div>
  );
}

function EraSection({
  era,
  isExpanded,
  onToggle,
  currentPageId,
  onNavigate,
  eraNarrativePage,
}: Readonly<{
  era: EraGroup;
  isExpanded: boolean;
  onToggle: () => void;
  currentPageId: string | null;
  onNavigate: (id: string) => void;
  eraNarrativePage: WikiPage | undefined;
}>) {
  const eraAllId = `chronicles-era-${era.eraId}`;
  const eraStoriesId = `chronicles-era-${era.eraId}-story`;
  const eraDocsId = `chronicles-era-${era.eraId}-document`;

  return (
    <div key={era.eraId}>
      <button
        className={styles.eraSectionTitle}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className={styles.collapseIcon}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
        {era.eraName}
        <span className={styles.badge}>({era.all.length})</span>
      </button>
      {isExpanded && (
        <>
          {eraNarrativePage && (
            <button
              className={
                currentPageId === eraNarrativePage.id
                  ? styles.navItemEraNarrativeActive
                  : styles.navItemEraNarrative
              }
              onClick={() => onNavigate(eraNarrativePage.id)}
            >
              Era Narrative
            </button>
          )}
          <EraNavButton
            label="View All"
            id={eraAllId}
            count={era.all.length}
            currentPageId={currentPageId}
            onNavigate={onNavigate}
          />
          {era.stories.length > 0 && (
            <EraNavButton
              label="Stories"
              id={eraStoriesId}
              count={era.stories.length}
              currentPageId={currentPageId}
              onNavigate={onNavigate}
            />
          )}
          {era.documents.length > 0 && (
            <EraNavButton
              label="Documents"
              id={eraDocsId}
              count={era.documents.length}
              currentPageId={currentPageId}
              onNavigate={onNavigate}
            />
          )}
        </>
      )}
    </div>
  );
}

function EraNavButton({
  label,
  id,
  count,
  currentPageId,
  onNavigate,
}: Readonly<{
  label: string;
  id: string;
  count: number;
  currentPageId: string | null;
  onNavigate: (id: string) => void;
}>) {
  const isActive = currentPageId === id;
  return (
    <button
      className={isActive ? styles.navItemIndentedActive : styles.navItemIndented}
      onClick={() => onNavigate(id)}
    >
      {label}
      <span className={isActive ? styles.badgeActive : styles.badge}>({count})</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WikiNav({
  categories,
  pages,
  chronicles,
  staticPages,
  currentPageId,
  searchQuery,
  onSearchQueryChange,
  onNavigate,
  onGoHome,
  onRefreshIndex,
  isRefreshing,
  isDrawer,
  onCloseDrawer,
}: Readonly<WikiNavProps>) {
  // Collapsible section state
  const { expanded: expandedSections, toggle: toggleSection } = useExpandSet();
  const loreExpanded = expandedSections.has("lore");
  const appendicesExpanded = expandedSections.has("appendices");

  const { expanded: expandedEras, toggle: toggleEra } = useExpandSet();

  // Get top categories for quick access (entity kinds)
  const topCategories = categories.filter((c) => c.id.startsWith("kind-")).slice(0, 10);

  const { frontMatterPages, lorePages, culturePages, systemPages, otherPages } =
    categorizeStaticPages(staticPages);

  const chroniclePages = chronicles.filter((page) => page.chronicle);
  const storyChronicles = chroniclePages.filter((page) => page.chronicle?.format === "story");
  const documentChronicles = chroniclePages.filter((page) => page.chronicle?.format === "document");

  const { sortedEras, eraNarrativeByEraId } = buildChronicleEras(chroniclePages, pages);

  // Random page function
  const handleRandomPage = useCallback(() => {
    const entityPages = pages.filter((p) => p.type === "entity" || p.type === "era");
    if (entityPages.length > 0) {
      // eslint-disable-next-line sonarjs/pseudo-random -- non-security random page selection
      const randomIndex = Math.floor(Math.random() * entityPages.length);
      onNavigate(entityPages[randomIndex].id);
    }
  }, [pages, onNavigate]);

  return (
    <div className={styles.container}>
      {/* Drawer header with close button (mobile only) */}
      {isDrawer && (
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Navigation</span>
          <button
            onClick={onCloseDrawer}
            className={styles.drawerClose}
            aria-label="Close navigation"
          >
            &times;
          </button>
        </div>
      )}

      <nav className={styles.nav}>
        {/* FRONT MATTER - Key introductory pages */}
        {frontMatterPages.length > 0 && (
          <div className={styles.section}>
            {frontMatterPages.map((page) => {
              const displayName = page.title.includes(":") ? page.title.split(":")[1] : page.title;
              return (
                <NavPageButton
                  key={page.id}
                  page={page}
                  currentPageId={currentPageId}
                  onNavigate={onNavigate}
                  displayName={displayName}
                />
              );
            })}
          </div>
        )}

        {/* LORE - World essays and background (collapsible) */}
        {lorePages.length > 0 && (
          <CollapsibleSection
            label="Lore"
            count={lorePages.length}
            expanded={loreExpanded}
            onToggle={() => toggleSection("lore")}
          >
            {lorePages.map((page) => (
              <NavPageButton
                key={page.id}
                page={page}
                currentPageId={currentPageId}
                onNavigate={onNavigate}
                displayName={page.title.replace("Lore:", "")}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* CHRONICLES - The stories, organized by era */}
        {chroniclePages.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Chronicles</div>

            {/* Era sections */}
            {sortedEras.map((era) => (
              <EraSection
                key={era.eraId}
                era={era}
                isExpanded={expandedEras.has(era.eraId)}
                onToggle={() => toggleEra(era.eraId)}
                currentPageId={currentPageId}
                onNavigate={onNavigate}
                eraNarrativePage={eraNarrativeByEraId.get(era.eraId)}
              />
            ))}

            {/* All Stories / All Documents at bottom */}
            {storyChronicles.length > 0 && (
              <EraNavButton
                label="All Stories"
                id="chronicles-story"
                count={storyChronicles.length}
                currentPageId={currentPageId}
                onNavigate={onNavigate}
              />
            )}
            {documentChronicles.length > 0 && (
              <EraNavButton
                label="All Documents"
                id="chronicles-document"
                count={documentChronicles.length}
                currentPageId={currentPageId}
                onNavigate={onNavigate}
              />
            )}
          </div>
        )}

        {/* ENCYCLOPEDIA - Entity browsing */}
        {topCategories.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Encyclopedia</div>
            {topCategories.map((category) => {
              const isActive = currentPageId === `category-${category.id}`;
              return (
                <button
                  key={category.id}
                  className={isActive ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate(`category-${category.id}`)}
                >
                  {category.name.replace("Kind: ", "")}
                  <span className={isActive ? styles.badgeActive : styles.badge}>
                    ({category.pageCount})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* CULTURES - Cultural reference pages */}
        {culturePages.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Cultures</div>
            {culturePages.map((page) => (
              <NavPageButton
                key={page.id}
                page={page}
                currentPageId={currentPageId}
                onNavigate={onNavigate}
                displayName={page.title.replace("Cultures:", "")}
              />
            ))}
          </div>
        )}

        {/* APPENDICES - Collapsible section for reference material */}
        <CollapsibleSection
          label="Appendices"
          expanded={appendicesExpanded}
          onToggle={() => toggleSection("appendices")}
        >
          {/* System pages */}
          {systemPages.map((page) => (
            <NavPageButton
              key={page.id}
              page={page}
              currentPageId={currentPageId}
              onNavigate={onNavigate}
              displayName={page.title.replace("System:", "")}
            />
          ))}

          {/* Other uncategorized pages */}
          {otherPages.map((page) => (
            <NavPageButton
              key={page.id}
              page={page}
              currentPageId={currentPageId}
              onNavigate={onNavigate}
            />
          ))}

          {/* All Categories */}
          <button
            className={
              currentPageId === "all-categories" ? styles.navItemActive : styles.navItem
            }
            onClick={() => onNavigate("all-categories")}
          >
            All Categories
            <span
              className={currentPageId === "all-categories" ? styles.badgeActive : styles.badge}
            >
              ({categories.length})
            </span>
          </button>
        </CollapsibleSection>

        {/* Refresh Index */}
        {onRefreshIndex && (
          <div className={styles.section}>
            <button
              className={styles.refreshButton}
              onClick={onRefreshIndex}
              disabled={isRefreshing}
            >
              {isRefreshing && <span className={styles.refreshSpinner}>&orarr;</span>}
              {isRefreshing ? "Refreshing..." : "Refresh Index"}
            </button>
          </div>
        )}
      </nav>

      {/* Bottom Section - Search and Links */}
      <div className={styles.bottomSection}>
        <WikiSearch
          pages={pages}
          query={searchQuery}
          onQueryChange={onSearchQueryChange}
          onSelect={onNavigate}
          expandDirection="up"
        />
        <div className={styles.bottomLinks}>
          <button
            className={currentPageId === null ? styles.navItemActive : styles.bottomLink}
            onClick={onGoHome}
          >
            Home
          </button>
          <button className={styles.bottomLink} onClick={handleRandomPage}>
            Random
          </button>
        </div>
      </div>
    </div>
  );
}
