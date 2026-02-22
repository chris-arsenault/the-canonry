import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_INPUT = 'dist/bundles/default/bundle.json';

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function cloneBundle(bundle) {
  if (typeof structuredClone === 'function') {
    return structuredClone(bundle);
  }
  return JSON.parse(JSON.stringify(bundle));
}

/**
 * Generate a short content hash for cache busting.
 * Uses first 8 chars of SHA-256 hex digest.
 */
function contentHash(data) {
  return createHash('sha256').update(data).digest('hex').slice(0, 8);
}

/**
 * Strip debug metadata from enrichment, keeping only aliases.
 * This removes chainDebug, token counts, costs, and image generation metadata
 * which are not needed for viewing.
 */
function stripEnrichmentDebugData(entity) {
  if (!entity.enrichment) return entity;

  const { text, ...otherEnrichment } = entity.enrichment;

  // Only keep aliases from text
  if (text?.aliases && Array.isArray(text.aliases) && text.aliases.length > 0) {
    return {
      ...entity,
      enrichment: {
        ...otherEnrichment,
        text: { aliases: text.aliases },
      },
    };
  }

  // No aliases - check if there's other enrichment to keep
  if (Object.keys(otherEnrichment).length > 0) {
    return {
      ...entity,
      enrichment: otherEnrichment,
    };
  }

  // Nothing worth keeping - remove enrichment entirely
  const { enrichment: _, ...entityWithoutEnrichment } = entity;
  return entityWithoutEnrichment;
}

/**
 * Try to load image manifest and update imageData.results with optimized paths.
 * Returns the number of images updated.
 */
async function applyImageOptimizations(coreBundle, outputDir) {
  const manifestPath = join(outputDir, 'image-manifest.json');

  try {
    await access(manifestPath);
  } catch {
    // No manifest - images not optimized
    return 0;
  }

  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  if (!coreBundle.imageData?.results || !Array.isArray(coreBundle.imageData.results)) {
    return 0;
  }

  let updated = 0;
  for (const image of coreBundle.imageData.results) {
    if (!image.imageId) continue;

    const optimized = manifest[image.imageId];
    if (optimized) {
      // Add optimized paths - keep localPath for backwards compat
      image.thumbPath = optimized.thumb;
      image.fullPath = optimized.full;
      // Update localPath to point to full WebP (smaller than original PNG)
      image.localPath = optimized.full;
      updated++;
    }
  }

  return updated;
}

/**
 * Group narrative events by participating entity.
 * Each event appears in every entity's timeline via participantEffects[].entity.id.
 * Returns a Map<entityId, NarrativeEvent[]> sorted by tick.
 */
function groupEventsByEntity(events) {
  const byEntity = new Map();

  for (const event of events) {
    if (!Array.isArray(event.participantEffects)) continue;
    const seen = new Set();
    for (const pe of event.participantEffects) {
      const entityId = pe?.entity?.id;
      if (!entityId || seen.has(entityId)) continue;
      seen.add(entityId);
      if (!byEntity.has(entityId)) {
        byEntity.set(entityId, []);
      }
      byEntity.get(entityId).push(event);
    }
  }

  // Sort each entity's events by tick
  for (const events of byEntity.values()) {
    events.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  }

  return byEntity;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = resolve(process.cwd(), args.get('input') ?? DEFAULT_INPUT);
  const outputDir = resolve(process.cwd(), args.get('output') ?? dirname(inputPath));

  const raw = await readFile(inputPath, 'utf8');
  const bundle = JSON.parse(raw);
  const narrativeHistory = Array.isArray(bundle?.worldData?.narrativeHistory)
    ? bundle.worldData.narrativeHistory
    : [];

  const coreBundle = cloneBundle(bundle);
  if (coreBundle?.worldData && typeof coreBundle.worldData === 'object') {
    coreBundle.worldData.narrativeHistory = [];

    // Strip debug metadata from entities (keeps aliases only from enrichment)
    if (Array.isArray(coreBundle.worldData.hardState)) {
      coreBundle.worldData.hardState = coreBundle.worldData.hardState.map(stripEnrichmentDebugData);
    }
  }

  // Strip chronicle generation/editing metadata not needed for viewing
  if (Array.isArray(coreBundle.chronicles)) {
    const STRIP_CHRONICLE_FIELDS = [
      'generationHistory',
      'perspectiveSynthesis',
      'generationUserPrompt',
      'generationSystemPrompt',
      'generationContext',
      'temporalCheckReport',
      'comparisonReport',
    ];
    for (const chronicle of coreBundle.chronicles) {
      for (const field of STRIP_CHRONICLE_FIELDS) {
        delete chronicle[field];
      }
    }
  }

  // Strip era narrative generation metadata not needed for viewing
  // The export already projects to viewer-friendly format, but strip any
  // remaining generation fields that may have leaked through
  if (Array.isArray(coreBundle.eraNarratives)) {
    const STRIP_NARRATIVE_FIELDS = [
      'historianConfigJson',
      'worldContext',
      'error',
      'prepBriefs',  // Full prep text — sourceChronicles has the IDs/titles already
    ];
    for (const narrative of coreBundle.eraNarratives) {
      for (const field of STRIP_NARRATIVE_FIELDS) {
        delete narrative[field];
      }
    }
  }

  // Strip image generation prompts (viewer only needs paths + metadata)
  if (Array.isArray(coreBundle.imageData?.results)) {
    for (const image of coreBundle.imageData.results) {
      delete image.prompt;
    }
  }

  // Apply image optimizations if manifest exists
  const imagesOptimized = await applyImageOptimizations(coreBundle, outputDir);

  // Generate core bundle with content hash in filename
  const coreJson = JSON.stringify(coreBundle);
  const coreHash = contentHash(coreJson);
  const coreFilename = `bundle.core.${coreHash}.json`;
  await writeFile(join(outputDir, coreFilename), coreJson, 'utf8');

  // Build per-entity timeline files for on-demand loading
  const entityTimelines = groupEventsByEntity(narrativeHistory);
  const timelineDir = join(outputDir, 'timelines');
  await mkdir(timelineDir, { recursive: true });

  const timelineFiles = {};
  let totalTimelineBytes = 0;

  for (const [entityId, events] of entityTimelines) {
    const payload = JSON.stringify(events);
    const hash = contentHash(payload);
    const filename = `${entityId}.${hash}.json`;
    await writeFile(join(timelineDir, filename), payload, 'utf8');
    const bytes = Buffer.byteLength(payload, 'utf8');
    totalTimelineBytes += bytes;
    timelineFiles[entityId] = {
      path: `timelines/${filename}`,
      eventCount: events.length,
    };
  }

  // Manifest uses no-store caching, contains hashed filenames for cache-busted assets
  const manifest = {
    format: 'viewer-bundle-manifest',
    version: 6, // v6: per-entity timelines replace narrative chunks
    generatedAt: new Date().toISOString(),
    core: coreFilename,
    fallback: 'bundle.json',
    timelines: {
      entityCount: entityTimelines.size,
      totalEvents: narrativeHistory.length,
      files: timelineFiles,
    },
    images: imagesOptimized > 0 ? {
      optimized: true,
      count: imagesOptimized,
    } : undefined,
  };

  await writeFile(join(outputDir, 'bundle.manifest.json'), JSON.stringify(manifest), 'utf8');

  // Calculate size reduction from stripping enrichment debug data
  const originalSize = Buffer.byteLength(raw, 'utf8');
  const coreSize = Buffer.byteLength(coreJson, 'utf8');

  console.log(`Viewer bundle processed:`);
  console.log(`  - Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Core: ${coreFilename} (${(coreSize / 1024).toFixed(0)} KB)`);
  console.log(`  - Entity timelines: ${entityTimelines.size} files, ${(totalTimelineBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Enrichment debug data stripped (kept aliases only)`);
  console.log(`  - Chronicle generation metadata stripped`);
  console.log(`  - Image generation prompts stripped`);
  if (imagesOptimized > 0) {
    console.log(`  - Images optimized: ${imagesOptimized} (WebP with thumbnails)`);
  }
}

main().catch((error) => {
  console.error('Failed to chunk viewer bundle:', error);
  process.exitCode = 1;
});
