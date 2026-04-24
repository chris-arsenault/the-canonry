/**
 * App — Root component for pics.theiceremembers.com
 *
 * Mobile-first image gallery with masonry grid, lightbox, compare, and slideshow.
 * Reads catalog.json from the CDN and does all filtering/sorting client-side.
 * Supports deep links: /img/{imageId} opens lightbox directly, /about opens about page.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useGalleryState } from "./useGalleryState";
import type { CatalogImage } from "./types";
import { buildFacetNames } from "./types";
import FilterBar from "./FilterBar";
import MasonryGrid from "./MasonryGrid";
import Lightbox from "./Lightbox";
import Compare from "./Compare";
import Slideshow from "./Slideshow";
import About from "./About";
import "./App.css";

function AppHeader({ comparePicking, compareHint, filtered, onToggleCompare, onStartSlideshow, onAbout }: Readonly<{
  comparePicking: boolean;
  compareHint: string | null;
  filtered: readonly CatalogImage[];
  onToggleCompare: () => void;
  onStartSlideshow: () => void;
  onAbout: () => void;
}>) {
  return (
    <header className="app-header">
      <h1 className="app-title">The Ice Remembers</h1>
      <div className="app-header-actions">
        {compareHint && <span className="app-compare-hint">{compareHint}</span>}
        <button
          className={`app-action-btn ${comparePicking ? "app-action-btn--active" : ""}`}
          onClick={onToggleCompare}
          title={comparePicking ? "Cancel compare" : "Compare two images"}
        >
          {comparePicking ? "Cancel" : "Compare"}
        </button>
        <button className="app-action-btn" onClick={onStartSlideshow}
          disabled={filtered.length === 0} title="Start slideshow"
        >
          Slideshow
        </button>
        <button className="app-action-btn" onClick={onAbout} title="About this gallery">
          About
        </button>
      </div>
    </header>
  );
}

function Overlays({ viewMode, filtered, lightboxIndex, compareSelection, baseUrl, facetNames,
  onCloseLightbox, onNavigate, onCloseCompare }: Readonly<{
  viewMode: string;
  filtered: CatalogImage[];
  lightboxIndex: number;
  compareSelection: CatalogImage[];
  baseUrl: string;
  facetNames: Map<string, string>;
  onCloseLightbox: () => void;
  onNavigate: (i: number) => void;
  onCloseCompare: () => void;
}>) {
  const comparePair = useMemo(
    () => compareSelection.length === 2 ? [compareSelection[0], compareSelection[1]] as const : null,
    [compareSelection],
  );

  return (
    <>
      {viewMode === "lightbox" && (
        <Lightbox images={filtered} currentIndex={lightboxIndex}
          baseUrl={baseUrl} facetNames={facetNames} onClose={onCloseLightbox} onNavigate={onNavigate} />
      )}
      {viewMode === "compare" && comparePair && (
        <Compare images={comparePair} baseUrl={baseUrl} onClose={onCloseCompare} />
      )}
      {viewMode === "slideshow" && (
        <Slideshow images={filtered} baseUrl={baseUrl} onClose={onCloseLightbox} />
      )}
    </>
  );
}

export default function App() {
  const [showAbout, setShowAbout] = useState(() => {
    // Redirect legacy hash
    if (window.location.hash === "#about") {
      window.history.replaceState(null, "", "/about");
      return true;
    }
    return window.location.pathname === "/about";
  });
  const g = useGalleryState();

  useEffect(() => {
    function onPopState() { setShowAbout(window.location.pathname === "/about"); }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleOpenAbout = useCallback(() => {
    window.history.pushState(null, "", "/about");
    setShowAbout(true);
  }, []);

  const handleCloseAbout = useCallback(() => {
    window.history.back();
    setShowAbout(false);
  }, []);

  const facetNames = useMemo(() => g.catalog ? buildFacetNames(g.catalog) : new Map<string, string>(), [g.catalog]);

  if (showAbout) return <About onBack={handleCloseAbout} />;

  if (g.error && !g.catalog) {
    return <div className="app-error"><h2>Failed to load gallery</h2><p>{g.error}</p></div>;
  }

  return (
    <div className="app">
      <AppHeader comparePicking={g.comparePicking} compareHint={g.compareHint}
        filtered={g.filtered} onToggleCompare={g.handleToggleCompare}
        onStartSlideshow={g.handleStartSlideshow} onAbout={handleOpenAbout} />

      {g.catalog && (
        <FilterBar filters={g.filters} catalog={g.catalog} resultCount={g.filtered.length}
          totalCount={g.catalog.images.length} onSearch={g.setSearch} onSort={g.setSort}
          onFilter={g.setFilter} onClear={g.clearFilters} hasActiveFilters={g.hasActiveFilters} />
      )}

      <MasonryGrid images={g.filtered} baseUrl={g.baseUrl} comparePicking={g.comparePicking}
        compareSelected={g.compareSelection} onImageClick={g.handleImageClick} />

      {g.catalog && g.filtered.length === 0 && (
        <div className="app-empty">
          No images match your filters.
          {g.hasActiveFilters && <button className="app-clear-btn" onClick={g.clearFilters}>Clear filters</button>}
        </div>
      )}

      <Overlays viewMode={g.viewMode} filtered={g.filtered} lightboxIndex={g.lightboxIndex}
        compareSelection={g.compareSelection} baseUrl={g.baseUrl} facetNames={facetNames}
        onCloseLightbox={g.handleCloseLightbox} onNavigate={g.handleNavigate} onCloseCompare={g.handleCloseCompare} />

      <footer className="app-footer">
        <span>Copyright &copy; 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
        <span className="app-footer-sep">&middot;</span>
        <a className="app-footer-link" href="https://theiceremembers.com" target="_blank" rel="noopener noreferrer">The Ice Remembers</a>
        <span className="app-footer-sep">&middot;</span>
        <button className="app-footer-link" onClick={handleOpenAbout}>About &amp; AI Disclosure</button>
      </footer>
    </div>
  );
}
