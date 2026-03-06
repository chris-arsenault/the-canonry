/**
 * Markdown Export — manifest builder.
 *
 * Builds the manifest.json metadata object included in export ZIPs.
 */

import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord } from "../chronicleTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { StaticPage } from "../staticPageTypes";
import type { EraNarrativeRecord } from "../eraNarrativeTypes";
import type { ContentTreeState, ExportImageEntry, ExportManifest, S3ExportConfig } from "./prePrintTypes";
import { countWords } from "../db/staticPageRepository";
import { resolveActiveContent } from "../db/eraNarrativeRepository";

function computeTotalWords(
  publishedChronicles: ChronicleRecord[],
  entities: PersistedEntity[],
  publishedPages: StaticPage[],
  completedNarratives: EraNarrativeRecord[]
): number {
  const chronicleWords = publishedChronicles.reduce(
    (s, c) => s + countWords(c.finalContent || c.assembledContent || ""),
    0
  );
  const entityWords = entities.reduce(
    (s, e) => s + countWords(e.description || "") + countWords(e.summary || ""),
    0
  );
  const pageWords = publishedPages.reduce((s, p) => s + p.wordCount, 0);
  const narrativeWords = completedNarratives.reduce((s, n) => {
    const { content } = resolveActiveContent(n);
    return s + countWords(content || "");
  }, 0);

  return chronicleWords + entityWords + pageWords + narrativeWords;
}

export function buildManifest(
  treeState: ContentTreeState,
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  staticPages: StaticPage[],
  eraNarratives: EraNarrativeRecord[],
  _images: ImageMetadataRecord[],
  referencedImages: Map<string, ExportImageEntry>,
  projectId: string,
  simulationRunId: string,
  s3Config: S3ExportConfig | null
): ExportManifest {
  const publishedChronicles = chronicles.filter(
    (c) => c.status === "complete" || c.status === "assembly_ready"
  );
  const publishedPages = staticPages.filter((p) => p.status === "published");
  const completedNarratives = eraNarratives.filter(
    (n) => n.status === "complete" || n.status === "step_complete"
  );

  const allHistorianNotes =
    entities.reduce((n, e) => n + (e.enrichment?.historianNotes?.length || 0), 0) +
    publishedChronicles.reduce((n, c) => n + (c.historianNotes?.length || 0), 0);

  const totalWords = computeTotalWords(
    publishedChronicles, entities, publishedPages, completedNarratives
  );

  const manifest: ExportManifest = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    projectId,
    simulationRunId,
    stats: {
      totalWordCount: totalWords,
      estimatedPages: Math.ceil(totalWords / 250),
      entityCount: entities.length,
      chronicleCount: publishedChronicles.length,
      staticPageCount: publishedPages.length,
      eraNarrativeCount: completedNarratives.length,
      imageCount: referencedImages.size,
      historianNoteCount: allHistorianNotes,
    },
    tree: treeState.nodes,
    images: Object.fromEntries(referencedImages),
  };

  if (s3Config) {
    manifest.s3 = {
      bucket: s3Config.bucket,
      basePrefix: s3Config.basePrefix,
      rawPrefix: s3Config.rawPrefix,
      projectId,
      region: s3Config.region,
    };
  }

  return manifest;
}
