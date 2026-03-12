/** Catalog types — mirrors catalogBuilder output */

/** Intentional optionality — field may be absent by design. See ADR-045. */
type Optional<T> = T | undefined;

export type ImageAspect = "portrait" | "landscape" | "square";

/* ── CatalogImage — discriminated union on imageType ────────────────── */

interface CatalogImageBase {
  imageId: string;
  title: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  tags: string[];
  model: string;
  width: number;
  height: number;
  aspect: ImageAspect;
  generatedAt: number;
  thumbPath: string;
  fullPath: string;
  /** High-quality upscaled version — not all images have an upscaled variant */
  hqPath: Optional<string>;
}

/** Entity image — always has entityName, entityKind, entityCulture */
export interface EntityImage extends CatalogImageBase {
  imageType: "entity";
  entityName: string;
  entityKind: string;
  entityCulture: string;
}

/** Non-entity image — scene, cover, or other */
export interface NonEntityImage extends CatalogImageBase {
  imageType: "scene" | "cover" | "other";
}

export type CatalogImage = EntityImage | NonEntityImage;

/** Type guard for entity images */
export function isEntityImage(img: CatalogImage): img is EntityImage {
  return img.imageType === "entity";
}

/* ── Facets ──────────────────────────────────────────────────────────── */

export interface FacetEntry {
  id: string;
  name: string;
  /** Some facet categories (styles, palettes) are grouped; others are flat */
  group: Optional<string>;
}

/** Facets can be either {id,name} pairs (v2) or plain strings (v1) */
export type FacetList = FacetEntry[] | string[];

export interface ImageCatalog {
  version: 1 | 2;
  generatedAt: string;
  baseUrl: string;
  images: CatalogImage[];
  facets: {
    artisticStyles: FacetList;
    compositionStyles: FacetList;
    colorPalettes: FacetList;
    entityKinds: FacetList;
    cultures: FacetList;
    models: FacetList;
    imageTypes: FacetList;
  };
}

export type SortMode = "newest" | "oldest" | "title";

export interface FilterState {
  search: string;
  imageType: string | null;
  entityKind: string | null;
  culture: string | null;
  artisticStyle: string | null;
  compositionStyle: string | null;
  colorPalette: string | null;
  model: string | null;
  sort: SortMode;
}

/** Normalize a facet list to {id,name} pairs regardless of catalog version */
export function normalizeFacets(facets: FacetList): FacetEntry[] {
  if (facets.length === 0) return [];
  if (typeof facets[0] === "string") {
    return (facets as string[]).map((id) => ({ id, name: id }));
  }
  return facets as FacetEntry[];
}

/** Build a flat id→name lookup from all catalog facets */
export function buildFacetNames(catalog: ImageCatalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const list of Object.values(catalog.facets)) {
    for (const entry of normalizeFacets(list)) {
      map.set(entry.id, entry.name);
    }
  }
  return map;
}
