/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Browse by category
 * - Search, Home, Random at bottom
 */

import { useState } from 'react';
import type { WikiPage, WikiCategory, PageIndexEntry } from '../types/world.ts';
import WikiSearch from './WikiSearch.tsx';
import styles from './WikiNav.module.css';

interface WikiNavProps {
  categories: WikiCategory[];
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  confluxPages: PageIndexEntry[];
  huddlePages: PageIndexEntry[];
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
  confluxPages,
  huddlePages,
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
  // Collapsible section state (confluxes and huddles default to collapsed)
  const [confluxesExpanded, setConfluxesExpanded] = useState(false);
  const [huddlesExpanded, setHuddlesExpanded] = useState(false);
  const [showChronicleTypes, setShowChronicleTypes] = useState(false);

  // Get top categories for quick access
  const topCategories = categories
    .filter(c => c.id.startsWith('kind-'))
    .slice(0, 10);

  // Random page function
  const handleRandomPage = () => {
    const entityPages = pages.filter(p => p.type === 'entity' || p.type === 'era');
    if (entityPages.length > 0) {
      const randomIndex = Math.floor(Math.random() * entityPages.length);
      onNavigate(entityPages[randomIndex].id);
    }
  };

  const chroniclePages = chronicles.filter((page) => page.chronicle);
  const storyChronicles = chroniclePages.filter((page) => page.chronicle?.format === 'story');
  const documentChronicles = chroniclePages.filter((page) => page.chronicle?.format === 'document');

  const formatChronicleSubtype = (typeId: string) => {
    return typeId
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const chronicleTypeGroups = chroniclePages.reduce((groups, page) => {
    const typeId = page.chronicle?.narrativeStyleId || 'unknown';
    if (!groups.has(typeId)) {
      groups.set(typeId, []);
    }
    groups.get(typeId)?.push(page);
    return groups;
  }, new Map<string, WikiPage[]>());

  const sortedChronicleTypeGroups = Array.from(chronicleTypeGroups.entries())
    .map(([typeId, pages]) => ({
      typeId,
      label: typeId === 'unknown' ? 'Unknown Type' : formatChronicleSubtype(typeId),
      pages,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

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

      {/* Browse by Type */}
      {topCategories.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Browse by Type</div>
          {topCategories.map(category => {
            const isActive = currentPageId === `category-${category.id}`;
            return (
              <button
                key={category.id}
                className={isActive ? styles.navItemActive : styles.navItem}
                onClick={() => onNavigate(`category-${category.id}`)}
              >
                {category.name.replace('Kind: ', '')}
                <span className={isActive ? styles.badgeActive : styles.badge}>({category.pageCount})</span>
              </button>
            );
          })}
        </div>
      )}

      {chroniclePages.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionTitleLabel}>Chronicles</span>
            <label className={styles.sectionToggle}>
              <input
                type="checkbox"
                checked={showChronicleTypes}
                onChange={(event) => setShowChronicleTypes(event.target.checked)}
              />
              Types
            </label>
          </div>
          <button
            className={currentPageId === 'chronicles' ? styles.navItemActive : styles.navItem}
            onClick={() => onNavigate('chronicles')}
          >
            All Chronicles
            <span className={currentPageId === 'chronicles' ? styles.badgeActive : styles.badge}>({chroniclePages.length})</span>
          </button>
          {showChronicleTypes ? (
            sortedChronicleTypeGroups.map((group) => {
              const targetId = `chronicles-type-${group.typeId}`;
              const isActive = currentPageId === targetId;
              return (
                <button
                  key={group.typeId}
                  className={isActive ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate(targetId)}
                >
                  {group.label}
                  <span className={isActive ? styles.badgeActive : styles.badge}>({group.pages.length})</span>
                </button>
              );
            })
          ) : (
            <>
              {storyChronicles.length > 0 && (
                <button
                  className={currentPageId === 'chronicles-story' ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate('chronicles-story')}
                >
                  Stories
                  <span className={currentPageId === 'chronicles-story' ? styles.badgeActive : styles.badge}>({storyChronicles.length})</span>
                </button>
              )}
              {documentChronicles.length > 0 && (
                <button
                  className={currentPageId === 'chronicles-document' ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate('chronicles-document')}
                >
                  Documents
                  <span className={currentPageId === 'chronicles-document' ? styles.badgeActive : styles.badge}>({documentChronicles.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Static Pages - show by namespace category (moved above confluxes/huddles) */}
      {staticPages.length > 0 && (() => {
        // Group pages by namespace prefix (e.g., "System:", "Cultures:", "Names:")
        const pagesByNamespace = new Map<string, WikiPage[]>();
        for (const page of staticPages) {
          const colonIndex = page.title.indexOf(':');
          const namespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
          if (!pagesByNamespace.has(namespace)) {
            pagesByNamespace.set(namespace, []);
          }
          pagesByNamespace.get(namespace)!.push(page);
        }

        // Sort namespaces alphabetically, but keep "General" at the end
        const sortedNamespaces = Array.from(pagesByNamespace.keys()).sort((a, b) => {
          if (a === 'General') return 1;
          if (b === 'General') return -1;
          return a.localeCompare(b);
        });

        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Pages</div>
            <button
              className={currentPageId === 'pages' ? styles.navItemActive : styles.navItem}
              onClick={() => onNavigate('pages')}
            >
              All Pages
              <span className={currentPageId === 'pages' ? styles.badgeActive : styles.badge}>({staticPages.length})</span>
            </button>
            {sortedNamespaces.map(namespace => {
              const isActive = currentPageId === `page-category-${namespace}`;
              return (
                <button
                  key={namespace}
                  className={isActive ? styles.navItemActive : styles.navItem}
                  onClick={() => onNavigate(`page-category-${namespace}`)}
                >
                  {namespace}
                  <span className={isActive ? styles.badgeActive : styles.badge}>({pagesByNamespace.get(namespace)!.length})</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Confluxes - collapsible, default collapsed */}
      {confluxPages.length > 0 && (
        <div className={styles.section}>
          <button
            className={styles.sectionTitleCollapsible}
            onClick={() => setConfluxesExpanded(!confluxesExpanded)}
            aria-expanded={confluxesExpanded}
          >
            <span className={styles.collapseIcon}>{confluxesExpanded ? '▼' : '▶'}</span>
            Confluxes
            <span className={styles.badge}>({confluxPages.length})</span>
          </button>
          {confluxesExpanded && (
            <>
              <button
                className={currentPageId === 'confluxes' ? styles.navItemActive : styles.navItem}
                onClick={() => onNavigate('confluxes')}
              >
                All Confluxes
                <span className={currentPageId === 'confluxes' ? styles.badgeActive : styles.badge}>({confluxPages.length})</span>
              </button>
              {/* Show 5 rarest confluxes */}
              {confluxPages
                .sort((a, b) => (a.conflux?.manifestations ?? 0) - (b.conflux?.manifestations ?? 0))
                .slice(0, 5)
                .map(page => {
                  const isActive = currentPageId === page.id;
                  return (
                    <button
                      key={page.id}
                      className={isActive ? styles.navItemActive : styles.navItem}
                      onClick={() => onNavigate(page.id)}
                    >
                      {page.title}
                      <span className={isActive ? styles.badgeActive : styles.badge}>({page.conflux?.manifestations ?? 0})</span>
                    </button>
                  );
                })}
            </>
          )}
        </div>
      )}

      {/* Huddles - collapsible, default collapsed */}
      {huddlePages.length > 0 && (
        <div className={styles.section}>
          <button
            className={styles.sectionTitleCollapsible}
            onClick={() => setHuddlesExpanded(!huddlesExpanded)}
            aria-expanded={huddlesExpanded}
          >
            <span className={styles.collapseIcon}>{huddlesExpanded ? '▼' : '▶'}</span>
            Huddles
            <span className={styles.badge}>({huddlePages.length})</span>
          </button>
          {huddlesExpanded && (
            <>
              <button
                className={currentPageId === 'huddles' ? styles.navItemActive : styles.navItem}
                onClick={() => onNavigate('huddles')}
              >
                All Huddles
                <span className={currentPageId === 'huddles' ? styles.badgeActive : styles.badge}>({huddlePages.length})</span>
              </button>
              {/* Show 5 largest huddle types */}
              {huddlePages
                .sort((a, b) => (b.huddleType?.largestSize ?? 0) - (a.huddleType?.largestSize ?? 0))
                .slice(0, 5)
                .map(page => {
                  const isActive = currentPageId === page.id;
                  return (
                    <button
                      key={page.id}
                      className={isActive ? styles.navItemActive : styles.navItem}
                      onClick={() => onNavigate(page.id)}
                    >
                      {page.title}
                      <span className={isActive ? styles.badgeActive : styles.badge}>({page.huddleType?.largestSize ?? 0})</span>
                    </button>
                  );
                })}
            </>
          )}
        </div>
      )}

      {/* All Categories */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>All Categories</div>
        <button
          className={styles.navItem}
          onClick={() => onNavigate('all-categories')}
        >
          View All Categories
          <span className={styles.badge}>({categories.length})</span>
        </button>
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
            {isRefreshing ? 'Refreshing...' : 'Refresh Index'}
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
          <button
            className={styles.bottomLink}
            onClick={handleRandomPage}
          >
            Random
          </button>
        </div>
      </div>
    </div>
  );
}
