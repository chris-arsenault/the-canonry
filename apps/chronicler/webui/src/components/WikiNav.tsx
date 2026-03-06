/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Browse by category
 * - Search, Home, Random at bottom
 */

import React, { useCallback, useMemo } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { useExpandSet } from "@the-canonry/shared-components";
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
  onRefreshIndex: Optional<() => void>;
  isRefreshing: Optional<boolean>;
  isDrawer: Optional<boolean>;
  onCloseDrawer: Optional<() => void>;
}

interface EraGroup {
  eraId: string;
  eraName: string;
  eraOrder: number;
  stories: WikiPage[];
  documents: WikiPage[];
  all: WikiPage[];
}

function categorizeStaticPages(staticPages: readonly WikiPage[]) {
  const frontMatterPages: WikiPage[] = [];
  const lorePages: WikiPage[] = [];
  const culturePages: WikiPage[] = [];
  const systemPages: WikiPage[] = [];
  const otherPages: WikiPage[] = [];

  for (const page of staticPages) {
    const title = page.title;
    if (title === "Lore:Foreword to the Annotated Chronicle") { frontMatterPages.unshift(page); }
    else if (title === "System:About This Project") { frontMatterPages.push(page); }
    else if (title.startsWith("Lore:")) { lorePages.push(page); }
    else if (title.startsWith("Cultures:")) { culturePages.push(page); }
    else if (title.startsWith("System:")) { systemPages.push(page); }
    else { otherPages.push(page); }
  }

  lorePages.sort((a, b) => a.title.replace("Lore:", "").localeCompare(b.title.replace("Lore:", "")));
  culturePages.sort((a, b) => a.title.replace("Cultures:", "").localeCompare(b.title.replace("Cultures:", "")));
  systemPages.sort((a, b) => a.title.replace("System:", "").localeCompare(b.title.replace("System:", "")));

  return { frontMatterPages, lorePages, culturePages, systemPages, otherPages };
}

// eslint-disable-next-line complexity -- groups chronicles by era with format sub-grouping and era narrative lookup; each branch handles a distinct grouping dimension
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
    if (page.chronicle?.format === "story") { group.stories.push(page); }
    else if (page.chronicle?.format === "document") { group.documents.push(page); }
  }

  return { sortedEras: Array.from(chroniclesByEra.values()).sort((a, b) => a.eraOrder - b.eraOrder), eraNarrativeByEraId };
}

// --- Sub-components ---

function NavPageButton({ page, currentPageId, onNavigate, displayName }: Readonly<{
  page: WikiPage; currentPageId: string | null; onNavigate: (id: string) => void; displayName: Optional<string>;
}>) {
  return (
    <button
      className={currentPageId === page.id ? styles.navItemActive : styles.navItem}
      onClick={() => onNavigate(page.id)}
    >
      {displayName ?? page.title}
    </button>
  );
}

function CollapsibleSection({ label, count, expanded, onToggle, children }: Readonly<{
  label: string; count: Optional<number>; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}>) {
  return (
    <div className={styles.section}>
      <button className={styles.sectionTitleCollapsible} onClick={onToggle} aria-expanded={expanded}>
        <span className={styles.collapseIcon}>{expanded ? "\u25BC" : "\u25B6"}</span>
        {label}
        {count != null && <span className={styles.badge}>({count})</span>}
      </button>
      {expanded && children}
    </div>
  );
}

function EraNavButton({ label, id, count, currentPageId, onNavigate }: Readonly<{
  label: string; id: string; count: number; currentPageId: string | null; onNavigate: (id: string) => void;
}>) {
  const isActive = currentPageId === id;
  return (
    <button className={isActive ? styles.navItemIndentedActive : styles.navItemIndented} onClick={() => onNavigate(id)}>
      {label}
      <span className={isActive ? styles.badgeActive : styles.badge}>({count})</span>
    </button>
  );
}

function EraSection({ era, isExpanded, toggleEra, currentPageId, onNavigate, eraNarrativePage }: Readonly<{
  era: EraGroup; isExpanded: boolean; toggleEra: (id: string) => void; currentPageId: string | null;
  onNavigate: (id: string) => void; eraNarrativePage: Optional<WikiPage>;
}>) {
  const handleToggle = useCallback(() => toggleEra(era.eraId), [toggleEra, era.eraId]);
  return (
    <div>
      <button className={styles.eraSectionTitle} onClick={handleToggle} aria-expanded={isExpanded}>
        <span className={styles.collapseIcon}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
        {era.eraName}
        <span className={styles.badge}>({era.all.length})</span>
      </button>
      {isExpanded && (
        <>
          {eraNarrativePage && (
            <button
              className={currentPageId === eraNarrativePage.id ? styles.navItemEraNarrativeActive : styles.navItemEraNarrative}
              onClick={() => onNavigate(eraNarrativePage.id)}
            >
              Era Narrative
            </button>
          )}
          <EraNavButton label="View All" id={`chronicles-era-${era.eraId}`} count={era.all.length} currentPageId={currentPageId} onNavigate={onNavigate} />
          {era.stories.length > 0 && <EraNavButton label="Stories" id={`chronicles-era-${era.eraId}-story`} count={era.stories.length} currentPageId={currentPageId} onNavigate={onNavigate} />}
          {era.documents.length > 0 && <EraNavButton label="Documents" id={`chronicles-era-${era.eraId}-document`} count={era.documents.length} currentPageId={currentPageId} onNavigate={onNavigate} />}
        </>
      )}
    </div>
  );
}

function EncyclopediaSection({ categories, currentPageId, onNavigate }: Readonly<{
  categories: WikiCategory[]; currentPageId: string | null; onNavigate: (id: string) => void;
}>) {
  if (categories.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Encyclopedia</div>
      {categories.map((category) => {
        const isActive = currentPageId === `category-${category.id}`;
        return (
          <button key={category.id} className={isActive ? styles.navItemActive : styles.navItem} onClick={() => onNavigate(`category-${category.id}`)}>
            {category.name.replace("Kind: ", "")}
            <span className={isActive ? styles.badgeActive : styles.badge}>({category.pageCount})</span>
          </button>
        );
      })}
    </div>
  );
}

function StaticPageList({ pages, currentPageId, onNavigate, prefix }: Readonly<{
  pages: WikiPage[]; currentPageId: string | null; onNavigate: (id: string) => void; prefix: string;
}>) {
  return (
    <>
      {pages.map((page) => (
        <NavPageButton key={page.id} page={page} currentPageId={currentPageId} onNavigate={onNavigate} displayName={page.title.replace(prefix, "")} />
      ))}
    </>
  );
}

function FrontMatterAndLoreNav({ staticCategorized, expandedSections, toggleLore, currentPageId, onNavigate }: Readonly<{
  staticCategorized: ReturnType<typeof categorizeStaticPages>;
  expandedSections: Set<string>; toggleLore: () => void;
  currentPageId: string | null; onNavigate: (id: string) => void;
}>) {
  return (
    <>
      {staticCategorized.frontMatterPages.length > 0 && (
        <div className={styles.section}>
          {staticCategorized.frontMatterPages.map((page) => (
            <NavPageButton key={page.id} page={page} currentPageId={currentPageId} onNavigate={onNavigate}
              displayName={page.title.includes(":") ? page.title.split(":")[1] : page.title} />
          ))}
        </div>
      )}
      {staticCategorized.lorePages.length > 0 && (
        <CollapsibleSection label="Lore" count={staticCategorized.lorePages.length} expanded={expandedSections.has("lore")} onToggle={toggleLore}>
          <StaticPageList pages={staticCategorized.lorePages} currentPageId={currentPageId} onNavigate={onNavigate} prefix="Lore:" />
        </CollapsibleSection>
      )}
      {staticCategorized.culturePages.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Cultures</div>
          <StaticPageList pages={staticCategorized.culturePages} currentPageId={currentPageId} onNavigate={onNavigate} prefix="Cultures:" />
        </div>
      )}
    </>
  );
}

function ChroniclesNavSection({ chroniclePages, eraData, expandedEras, toggleEra, storyCount, documentCount, currentPageId, onNavigate }: Readonly<{
  chroniclePages: WikiPage[]; eraData: ReturnType<typeof buildChronicleEras>;
  expandedEras: Set<string>; toggleEra: (id: string) => void;
  storyCount: number; documentCount: number; currentPageId: string | null; onNavigate: (id: string) => void;
}>) {
  if (chroniclePages.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Chronicles</div>
      {eraData.sortedEras.map((era) => (
        <EraSection key={era.eraId} era={era} isExpanded={expandedEras.has(era.eraId)}
          toggleEra={toggleEra} currentPageId={currentPageId} onNavigate={onNavigate}
          eraNarrativePage={eraData.eraNarrativeByEraId.get(era.eraId)} />
      ))}
      {storyCount > 0 && <EraNavButton label="All Stories" id="chronicles-story" count={storyCount} currentPageId={currentPageId} onNavigate={onNavigate} />}
      {documentCount > 0 && <EraNavButton label="All Documents" id="chronicles-document" count={documentCount} currentPageId={currentPageId} onNavigate={onNavigate} />}
    </div>
  );
}

// --- Main component ---

export default function WikiNav({
  categories, pages, chronicles, staticPages, currentPageId,
  searchQuery, onSearchQueryChange, onNavigate, onGoHome,
  onRefreshIndex, isRefreshing, isDrawer, onCloseDrawer,
}: Readonly<WikiNavProps>) {
  const { expanded: expandedSections, toggle: toggleSection } = useExpandSet();
  const { expanded: expandedEras, toggle: toggleEra } = useExpandSet();

  const topCategories = useMemo(() => categories.filter((c) => c.id.startsWith("kind-")).slice(0, 10), [categories]);
  const staticCategorized = useMemo(() => categorizeStaticPages(staticPages), [staticPages]);
  const chroniclePages = useMemo(() => chronicles.filter((page) => page.chronicle), [chronicles]);
  const storyCount = useMemo(() => chroniclePages.filter((p) => p.chronicle?.format === "story").length, [chroniclePages]);
  const documentCount = useMemo(() => chroniclePages.filter((p) => p.chronicle?.format === "document").length, [chroniclePages]);
  const eraData = useMemo(() => buildChronicleEras(chroniclePages, pages), [chroniclePages, pages]);

  const toggleLore = useCallback(() => toggleSection("lore"), [toggleSection]);
  const toggleAppendices = useCallback(() => toggleSection("appendices"), [toggleSection]);

  const handleRandomPage = useCallback(() => {
    const entityPages = pages.filter((p) => p.type === "entity" || p.type === "era");
    if (entityPages.length > 0) {
      // eslint-disable-next-line sonarjs/pseudo-random -- non-security random page selection
      onNavigate(entityPages[Math.floor(Math.random() * entityPages.length)].id);
    }
  }, [pages, onNavigate]);

  const handleNavAllCategories = useCallback(() => onNavigate("all-categories"), [onNavigate]);

  return (
    <div className={styles.container}>
      {isDrawer && (
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Navigation</span>
          <button onClick={onCloseDrawer} className={styles.drawerClose} aria-label="Close navigation">&times;</button>
        </div>
      )}
      <nav className={styles.nav}>
        <FrontMatterAndLoreNav staticCategorized={staticCategorized} expandedSections={expandedSections}
          toggleLore={toggleLore} currentPageId={currentPageId} onNavigate={onNavigate} />
        <ChroniclesNavSection chroniclePages={chroniclePages} eraData={eraData}
          expandedEras={expandedEras} toggleEra={toggleEra}
          storyCount={storyCount} documentCount={documentCount} currentPageId={currentPageId} onNavigate={onNavigate} />
        <EncyclopediaSection categories={topCategories} currentPageId={currentPageId} onNavigate={onNavigate} />
        <CollapsibleSection label="Appendices" expanded={expandedSections.has("appendices")} onToggle={toggleAppendices}>
          <StaticPageList pages={staticCategorized.systemPages} currentPageId={currentPageId} onNavigate={onNavigate} prefix="System:" />
          {staticCategorized.otherPages.map((page) => (
            <NavPageButton key={page.id} page={page} currentPageId={currentPageId} onNavigate={onNavigate} />
          ))}
          <button className={currentPageId === "all-categories" ? styles.navItemActive : styles.navItem} onClick={handleNavAllCategories}>
            All Categories <span className={currentPageId === "all-categories" ? styles.badgeActive : styles.badge}>({categories.length})</span>
          </button>
        </CollapsibleSection>
        {onRefreshIndex && (
          <div className={styles.section}>
            <button className={styles.refreshButton} onClick={onRefreshIndex} disabled={!!isRefreshing}>
              {isRefreshing && <span className={styles.refreshSpinner}>&orarr;</span>}
              {isRefreshing ? "Refreshing..." : "Refresh Index"}
            </button>
          </div>
        )}
      </nav>
      <div className={styles.bottomSection}>
        <WikiSearch pages={pages} query={searchQuery} onQueryChange={onSearchQueryChange} onSelect={onNavigate} expandDirection="up" />
        <div className={styles.bottomLinks}>
          <button className={currentPageId === null ? styles.navItemActive : styles.bottomLink} onClick={onGoHome}>Home</button>
          <button className={styles.bottomLink} onClick={handleRandomPage}>Random</button>
        </div>
      </div>
    </div>
  );
}
