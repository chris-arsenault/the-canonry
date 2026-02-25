/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Browse by category
 * - Search, Home, Random at bottom
 */

import { useState } from "react";
import type { WikiPage, WikiCategory } from "../types/world.ts";
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
}: WikiNavProps) {
  // Collapsible section state
  const [loreExpanded, setLoreExpanded] = useState(false);
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [appendicesExpanded, setAppendicesExpanded] = useState(false);

  // Get top categories for quick access (entity kinds)
  const topCategories = categories.filter((c) => c.id.startsWith("kind-")).slice(0, 10);

  // Organize static pages by namespace
  const frontMatterPages: WikiPage[] = [];
  const lorePages: WikiPage[] = [];
  const culturePages: WikiPage[] = [];
  const systemPages: WikiPage[] = [];
  const otherPages: WikiPage[] = [];

  for (const page of staticPages) {
    const title = page.title;
    // Front matter: specific key pages
    if (title === "Lore:Foreword to the Annotated Chronicle") {
      frontMatterPages.unshift(page); // Foreword first
    } else if (title === "System:About This Project") {
      frontMatterPages.push(page); // About second
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

  // Sort lore pages alphabetically by title (without prefix)
  lorePages.sort((a, b) =>
    a.title.replace("Lore:", "").localeCompare(b.title.replace("Lore:", ""))
  );
  culturePages.sort((a, b) =>
    a.title.replace("Cultures:", "").localeCompare(b.title.replace("Cultures:", ""))
  );
  systemPages.sort((a, b) =>
    a.title.replace("System:", "").localeCompare(b.title.replace("System:", ""))
  );

  // Random page function
  const handleRandomPage = () => {
    const entityPages = pages.filter((p) => p.type === "entity" || p.type === "era");
    if (entityPages.length > 0) {
      const randomIndex = Math.floor(Math.random() * entityPages.length);
      onNavigate(entityPages[randomIndex].id);
    }
  };

  const chroniclePages = chronicles.filter((page) => page.chronicle);
  const storyChronicles = chroniclePages.filter((page) => page.chronicle?.format === "story");
  const documentChronicles = chroniclePages.filter((page) => page.chronicle?.format === "document");

  // Build era narrative lookup from all pages (eraId -> page)
  const eraNarrativeByEraId = new Map<string, WikiPage>();
  for (const page of pages) {
    if (page.type === "era_narrative" && page.eraNarrative?.eraId) {
      eraNarrativeByEraId.set(page.eraNarrative.eraId, page);
    }
  }

  // Group chronicles by era
  const chroniclesByEra = chroniclePages.reduce((groups, page) => {
    const focalEra = page.chronicle?.temporalContext?.focalEra;
    const eraId = focalEra?.id || "unknown";
    const eraName = focalEra?.name || "Unknown Era";
    const eraOrder = focalEra?.order ?? focalEra?.startTick ?? Infinity;

    if (!groups.has(eraId)) {
      groups.set(eraId, { eraId, eraName, eraOrder, stories: [], documents: [], all: [] });
    }

    const group = groups.get(eraId)!;
    group.all.push(page);
    if (page.chronicle?.format === "story") {
      group.stories.push(page);
    } else if (page.chronicle?.format === "document") {
      group.documents.push(page);
    }

    return groups;
  }, new Map<string, { eraId: string; eraName: string; eraOrder: number; stories: WikiPage[]; documents: WikiPage[]; all: WikiPage[] }>());

  // Sort eras chronologically (by order or startTick)
  const sortedEras = Array.from(chroniclesByEra.values()).sort((a, b) => a.eraOrder - b.eraOrder);

  const toggleEra = (eraId: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraId)) {
        next.delete(eraId);
      } else {
        next.add(eraId);
      }
      return next;
    });
  };

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
            ×
          </button>
        </div>
      )}

      <nav className={styles.nav}>
        {/* FRONT MATTER - Key introductory pages */}
        {frontMatterPages.length > 0 && (
          <div className={styles.section}>
            {frontMatterPages.map((page) => {
              const isActive = currentPageId === page.id;
              // Display name without namespace prefix
              const displayName = page.title.includes(":") ? page.title.split(":")[1] : page.title;
              return (
                <button
                  key={page.id}
                  className={isActive ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate(page.id)}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        )}

        {/* LORE - World essays and background (collapsible) */}
        {lorePages.length > 0 && (
          <div className={styles.section}>
            <button
              className={styles.sectionTitleCollapsible}
              onClick={() => setLoreExpanded(!loreExpanded)}
              aria-expanded={loreExpanded}
            >
              <span className={styles.collapseIcon}>{loreExpanded ? "▼" : "▶"}</span>
              Lore
              <span className={styles.badge}>({lorePages.length})</span>
            </button>
            {loreExpanded &&
              lorePages.map((page) => {
                const isActive = currentPageId === page.id;
                const displayName = page.title.replace("Lore:", "");
                return (
                  <button
                    key={page.id}
                    className={isActive ? styles.navItemActive : styles.navItem}
                    onClick={() => onNavigate(page.id)}
                  >
                    {displayName}
                  </button>
                );
              })}
          </div>
        )}

        {/* CHRONICLES - The stories, organized by era */}
        {chroniclePages.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Chronicles</div>

            {/* Era sections */}
            {sortedEras.map((era) => {
              const isExpanded = expandedEras.has(era.eraId);
              const eraAllId = `chronicles-era-${era.eraId}`;
              const eraStoriesId = `chronicles-era-${era.eraId}-story`;
              const eraDocsId = `chronicles-era-${era.eraId}-document`;

              return (
                <div key={era.eraId}>
                  <button
                    className={styles.sectionTitleCollapsible}
                    onClick={() => toggleEra(era.eraId)}
                    aria-expanded={isExpanded}
                    style={{ paddingLeft: "4px", fontSize: "var(--font-size-sm)" }}
                  >
                    <span className={styles.collapseIcon}>{isExpanded ? "▼" : "▶"}</span>
                    {era.eraName}
                    <span className={styles.badge}>({era.all.length})</span>
                  </button>
                  {isExpanded && (
                    <>
                      {eraNarrativeByEraId.has(era.eraId) &&
                        (() => {
                          const narrativePage = eraNarrativeByEraId.get(era.eraId)!;
                          const isActive = currentPageId === narrativePage.id;
                          return (
                            <button
                              className={isActive ? styles.navItemActive : styles.navItem}
                              onClick={() => onNavigate(narrativePage.id)}
                              style={{ paddingLeft: "24px", fontStyle: "italic" }}
                            >
                              Era Narrative
                            </button>
                          );
                        })()}
                      <button
                        className={
                          currentPageId === eraAllId ? styles.navItemActive : styles.navItem
                        }
                        onClick={() => onNavigate(eraAllId)}
                        style={{ paddingLeft: "24px" }}
                      >
                        View All
                        <span
                          className={currentPageId === eraAllId ? styles.badgeActive : styles.badge}
                        >
                          ({era.all.length})
                        </span>
                      </button>
                      {era.stories.length > 0 && (
                        <button
                          className={
                            currentPageId === eraStoriesId ? styles.navItemActive : styles.navItem
                          }
                          onClick={() => onNavigate(eraStoriesId)}
                          style={{ paddingLeft: "24px" }}
                        >
                          Stories
                          <span
                            className={
                              currentPageId === eraStoriesId ? styles.badgeActive : styles.badge
                            }
                          >
                            ({era.stories.length})
                          </span>
                        </button>
                      )}
                      {era.documents.length > 0 && (
                        <button
                          className={
                            currentPageId === eraDocsId ? styles.navItemActive : styles.navItem
                          }
                          onClick={() => onNavigate(eraDocsId)}
                          style={{ paddingLeft: "24px" }}
                        >
                          Documents
                          <span
                            className={
                              currentPageId === eraDocsId ? styles.badgeActive : styles.badge
                            }
                          >
                            ({era.documents.length})
                          </span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* All Stories / All Documents at bottom */}
            {storyChronicles.length > 0 && (
              <button
                className={
                  currentPageId === "chronicles-story" ? styles.navItemActive : styles.navItem
                }
                onClick={() => onNavigate("chronicles-story")}
              >
                All Stories
                <span
                  className={
                    currentPageId === "chronicles-story" ? styles.badgeActive : styles.badge
                  }
                >
                  ({storyChronicles.length})
                </span>
              </button>
            )}
            {documentChronicles.length > 0 && (
              <button
                className={
                  currentPageId === "chronicles-document" ? styles.navItemActive : styles.navItem
                }
                onClick={() => onNavigate("chronicles-document")}
              >
                All Documents
                <span
                  className={
                    currentPageId === "chronicles-document" ? styles.badgeActive : styles.badge
                  }
                >
                  ({documentChronicles.length})
                </span>
              </button>
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
            {culturePages.map((page) => {
              const isActive = currentPageId === page.id;
              const displayName = page.title.replace("Cultures:", "");
              return (
                <button
                  key={page.id}
                  className={isActive ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate(page.id)}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        )}

        {/* APPENDICES - Collapsible section for reference material */}
        <div className={styles.section}>
          <button
            className={styles.sectionTitleCollapsible}
            onClick={() => setAppendicesExpanded(!appendicesExpanded)}
            aria-expanded={appendicesExpanded}
          >
            <span className={styles.collapseIcon}>{appendicesExpanded ? "▼" : "▶"}</span>
            Appendices
          </button>
          {appendicesExpanded && (
            <>
              {/* System pages */}
              {systemPages.length > 0 &&
                systemPages.map((page) => {
                  const isActive = currentPageId === page.id;
                  const displayName = page.title.replace("System:", "");
                  return (
                    <button
                      key={page.id}
                      className={isActive ? styles.navItemActive : styles.navItem}
                      onClick={() => onNavigate(page.id)}
                    >
                      {displayName}
                    </button>
                  );
                })}

              {/* Other uncategorized pages */}
              {otherPages.length > 0 &&
                otherPages.map((page) => {
                  const isActive = currentPageId === page.id;
                  return (
                    <button
                      key={page.id}
                      className={isActive ? styles.navItemActive : styles.navItem}
                      onClick={() => onNavigate(page.id)}
                    >
                      {page.title}
                    </button>
                  );
                })}

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
            </>
          )}
        </div>

        {/* Refresh Index */}
        {onRefreshIndex && (
          <div className={styles.section}>
            <button
              className={styles.refreshButton}
              onClick={onRefreshIndex}
              disabled={isRefreshing}
            >
              {isRefreshing && <span className={styles.refreshSpinner}>↻</span>}
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
