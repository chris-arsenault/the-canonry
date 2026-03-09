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

export interface ImageCatalog {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  images: CatalogImage[];
  facets: {
    artisticStyles: string[];
    compositionStyles: string[];
    colorPalettes: string[];
    entityKinds: string[];
    cultures: string[];
    models: string[];
    imageTypes: string[];
  };
}

export type SortMode = "newest" | "oldest" | "title";

export interface FilterState {
  search: string;
  imageType: string | null;
  entityKind: string | null;
  culture: string | null;
  artisticStyle: string | null;
  sort: SortMode;
}
