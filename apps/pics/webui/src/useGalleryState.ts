/**
 * useGalleryState — Centralized state for the gallery app.
 *
 * Handles catalog loading, filtering, view modes, lightbox navigation,
 * compare mode, deep linking, and browser history sync.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useCatalog } from "./useCatalog";
import { useFilters } from "./useFilters";
import type { CatalogImage } from "./types";

export type ViewMode = "grid" | "lightbox" | "compare" | "slideshow";

function getHashImageId(): string | null {
  const hash = window.location.hash;
  return hash.startsWith("#img-") ? hash.slice(5) : null;
}

/** Deep link: open lightbox from hash on catalog load. */
function useDeepLinkEffect(
  allImages: readonly CatalogImage[],
  filtered: readonly CatalogImage[],
  deepLinkedRef: React.RefObject<boolean>,
  setLightboxIndex: (i: number) => void,
  setViewMode: (m: ViewMode) => void,
) {
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    const hashId = getHashImageId();
    if (!hashId || allImages.length === 0) return;
    if (!allImages.some((img) => img.imageId === hashId)) return;
    processedRef.current = true;
    const index = filtered.findIndex((img) => img.imageId === hashId);
    if (index >= 0) {
      deepLinkedRef.current = true;
      setLightboxIndex(index);
      setViewMode("lightbox");
    }
  }, [allImages, filtered, deepLinkedRef, setLightboxIndex, setViewMode]);
}

/** Back/forward button: sync lightbox state with hash. */
function usePopStateEffect(
  filteredRef: React.RefObject<CatalogImage[]>,
  deepLinkedRef: React.RefObject<boolean>,
  setViewMode: (m: ViewMode) => void,
  setLightboxIndex: (i: number) => void,
) {
  useEffect(() => {
    function onPopState() {
      const hashId = getHashImageId();
      if (!hashId) {
        setViewMode("grid");
        deepLinkedRef.current = false;
      } else {
        const idx = filteredRef.current.findIndex((img) => img.imageId === hashId);
        if (idx >= 0) { setLightboxIndex(idx); setViewMode("lightbox"); }
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [filteredRef, deepLinkedRef, setViewMode, setLightboxIndex]);
}

/** Escape key cancels compare picking. */
function useCompareEscapeEffect(
  picking: boolean,
  setPicking: (v: boolean) => void,
  setSelection: (v: CatalogImage[]) => void,
) {
  useEffect(() => {
    if (!picking) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setPicking(false); setSelection([]); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, setPicking, setSelection]);
}

export function useGalleryState() {
  const { catalog, error } = useCatalog();
  const allImages = useMemo(() => catalog?.images ?? [], [catalog?.images]);
  const filterResult = useFilters(allImages);
  const { filtered } = filterResult;

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [comparePicking, setComparePicking] = useState(false);
  const [compareSelection, setCompareSelection] = useState<CatalogImage[]>([]);

  const deepLinkedRef = useRef(false);
  const filteredRef = useRef(filtered);
  useEffect(() => { filteredRef.current = filtered; }, [filtered]);

  useDeepLinkEffect(allImages, filtered, deepLinkedRef, setLightboxIndex, setViewMode);
  usePopStateEffect(filteredRef, deepLinkedRef, setViewMode, setLightboxIndex);
  useCompareEscapeEffect(comparePicking, setComparePicking, setCompareSelection);

  const handleCompareClick = useCallback((index: number) => {
    const img = filtered[index];
    if (compareSelection.length === 0) {
      setCompareSelection([img]);
    } else if (compareSelection.length === 1 && compareSelection[0].imageId !== img.imageId) {
      setCompareSelection([compareSelection[0], img]);
      setComparePicking(false);
      setViewMode("compare");
    }
  }, [filtered, compareSelection]);

  const handleOpenLightbox = useCallback((index: number) => {
    const img = filtered[index];
    if (!img) return;
    setLightboxIndex(index);
    setViewMode("lightbox");
    deepLinkedRef.current = false;
    window.history.pushState(null, "", `#img-${img.imageId}`);
  }, [filtered]);

  const handleImageClick = useCallback((index: number) => {
    if (comparePicking) { handleCompareClick(index); return; }
    handleOpenLightbox(index);
  }, [comparePicking, handleCompareClick, handleOpenLightbox]);

  const handleNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
    const img = filtered[index];
    if (img) window.history.replaceState(null, "", `#img-${img.imageId}`);
  }, [filtered]);

  const handleCloseLightbox = useCallback(() => {
    setViewMode("grid");
    if (deepLinkedRef.current) {
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      window.history.back();
    }
    deepLinkedRef.current = false;
  }, []);

  const handleCloseCompare = useCallback(() => { setViewMode("grid"); setCompareSelection([]); }, []);
  const handleToggleCompare = useCallback(() => { setComparePicking((p) => !p); setCompareSelection([]); }, []);
  const handleStartSlideshow = useCallback(() => { setViewMode("slideshow"); }, []);

  let compareHint: string | null = null;
  if (comparePicking) {
    compareHint = compareSelection.length === 0 ? "Select first image" : "Select second image";
  }

  return {
    catalog, error, ...filterResult,
    viewMode, lightboxIndex,
    comparePicking, compareSelection, compareHint,
    baseUrl: catalog?.baseUrl ?? "",
    handleImageClick, handleNavigate, handleCloseLightbox,
    handleCloseCompare, handleToggleCompare, handleStartSlideshow,
  };
}
