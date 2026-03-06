/**
 * wikiBuilderUtils — shared utilities for wiki page construction
 */

import type {
  WorldState,
  LoreData,
  LoreRecord,
  HardState,
  WikiSection,
  Region,
  ImageAspect,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import type { StaticPage } from "./staticPageStorage.ts";

/**
 * Image info with path and optional dimensions
 * Used for aspect-aware display of images
 */
export interface ImageInfo {
  path: string;
  width: Optional<number>;
  height: Optional<number>;
  aspect: Optional<ImageAspect>;
}

export interface ImageMetadataForIndex {
  results: Array<{
    imageId: string;
    localPath: string;
    width: Optional<number>;
    height: Optional<number>;
    aspect: Optional<ImageAspect>;
  }>;
}

export function parseNamespace(title: string): { namespace: Optional<string>; baseName: string } {
  const colonIndex = title.indexOf(":");
  if (colonIndex > 0 && colonIndex < title.length - 1) {
    return {
      namespace: title.slice(0, colonIndex).trim(),
      baseName: title.slice(colonIndex + 1).trim(),
    };
  }
  return { namespace: undefined, baseName: title };
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatCategoryName(catId: string): string {
  const parts = catId.split("-");
  if (parts.length >= 2) {
    const type = parts[0];
    const value = parts.slice(1).join("-");
    return `${capitalize(type)}: ${capitalize(value.replace(/_/g, " "))}`;
  }
  return capitalize(catId.replace(/_/g, " "));
}

export function buildStaticPageSlug(staticPage: StaticPage): string {
  const { namespace, baseName } = parseNamespace(staticPage.title);
  const baseSlug = slugify(baseName);
  if (namespace) {
    const nsSlug = slugify(namespace);
    return nsSlug ? `${nsSlug}/${baseSlug}` : baseSlug;
  }
  return baseSlug;
}

export function getAllRegionsFlat(worldData: WorldState): Array<{ region: Region; entityKind: string }> {
  const result: Array<{ region: Region; entityKind: string }> = [];
  for (const kindDef of worldData.schema.entityKinds) {
    const regions = kindDef.semanticPlane?.regions;
    if (!regions) continue;
    for (const region of regions) {
      result.push({ region, entityKind: kindDef.kind });
    }
  }
  return result;
}

export function findRegionById(
  worldData: WorldState,
  regionId: string
): { region: Region; entityKind: string } | undefined {
  for (const kindDef of worldData.schema.entityKinds) {
    const regions = kindDef.semanticPlane?.regions;
    if (!regions) continue;
    const found = regions.find((r) => r.id === regionId);
    if (found) return { region: found, entityKind: kindDef.kind };
  }
  return undefined;
}

export function buildLinkableNamesForBacklinks(
  worldData: WorldState,
  pageNameIndex: Optional<Map<string, string>>
): Array<{ name: string; id: string }> {
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) {
    linkableNames.push({ name: entity.name, id: entity.id });
  }
  if (pageNameIndex) {
    for (const [name, id] of pageNameIndex) {
      linkableNames.push({ name, id });
    }
  }
  for (const { region } of getAllRegionsFlat(worldData)) {
    linkableNames.push({ name: region.label, id: `region:${region.id}` });
  }
  return linkableNames;
}

export function getEntityAliases(entity: HardState): string[] {
  return Array.isArray(entity.enrichment?.text?.aliases)
    ? entity.enrichment.text.aliases
        .filter((alias): alias is string => typeof alias === "string")
        .map((alias) => alias.trim())
        .filter(Boolean)
    : [];
}

export function extractLinkedEntities(
  sections: WikiSection[],
  worldData: WorldState,
  aliasIndex: Map<string, string>,
  pageNameIndex: Optional<Map<string, string>>
): string[] {
  const linked: Set<string> = new Set();
  const entityByName = new Map(worldData.hardState.map((e) => [e.name.toLowerCase(), e.id]));

  for (const section of sections) {
    // eslint-disable-next-line sonarjs/slow-regex -- character-class bounded, no backtracking
    const matches = section.content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      const name = match[1].toLowerCase().trim();
      const id = entityByName.get(name) ?? aliasIndex.get(name) ?? pageNameIndex?.get(name);
      if (id) linked.add(id);
    }
  }

  return Array.from(linked);
}

export function buildLoreIndex(loreData: LoreData | null): Map<string, LoreRecord[]> {
  const index = new Map<string, LoreRecord[]>();
  if (!loreData) return index;

  for (const record of loreData.records) {
    if (record.targetId) {
      if (!index.has(record.targetId)) {
        index.set(record.targetId, []);
      }
      index.get(record.targetId)!.push(record);
    }
  }

  return index;
}

/** Resolve a raw image path to a web-servable path */
function resolveImageWebPath(localPath: string): string {
  if (localPath.startsWith("blob:") || localPath.startsWith("data:")) return localPath;
  return localPath.replace("output/images/", "images/");
}

export function buildImageIndex(
  worldData: WorldState,
  imageData: ImageMetadataForIndex | null
): Map<string, ImageInfo> {
  const index = new Map<string, ImageInfo>();
  if (!imageData) return index;

  const imageById = new Map(imageData.results.map((img) => [img.imageId, img]));

  for (const entity of worldData.hardState) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (!imageId) continue;

    const img = imageById.get(imageId);
    if (!img?.localPath) continue;

    index.set(entity.id, {
      path: resolveImageWebPath(img.localPath),
      width: img.width,
      height: img.height,
      aspect: img.aspect,
    });
  }

  return index;
}

export function buildAliasIndex(worldData: WorldState): Map<string, string> {
  const index = new Map<string, string>();

  for (const entity of worldData.hardState) {
    const aliases = Array.isArray(entity.enrichment?.text?.aliases)
      ? entity.enrichment.text.aliases
      : [];

    for (const alias of aliases) {
      if (typeof alias !== "string") continue;
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      if (!index.has(normalized)) {
        index.set(normalized, entity.id);
      }
    }
  }

  return index;
}
