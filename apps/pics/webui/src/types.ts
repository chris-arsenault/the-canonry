/** Catalog types — mirrors catalogBuilder output */

export type ImageAspect = "portrait" | "landscape" | "square";
export type ImageType = "entity" | "scene" | "cover" | "other";

export interface CatalogImage {
  imageId: string;
  title: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageType: ImageType;
  tags: string[];
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  model: string;
  width: number;
  height: number;
  aspect: ImageAspect;
  generatedAt: number;
  thumbPath: string;
  fullPath: string;
}

export interface FacetEntry {
  id: string;
  name: string;
  group?: string;
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
