/**
 * Pre-compute wiki page index at build time.
 *
 * Runs after chunk-viewer-bundle.mjs has produced the core bundle.
 * Imports buildPageIndex from the chronicler source, runs it on the
 * stripped core bundle data, serializes the Maps to arrays, and embeds
 * the result in the core bundle JSON (updating the content hash).
 *
 * This eliminates the synchronous buildPageIndex computation on page load.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { buildPageIndex } from '../../../chronicler/webui/src/lib/wikiBuilder.ts';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
} from '@canonry/world-schema';

import type { ChronicleRecord } from '../../../chronicler/webui/src/lib/chronicleStorage.ts';
import type { StaticPage } from '../../../chronicler/webui/src/lib/staticPageStorage.ts';
import type { SerializedPageIndex } from '../../../chronicler/webui/src/types/world.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = resolve(__dirname, '../dist/bundles/default');

function contentHash(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 8);
}

function normalizeChronicles(records: ChronicleRecord[]): ChronicleRecord[] {
  return records
    .filter((r) => r && r.chronicleId && r.title && r.status === 'complete' && r.acceptedAt)
    .map((r) => ({
      ...r,
      roleAssignments: r.roleAssignments ?? [],
      selectedEntityIds: r.selectedEntityIds ?? [],
      selectedEventIds: r.selectedEventIds ?? [],
      selectedRelationshipIds: r.selectedRelationshipIds ?? [],
    }))
    .sort((a, b) => (b.acceptedAt || b.updatedAt || 0) - (a.acceptedAt || a.updatedAt || 0));
}

function normalizeStaticPages(pages: StaticPage[]): StaticPage[] {
  return pages
    .filter((p) => p && p.pageId && p.title && p.slug)
    .map((p) => ({ ...p, status: p.status || 'published' } as StaticPage))
    .filter((p) => p.status === 'published')
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function main() {
  const manifestPath = join(BUNDLE_DIR, 'bundle.manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const oldCoreFilename: string = manifest.core;
  const corePath = join(BUNDLE_DIR, oldCoreFilename);

  console.log('Pre-computing page index...');
  const coreBundle = JSON.parse(readFileSync(corePath, 'utf8'));

  const worldData = coreBundle.worldData;
  if (!worldData?.hardState) {
    console.log('  Skipped: no worldData in core bundle.');
    return;
  }

  const chronicles = normalizeChronicles(coreBundle.chronicles ?? []);
  const staticPages = normalizeStaticPages(coreBundle.staticPages ?? []);

  // Build prominence scale from entity values
  const prominenceValues = worldData.hardState
    .map((e: { prominence: unknown }) => e.prominence)
    .filter((v: unknown) => typeof v === 'number' && Number.isFinite(v));
  const prominenceScale = buildProminenceScale(prominenceValues, {
    distribution: DEFAULT_PROMINENCE_DISTRIBUTION,
  });

  const eraNarratives = Array.isArray(coreBundle.eraNarratives) ? coreBundle.eraNarratives : [];

  // Build the full page index
  const pageIndex = buildPageIndex(
    worldData,
    null,
    chronicles,
    staticPages,
    prominenceScale,
    eraNarratives,
  );

  // Serialize Maps to entry arrays for JSON transport
  const serialized: SerializedPageIndex = {
    entries: pageIndex.entries,
    byName: [...pageIndex.byName.entries()],
    byAlias: [...pageIndex.byAlias.entries()],
    bySlug: [...pageIndex.bySlug.entries()],
    categories: pageIndex.categories,
    byBaseName: [...pageIndex.byBaseName.entries()],
  };

  // Embed in core bundle
  coreBundle.precomputedPageIndex = serialized;

  // Write updated core bundle with new content hash
  const newJson = JSON.stringify(coreBundle);
  const newHash = contentHash(newJson);
  const newCoreFilename = `bundle.core.${newHash}.json`;
  writeFileSync(join(BUNDLE_DIR, newCoreFilename), newJson, 'utf8');

  // Remove old core bundle (hash changed)
  if (newCoreFilename !== oldCoreFilename) {
    unlinkSync(corePath);
  }

  // Update manifest
  manifest.core = newCoreFilename;
  writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');

  const indexSize = Buffer.byteLength(JSON.stringify(serialized), 'utf8');
  console.log(`  Entries: ${serialized.entries.length}`);
  console.log(`  Index size: ${(indexSize / 1024).toFixed(1)} KB`);
  console.log(`  Core bundle: ${oldCoreFilename} → ${newCoreFilename}`);
}

main().catch((err) => {
  console.error('Failed to pre-compute page index:', err);
  process.exitCode = 1;
});
