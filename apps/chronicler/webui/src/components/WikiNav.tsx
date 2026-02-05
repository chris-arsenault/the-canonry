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
  // Collapsible section state
  const [showChronicleTypes, setShowChronicleTypes] = useState(false);
  const [appendicesExpanded, setAppendicesExpanded] = useState(false);
  const [confluxesExpanded, setConfluxesExpanded] = useState(false);
  const [huddlesExpanded, setHuddlesExpanded] = useState(false);

  // Get top categories for quick access (entity kinds)
  const topCategories = categories
    .filter(c => c.id.startsWith('kind-'))
    .slice(0, 10);

  // Organize static pages by namespace
  const frontMatterPages: WikiPage[] = [];
  const lorePages: WikiPage[] = [];
  const culturePages: WikiPage[] = [];
  const systemPages: WikiPage[] = [];
  const otherPages: WikiPage[] = [];

  for (const page of staticPages) {
    const title = page.title;
    // Front matter: specific key pages
    if (title === 'Lore:Foreword to the Annotated Chronicle') {
      frontMatterPages.unshift(page); // Foreword first
    } else if (title === 'System:About This Project') {
      frontMatterPages.push(page); // About second
    } else if (title.startsWith('Lore:')) {
      lorePages.push(page);
    } else if (title.startsWith('Cultures:')) {
      culturePages.push(page);
    } else if (title.startsWith('System:')) {
      systemPages.push(page);
    } else {
      otherPages.push(page);
    }
  }

  // Sort lore pages alphabetically by title (without prefix)
  lorePages.sort((a, b) => a.title.replace('Lore:', '').localeCompare(b.title.replace('Lore:', '')));
  culturePages.sort((a, b) => a.title.replace('Cultures:', '').localeCompare(b.title.replace('Cultures:', '')));
  systemPages.sort((a, b) => a.title.replace('System:', '').localeCompare(b.title.replace('System:', '')));

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

      {/* FRONT MATTER - Key introductory pages */}
      {frontMatterPages.length > 0 && (
        <div className={styles.section}>
          {frontMatterPages.map(page => {
            const isActive = currentPageId === page.id;
            // Display name without namespace prefix
            const displayName = page.title.includes(':')
              ? page.title.split(':')[1]
              : page.title;
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

      {/* LORE - World essays and background */}
      {lorePages.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Lore</div>
          {lorePages.map(page => {
            const isActive = currentPageId === page.id;
            const displayName = page.title.replace('Lore:', '');
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

      {/* CHRONICLES - The stories */}
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
              By Style
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

      {/* ENCYCLOPEDIA - Entity browsing */}
      {topCategories.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Encyclopedia</div>
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

      {/* CULTURES - Cultural reference pages */}
      {culturePages.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Cultures</div>
          {culturePages.map(page => {
            const isActive = currentPageId === page.id;
            const displayName = page.title.replace('Cultures:', '');
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
          <span className={styles.collapseIcon}>{appendicesExpanded ? '▼' : '▶'}</span>
          Appendices
        </button>
        {appendicesExpanded && (
          <>
            {/* System pages */}
            {systemPages.length > 0 && systemPages.map(page => {
              const isActive = currentPageId === page.id;
              const displayName = page.title.replace('System:', '');
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
            {otherPages.length > 0 && otherPages.map(page => {
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
              className={currentPageId === 'all-categories' ? styles.navItemActive : styles.navItem}
              onClick={() => onNavigate('all-categories')}
            >
              All Categories
              <span className={currentPageId === 'all-categories' ? styles.badgeActive : styles.badge}>({categories.length})</span>
            </button>

            {/* Confluxes - nested collapsible */}
            {confluxPages.length > 0 && (
              <>
                <button
                  className={styles.sectionTitleCollapsible}
                  onClick={() => setConfluxesExpanded(!confluxesExpanded)}
                  aria-expanded={confluxesExpanded}
                  style={{ paddingLeft: '8px' }}
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
              </>
            )}

            {/* Huddles - nested collapsible */}
            {huddlePages.length > 0 && (
              <>
                <button
                  className={styles.sectionTitleCollapsible}
                  onClick={() => setHuddlesExpanded(!huddlesExpanded)}
                  aria-expanded={huddlesExpanded}
                  style={{ paddingLeft: '8px' }}
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
              </>
            )}
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
