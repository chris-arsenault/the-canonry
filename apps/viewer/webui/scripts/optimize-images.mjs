/**
 * Optimize images for the viewer bundle.
 *
 * Generates:
 * - Thumbnail (400px wide, WebP) for inline display and hover cards
 * - Full size (WebP, quality 85) for click-to-view
 * - Manifest file mapping original filenames to optimized paths
 *
 * Usage:
 *   node scripts/optimize-images.mjs [--input <dir>] [--output <dir>]
 *
 * Defaults:
 *   --input  dist/bundles/default/images
 *   --output dist/bundles/default/images
 *
 * Output structure:
 *   {output}/
 *     {name}.webp        - Full size WebP
 *     {name}_thumb.webp  - Thumbnail WebP
 *   image-manifest.json  - Mapping of original paths to optimized paths
 */

import { mkdir, readdir, stat, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, basename, extname, dirname } from 'node:path';

const DEFAULT_INPUT = 'dist/bundles/default/images';
const DEFAULT_OUTPUT = 'dist/bundles/default/images';

const THUMBNAIL_WIDTH = 400;
const FULL_QUALITY = 85;
const THUMBNAIL_QUALITY = 80;

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

async function loadSharp() {
  try {
    const sharp = await import('sharp');
    return sharp.default;
  } catch (e) {
    console.error('Error: sharp is not installed. Run: npm install sharp');
    process.exit(1);
  }
}

async function optimizeImage(sharp, inputPath, outputDir, filename, imagesRelPath) {
  const name = basename(filename, extname(filename));
  const thumbFilename = `${name}_thumb.webp`;
  const fullFilename = `${name}.webp`;
  const thumbPath = join(outputDir, thumbFilename);
  const fullPath = join(outputDir, fullFilename);

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Generate thumbnail (400px wide, maintain aspect ratio)
  await image
    .clone()
    .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toFile(thumbPath);

  // Generate full size WebP (same dimensions, better compression)
  await image
    .clone()
    .webp({ quality: FULL_QUALITY })
    .toFile(fullPath);

  const thumbStat = await stat(thumbPath);
  const fullStat = await stat(fullPath);
  const origStat = await stat(inputPath);

  return {
    original: origStat.size,
    full: fullStat.size,
    thumb: thumbStat.size,
    width: metadata.width,
    height: metadata.height,
    // Paths relative to bundle directory (for manifest)
    thumbPath: `${imagesRelPath}/${thumbFilename}`,
    fullPath: `${imagesRelPath}/${fullFilename}`,
    originalFilename: filename,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const inputDir = resolve(process.cwd(), args.get('input') ?? DEFAULT_INPUT);
  const outputDir = resolve(process.cwd(), args.get('output') ?? DEFAULT_OUTPUT);
  const bundleDir = args.get('bundle-dir') ?? dirname(outputDir);
  const imagesRelPath = args.get('images-rel-path') ?? 'images';
  const deleteOriginals = args.has('delete-originals');

  const sharp = await loadSharp();

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // Find all image files (excluding already optimized webp thumbs)
  const files = await readdir(inputDir);
  const imageFiles = files.filter(f =>
    /\.(png|jpg|jpeg)$/i.test(f) || (/\.webp$/i.test(f) && !f.includes('_thumb'))
  );

  console.log(`Optimizing ${imageFiles.length} images...`);
  console.log(`  Input:  ${inputDir}`);
  console.log(`  Output: ${outputDir}`);
  console.log('');

  let totalOriginal = 0;
  let totalFull = 0;
  let totalThumb = 0;
  let processed = 0;

  // Manifest maps imageId (filename without extension) to optimized paths
  const manifest = {};

  for (const file of imageFiles) {
    const inputPath = join(inputDir, file);
    try {
      const result = await optimizeImage(sharp, inputPath, outputDir, file, imagesRelPath);
      totalOriginal += result.original;
      totalFull += result.full;
      totalThumb += result.thumb;
      processed++;

      // Add to manifest - key is the original filename (which matches imageId pattern)
      const imageId = basename(file, extname(file));
      manifest[imageId] = {
        thumb: result.thumbPath,
        full: result.fullPath,
      };

      const savings = ((1 - result.full / result.original) * 100).toFixed(0);
      console.log(`  ${file}: ${(result.original / 1024 / 1024).toFixed(1)}MB → ${(result.full / 1024).toFixed(0)}KB full, ${(result.thumb / 1024).toFixed(0)}KB thumb (${savings}% smaller)`);

      // Delete original file if requested
      if (deleteOriginals && !file.endsWith('.webp')) {
        await unlink(inputPath);
      }
    } catch (err) {
      console.error(`  Error processing ${file}:`, err.message);
    }
  }

  // Write manifest to bundle directory
  const manifestPath = join(bundleDir, 'image-manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('');
  console.log('Summary:');
  console.log(`  Processed: ${processed} images`);
  console.log(`  Original:  ${(totalOriginal / 1024 / 1024).toFixed(1)} MB${deleteOriginals ? ' (deleted)' : ''}`);
  console.log(`  Full WebP: ${(totalFull / 1024 / 1024).toFixed(1)} MB (${((1 - totalFull / totalOriginal) * 100).toFixed(0)}% smaller)`);
  console.log(`  Thumbnails: ${(totalThumb / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Total optimized: ${((totalFull + totalThumb) / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Manifest: ${manifestPath}`);

  return manifest;
}

// Export for use by chunk-viewer-bundle.mjs
export { main as optimizeImages };

main().catch((error) => {
  console.error('Failed to optimize images:', error);
  process.exitCode = 1;
});
