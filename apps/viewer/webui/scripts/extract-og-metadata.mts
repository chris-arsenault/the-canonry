/**
 * Extract OG metadata from the viewer core bundle.
 *
 * Runs after precompute-page-index.mts, reads the core bundle (which
 * contains the precomputed page index with entries, slugs, cover image IDs),
 * resolves image URLs, and produces og-metadata.json for the OG Lambda.
 *
 * Usage: SITE_URL=https://theiceremembers.com CATALOG_PATH=../pics/catalog.json tsx extract-og-metadata.mts
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = resolve(__dirname, '../dist/bundles/default');
const OUTPUT_PATH = resolve(__dirname, '../dist/og-metadata.json');

const SITE_URL = process.env.SITE_URL || 'https://theiceremembers.com';
const CATALOG_PATH = process.env.CATALOG_PATH || '';

interface ImageResult {
  imageId: string;
  entityId: string | null;
  localPath: string | null;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface PageEntry {
  id: string;
  title: string;
  type: string;
  slug: string;
  summary?: string;
  entityKind?: string;
  culture?: string;
  chronicle?: { format: string };
  eraNarrative?: { thesis?: string; tone?: string };
  coverImageId?: string;
}

interface RouteOg {
  title: string;
  description: string;
  image: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageAlt: string | null;
  type: string;
}

/**
 * Convert a raw image path to a webp CDN URL.
 * Raw: /raw/project_xxx/img_yyy → webp/project_xxx/img_yyy.webp
 */
function rawToWebpUrl(localPath: string): string {
  const stripped = localPath.startsWith('/') ? localPath.slice(1) : localPath;
  const webpPath = stripped.replace(/^raw\//, 'webp/') + '.webp';
  return `${SITE_URL}/${webpPath}`;
}

function truncateToSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLen * 0.5) return truncated.slice(0, lastPeriod + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '…' : truncated + '…';
}

function buildDescription(entry: PageEntry): string {
  if (entry.summary) return truncateToSentence(entry.summary, 200);

  switch (entry.type) {
    case 'entity':
      return [entry.entityKind, entry.culture ? `of ${entry.culture} culture` : '']
        .filter(Boolean)
        .join(' ');
    case 'chronicle':
      return `A ${entry.chronicle?.format ?? 'chronicle'} from The Ice Remembers.`;
    case 'era_narrative':
      return entry.eraNarrative?.thesis ?? `An era narrative — ${entry.eraNarrative?.tone ?? ''} tone.`;
    case 'static':
      return '';
    default:
      return '';
  }
}

function ogType(entry: PageEntry): string {
  switch (entry.type) {
    case 'chronicle':
    case 'era_narrative':
    case 'static':
      return 'article';
    default:
      return 'website';
  }
}

async function main() {
  // Read manifest to find current core bundle filename
  const manifestPath = join(BUNDLE_DIR, 'bundle.manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const corePath = join(BUNDLE_DIR, manifest.core);

  console.log('Extracting OG metadata...');
  const bundle = JSON.parse(readFileSync(corePath, 'utf8'));

  const pageIndex = bundle.precomputedPageIndex;
  if (!pageIndex?.entries) {
    console.log('  Skipped: no precomputedPageIndex in core bundle.');
    return;
  }

  // Load image dimensions from pics catalog (viewer bundle lacks dimensions)
  const dimensionsByImageId = new Map<string, ImageDimensions>();
  if (CATALOG_PATH && existsSync(CATALOG_PATH)) {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
    for (const img of catalog.images ?? []) {
      if (img.imageId && img.width && img.height) {
        dimensionsByImageId.set(img.imageId, { width: img.width, height: img.height });
      }
    }
    console.log(`  Loaded ${dimensionsByImageId.size} image dimensions from catalog`);
  }

  // Build imageId → localPath lookup from imageData.results
  const imageResults: ImageResult[] = bundle.imageData?.results ?? [];
  const imagePathById = new Map<string, string>();
  for (const img of imageResults) {
    if (img.imageId && img.localPath) {
      imagePathById.set(img.imageId, img.localPath);
    }
  }

  // Also build entityId → imageId for entities that have images
  const entityImageId = new Map<string, string>();
  for (const img of imageResults) {
    if (img.entityId && img.imageId) {
      entityImageId.set(img.entityId, img.imageId);
    }
  }

  const routes: Record<string, RouteOg> = {};
  const entries: PageEntry[] = pageIndex.entries;

  for (const entry of entries) {
    // Determine image: use coverImageId first, then entity image for entity pages
    let imageUrl: string | null = null;
    let imageAlt: string | null = null;
    let resolvedImageId: string | null = null;

    if (entry.coverImageId) {
      const path = imagePathById.get(entry.coverImageId);
      if (path) {
        imageUrl = rawToWebpUrl(path);
        imageAlt = `Cover image for ${entry.title}`;
        resolvedImageId = entry.coverImageId;
      }
    } else if (entry.type === 'entity') {
      // Look up entity image by entity ID
      const imgId = entityImageId.get(entry.id);
      if (imgId) {
        const path = imagePathById.get(imgId);
        if (path) {
          imageUrl = rawToWebpUrl(path);
          imageAlt = entry.title;
          resolvedImageId = imgId;
        }
      }
    }

    const dims = resolvedImageId ? dimensionsByImageId.get(resolvedImageId) : undefined;

    const routeSlug = `page/${entry.slug}`;
    routes[routeSlug] = {
      title: entry.title,
      description: buildDescription(entry),
      image: imageUrl,
      imageWidth: dims?.width ?? null,
      imageHeight: dims?.height ?? null,
      imageAlt,
      type: ogType(entry),
    };
  }

  const metadata = {
    siteName: 'The Ice Remembers',
    defaultImage: `${SITE_URL}/og-image.png`,
    locale: 'en_US',
    themeColor: '#352a1e',
    routes,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(metadata));
  const sizeKB = (Buffer.byteLength(JSON.stringify(metadata)) / 1024).toFixed(1);
  console.log(`  Routes: ${Object.keys(routes).length}`);
  console.log(`  Size: ${sizeKB} KB → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed to extract OG metadata:', err);
  process.exitCode = 1;
});
