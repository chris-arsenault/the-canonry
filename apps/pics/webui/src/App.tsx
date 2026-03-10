/**
 * App — Root component for pics.theiceremembers.com
 *
 * Mobile-first image gallery with masonry grid, lightbox, compare, and slideshow.
 * Reads catalog.json from the CDN and does all filtering/sorting client-side.
 * Supports deep links: #img-{imageId} opens lightbox directly.
 */

import { useState, useCallback, useEffect, useRef } from "react";
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

function getHashImageId(): string | null {
  const hash = window.location.hash;
  return hash.startsWith("#img-") ? hash.slice(5) : null;
}

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
  const [comparePicking, setComparePicking] = useState(false);
  const [compareSelection, setCompareSelection] = useState<CatalogImage[]>([]);

  const deepLinkedRef = useRef(false);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  // Deep link: open lightbox from hash on catalog load.
  // Search the full catalog (not filtered) so we always find the image.
  // Only mark as processed once we either successfully open or confirm the
  // image doesn't exist in the full catalog.
  const allImages = catalog?.images ?? [];
  const deepLinkProcessedRef = useRef(false);

  useEffect(() => {
    if (deepLinkProcessedRef.current) return;
    const hashId = getHashImageId();
    if (!hashId || allImages.length === 0) return;

    // Find in the full catalog
    const exists = allImages.some((img) => img.imageId === hashId);
    if (!exists) return; // image not in catalog yet — wait for full catalog

    deepLinkProcessedRef.current = true;

    // Find position in filtered list (no filters active on initial load)
    const index = filtered.findIndex((img) => img.imageId === hashId);
    if (index >= 0) {
      deepLinkedRef.current = true;
      setLightboxIndex(index);
      setViewMode("lightbox");
    }
  }, [allImages, filtered]);

  // Back/forward button: sync lightbox state with hash
  useEffect(() => {
    function onPopState() {
      const hashId = getHashImageId();
      if (!hashId) {
        setViewMode("grid");
        deepLinkedRef.current = false;
      } else {
        const index = filteredRef.current.findIndex((img) => img.imageId === hashId);
        if (index >= 0) {
          setLightboxIndex(index);
          setViewMode("lightbox");
        }
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Escape cancels compare picking
  useEffect(() => {
    if (!comparePicking) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setComparePicking(false);
        setCompareSelection([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [comparePicking]);

  const handleImageClick = useCallback(
    (index: number) => {
      if (comparePicking) {
        const img = filtered[index];
        if (compareSelection.length === 0) {
          setCompareSelection([img]);
        } else if (compareSelection.length === 1) {
          if (compareSelection[0].imageId !== img.imageId) {
            setCompareSelection([compareSelection[0], img]);
            setComparePicking(false);
            setViewMode("compare");
          }
        }
        return;
      }
      const img = filtered[index];
      if (!img) return;
      setLightboxIndex(index);
      setViewMode("lightbox");
      deepLinkedRef.current = false;
      window.history.pushState(null, "", `#img-${img.imageId}`);
    },
    [comparePicking, filtered, compareSelection],
  );

  const handleNavigate = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      const img = filtered[index];
      if (img) {
        window.history.replaceState(null, "", `#img-${img.imageId}`);
      }
    },
    [filtered],
  );

  const handleCloseLightbox = useCallback(() => {
    setViewMode("grid");
    if (deepLinkedRef.current) {
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      window.history.back();
    }
    deepLinkedRef.current = false;
  }, []);

  const handleCloseCompare = useCallback(() => {
    setViewMode("grid");
    setCompareSelection([]);
  }, []);

  const handleToggleCompare = useCallback(() => {
    if (comparePicking) {
      // Cancel picking
      setComparePicking(false);
      setCompareSelection([]);
    } else {
      setComparePicking(true);
      setCompareSelection([]);
    }
  }, [comparePicking]);

  const handleStartSlideshow = useCallback(() => {
    setViewMode("slideshow");
  }, []);

  const baseUrl = catalog?.baseUrl ?? "";

  const compareHint = comparePicking
    ? compareSelection.length === 0
      ? "Select first image"
      : "Select second image"
    : null;

  // Fatal error only when we have no data at all
  if (error && !catalog) {
    return (
      <div className="app-error">
        <h2>Failed to load gallery</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">The Ice Remembers</h1>
        <div className="app-header-actions">
          {compareHint && (
            <span className="app-compare-hint">{compareHint}</span>
          )}
          <button
            className={`app-action-btn ${comparePicking ? "app-action-btn--active" : ""}`}
            onClick={handleToggleCompare}
            title={comparePicking ? "Cancel compare" : "Compare two images"}
          >
            {comparePicking ? "Cancel" : "Compare"}
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

      {catalog && (
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
      )}

      <MasonryGrid
        images={filtered}
        baseUrl={baseUrl}
        comparePicking={comparePicking}
        compareSelected={compareSelection}
        onImageClick={handleImageClick}
      />

      {catalog && filtered.length === 0 && (
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
          onNavigate={handleNavigate}
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
