/**
 * Markdown Export
 *
 * Builds a ZIP file from the content tree containing:
 * - Markdown files for each content item (entity, chronicle, static page)
 * - manifest.json with full metadata
 * - s3-config.json and download-images.sh (when S3 configured)
 */

import JSZip from "jszip";
import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord } from "../chronicleTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { StaticPage } from "../staticPageTypes";
import type { EraNarrativeRecord } from "../eraNarrativeTypes";
import type {
  ContentTreeState,
  ExportImageEntry,
  S3ExportConfig,
  IdmlLayoutOptions,
} from "./prePrintTypes";
import { flattenForExport } from "./contentTree";
import { buildIdmlPackage } from "./idmlExport";

import { slugify } from "./markdownHelpers";
import {
  formatEntityMarkdown,
  formatChronicleMarkdown,
  formatStaticPageMarkdown,
  formatEraNarrativeMarkdown,
} from "./markdownFormatters";
import { buildManifest } from "./exportManifest";
import { buildDownloadScript } from "./exportScripts";

// Re-export for downstream consumers
export { buildIdmlImageScript } from "./exportScripts";

// =============================================================================
// Public API
// =============================================================================

export interface ExportOptions {
  treeState: ContentTreeState;
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  images: ImageMetadataRecord[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrativeRecord[];
  projectId: string;
  simulationRunId: string;
  s3Config: S3ExportConfig | null;
  idmlLayout?: IdmlLayoutOptions;
}

interface ContentMaps {
  entityMap: Map<string, PersistedEntity>;
  chronicleMap: Map<string, ChronicleRecord>;
  pageMap: Map<string, StaticPage>;
  narrativeMap: Map<string, EraNarrativeRecord>;
  imageMap: Map<string, ImageMetadataRecord>;
}

function buildContentMaps(options: ExportOptions): ContentMaps {
  return {
    entityMap: new Map(options.entities.map((e) => [e.id, e])),
    chronicleMap: new Map(options.chronicles.map((c) => [c.chronicleId, c])),
    pageMap: new Map(options.staticPages.map((p) => [p.pageId, p])),
    narrativeMap: new Map(options.eraNarratives.map((n) => [n.narrativeId, n])),
    imageMap: new Map(options.images.map((i) => [i.imageId, i])),
  };
}

function resolveNodeMarkdown(
  node: { type: string; contentId?: string },
  maps: ContentMaps,
  referencedImages: Map<string, ExportImageEntry>,
  entities: PersistedEntity[]
): string | null {
  if (!node.contentId) return null;

  if (node.type === "entity") {
    const entity = maps.entityMap.get(node.contentId);
    return entity ? formatEntityMarkdown(entity, referencedImages, maps.imageMap) : null;
  }
  if (node.type === "chronicle") {
    const chronicle = maps.chronicleMap.get(node.contentId);
    return chronicle ? formatChronicleMarkdown(chronicle, referencedImages, maps.imageMap) : null;
  }
  if (node.type === "static_page") {
    const page = maps.pageMap.get(node.contentId);
    return page ? formatStaticPageMarkdown(page, entities) : null;
  }
  if (node.type === "era_narrative") {
    const narrative = maps.narrativeMap.get(node.contentId);
    return narrative
      ? formatEraNarrativeMarkdown(narrative, referencedImages, maps.imageMap)
      : null;
  }
  return null;
}

function addS3Files(
  zip: JSZip,
  s3Config: S3ExportConfig,
  projectId: string
): void {
  zip.file(
    "s3-config.json",
    JSON.stringify(
      {
        bucket: s3Config.bucket,
        basePrefix: s3Config.basePrefix,
        rawPrefix: s3Config.rawPrefix,
        projectId,
        region: s3Config.region,
      },
      null,
      2
    )
  );
  zip.file("download-images.sh", buildDownloadScript());
}

export async function buildExportZip(options: ExportOptions): Promise<Blob> {
  const { treeState, entities, projectId, simulationRunId, s3Config } = options;

  const zip = new JSZip();
  const maps = buildContentMaps(options);
  const referencedImages = new Map<string, ExportImageEntry>();
  const flattened = flattenForExport(treeState);

  for (const { path, node } of flattened) {
    if (node.type === "folder") {
      zip.folder(path);
      continue;
    }

    const markdown = resolveNodeMarkdown(node, maps, referencedImages, entities);
    if (markdown) {
      const filename = slugify(node.name) + ".md";
      zip.file(`${path}/${filename}`, markdown);
    }
  }

  const manifest = buildManifest(
    treeState, entities, options.chronicles, options.staticPages,
    options.eraNarratives, options.images, referencedImages,
    projectId, simulationRunId, s3Config
  );
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  if (s3Config) {
    addS3Files(zip, s3Config, projectId);
  }

  return zip.generateAsync({ type: "blob" });
}

export async function buildInDesignExportZip(options: ExportOptions): Promise<Blob> {
  const { treeState, idmlLayout } = options;

  const maps = buildContentMaps(options);
  const referencedImages = new Map<string, ExportImageEntry>();

  return buildIdmlPackage(
    treeState,
    {
      entityMap: maps.entityMap,
      chronicleMap: maps.chronicleMap,
      pageMap: maps.pageMap,
      narrativeMap: maps.narrativeMap,
    },
    maps.imageMap,
    referencedImages,
    idmlLayout
  );
}
