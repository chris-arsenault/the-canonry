/**
 * App — Root component for pics.theiceremembers.com
 *
 * Mobile-first image gallery with masonry grid, lightbox, compare, and slideshow.
 * Reads catalog.json from the CDN and does all filtering/sorting client-side.
 */

import { useState, useCallback } from "react";
import { useCatalog } from "./useCatalog";
import { useFilters } from "./useFilters";
import type { CatalogImage } from "./types";
import FilterBar from "./FilterBar";
import MasonryGrid from "./MasonryGrid";
import Lightbox from "./Lightbox";
import Compare from "./Compare";
import Slideshow from "./Slideshow";
import "./App.css";

type ViewMode = "grid" | "lightbox" | "compare" | "slideshow";

export default function App() {
  const { catalog, loading, error } = useCatalog();

  const {
    filters,
    filtered,
    hasActiveFilters,
    setSearch,
    setSort,
    setFilter,
    clearFilters,
  } = useFilters(catalog?.images ?? []);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [compareSelection, setCompareSelection] = useState<CatalogImage[]>([]);

  const handleImageClick = useCallback(
    (index: number) => {
      if (viewMode === "compare" || compareSelection.length === 1) {
        // In compare selection mode
        const img = filtered[index];
        if (compareSelection.length === 0) {
          setCompareSelection([img]);
        } else if (compareSelection.length === 1) {
          if (compareSelection[0].imageId !== img.imageId) {
            setCompareSelection([compareSelection[0], img]);
            setViewMode("compare");
          }
        }
        return;
      }
      setLightboxIndex(index);
      setViewMode("lightbox");
    },
    [viewMode, filtered, compareSelection],
  );

  const handleCloseLightbox = useCallback(() => {
    setViewMode("grid");
  }, []);

  const handleCloseCompare = useCallback(() => {
    setViewMode("grid");
    setCompareSelection([]);
  }, []);

  const handleStartCompare = useCallback(() => {
    setCompareSelection([]);
    // Will enter compare mode once 2 images are selected
  }, []);

  const handleStartSlideshow = useCallback(() => {
    setViewMode("slideshow");
  }, []);

  const baseUrl = catalog?.baseUrl ?? "";

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <h2>Failed to load gallery</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!catalog) return null;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">The Ice Remembers</h1>
        <div className="app-header-actions">
          {compareSelection.length === 1 && (
            <span className="app-compare-hint">Select second image to compare</span>
          )}
          <button
            className="app-action-btn"
            onClick={handleStartCompare}
            title="Compare two images"
          >
            Compare
          </button>
          <button
            className="app-action-btn"
            onClick={handleStartSlideshow}
            disabled={filtered.length === 0}
            title="Start slideshow"
          >
            Slideshow
          </button>
        </div>
      </header>

      <FilterBar
        filters={filters}
        catalog={catalog}
        resultCount={filtered.length}
        totalCount={catalog.images.length}
        onSearch={setSearch}
        onSort={setSort}
        onFilter={setFilter}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <MasonryGrid
        images={filtered}
        baseUrl={baseUrl}
        onImageClick={handleImageClick}
      />

      {filtered.length === 0 && (
        <div className="app-empty">
          No images match your filters.
          {hasActiveFilters && (
            <button className="app-clear-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      )}

      {viewMode === "lightbox" && (
        <Lightbox
          images={filtered}
          currentIndex={lightboxIndex}
          baseUrl={baseUrl}
          onClose={handleCloseLightbox}
          onNavigate={setLightboxIndex}
        />
      )}

      {viewMode === "compare" && compareSelection.length === 2 && (
        <Compare
          images={[compareSelection[0], compareSelection[1]]}
          baseUrl={baseUrl}
          onClose={handleCloseCompare}
        />
      )}

      {viewMode === "slideshow" && (
        <Slideshow
          images={filtered}
          baseUrl={baseUrl}
          onClose={handleCloseLightbox}
        />
      )}
    </div>
  );
}
