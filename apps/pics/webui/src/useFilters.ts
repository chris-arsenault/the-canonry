/**
 * useFilters — Client-side filter, sort, and search for catalog images.
 */

import { useState, useMemo, useCallback } from "react";
import type { CatalogImage, FilterState, SortMode } from "./types";
import { isEntityImage } from "./types";

const INITIAL: FilterState = {
  search: "",
  imageType: null,
  entityKind: null,
  culture: null,
  artisticStyle: null,
  compositionStyle: null,
  colorPalette: null,
  model: null,
  sort: "newest",
};

function matchesSearch(img: CatalogImage, query: string): boolean {
  const q = query.toLowerCase();
  return (
    img.title.toLowerCase().includes(q) ||
    (isEntityImage(img) && img.entityName.toLowerCase().includes(q)) ||
    img.tags.some((t) => t.toLowerCase().includes(q))
  );
}

function sortImages(images: CatalogImage[], mode: SortMode): CatalogImage[] {
  const sorted = [...images];
  switch (mode) {
    case "newest":
      sorted.sort((a, b) => b.generatedAt - a.generatedAt);
      break;
    case "oldest":
      sorted.sort((a, b) => a.generatedAt - b.generatedAt);
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}

export function useFilters(images: CatalogImage[]) {
  const [filters, setFilters] = useState<FilterState>(INITIAL);

  const setSearch = useCallback((search: string) => {
    setFilters((f) => ({ ...f, search }));
  }, []);

  const setSort = useCallback((sort: SortMode) => {
    setFilters((f) => ({ ...f, sort }));
  }, []);

  const setFilter = useCallback(
    (key: keyof Omit<FilterState, "search" | "sort">, value: string | null) => {
      setFilters((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(INITIAL);
  }, []);

  const filtered = useMemo(() => {
    let result = images;

    if (filters.search) {
      result = result.filter((img) => matchesSearch(img, filters.search));
    }
    if (filters.imageType) {
      result = result.filter((img) => img.imageType === filters.imageType);
    }
    if (filters.entityKind) {
      const kind = filters.entityKind;
      result = result.filter((img) => isEntityImage(img) && img.entityKind === kind);
    }
    if (filters.culture) {
      const culture = filters.culture;
      result = result.filter((img) => isEntityImage(img) && img.entityCulture === culture);
    }
    if (filters.artisticStyle) {
      result = result.filter((img) => img.artisticStyleId === filters.artisticStyle);
    }
    if (filters.compositionStyle) {
      result = result.filter((img) => img.compositionStyleId === filters.compositionStyle);
    }
    if (filters.colorPalette) {
      result = result.filter((img) => img.colorPaletteId === filters.colorPalette);
    }
    if (filters.model) {
      result = result.filter((img) => img.model === filters.model);
    }

    return sortImages(result, filters.sort);
  }, [images, filters]);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.imageType !== null ||
    filters.entityKind !== null ||
    filters.culture !== null ||
    filters.artisticStyle !== null ||
    filters.compositionStyle !== null ||
    filters.colorPalette !== null ||
    filters.model !== null;

  return {
    filters,
    filtered,
    hasActiveFilters,
    setSearch,
    setSort,
    setFilter,
    clearFilters,
  };
}
