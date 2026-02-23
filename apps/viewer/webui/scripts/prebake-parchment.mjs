/**
 * Pre-bake parchment texture tile at build time.
 *
 * Replicates the runtime canvas pipeline from Ornaments.tsx:
 *   1. Load parchment.jpg + vellum.jpg, resize to 512x512
 *   2. Frequency blend: result = vellum + strength * (parchment - blur(parchment))
 *   3. Mirror tile: 2x2 flip → 1024x1024 seamless tile
 *   4. Output as PNG
 *
 * Uses sharp for image processing (already a viewer devDependency).
 */

import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHRONICLER_TEXTURES = resolve(__dirname, '../../../chronicler/webui/src/assets/textures');

const WORK_SIZE = 512;
const BLUR_RADIUS = 10;
const DETAIL_STRENGTH = 1.2;

async function loadRaw(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(WORK_SIZE, WORK_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Downscale-upscale blur matching the browser pipeline.
 * scale = max(0.02, 1 / (radius * 1.5))
 */
async function blurDownscaleUpscale(filePath) {
  const scale = Math.max(0.02, 1 / (BLUR_RADIUS * 1.5));
  const sw = Math.max(1, (WORK_SIZE * scale) | 0);
  const sh = Math.max(1, (WORK_SIZE * scale) | 0);

  const { data } = await sharp(filePath)
    .resize(WORK_SIZE, WORK_SIZE, { fit: 'fill' })
    .resize(sw, sh, { fit: 'fill' })
    .resize(WORK_SIZE, WORK_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Frequency blend: result = vellum + strength * (parchment - blurred)
 */
function frequencyBlend(parchment, blurred, vellum, channels) {
  const result = Buffer.alloc(vellum.length);
  for (let i = 0; i < vellum.length; i += channels) {
    for (let c = 0; c < 3; c++) {
      const highPass = parchment[i + c] - blurred[i + c];
      result[i + c] = Math.max(0, Math.min(255, vellum[i + c] + highPass * DETAIL_STRENGTH));
    }
    // Alpha channel (if present)
    if (channels === 4) {
      result[i + 3] = 255;
    }
  }
  return result;
}

/**
 * Mirror tile: 2x2 flip → 1024x1024
 */
function mirrorTile(src, w, h, channels) {
  const tileW = w * 2;
  const tileH = h * 2;
  const result = Buffer.alloc(tileW * tileH * channels);
  const srcStride = w * channels;
  const dstStride = tileW * channels;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * channels;
      const pixel = [];
      for (let c = 0; c < channels; c++) pixel.push(src[si + c]);

      // Top-left: original
      const tl = (y * tileW + x) * channels;
      // Top-right: flipped horizontally
      const tr = (y * tileW + (tileW - 1 - x)) * channels;
      // Bottom-left: flipped vertically
      const bl = ((tileH - 1 - y) * tileW + x) * channels;
      // Bottom-right: flipped both
      const br = ((tileH - 1 - y) * tileW + (tileW - 1 - x)) * channels;

      for (let c = 0; c < channels; c++) {
        result[tl + c] = pixel[c];
        result[tr + c] = pixel[c];
        result[bl + c] = pixel[c];
        result[br + c] = pixel[c];
      }
    }
  }
  return { data: result, width: tileW, height: tileH };
}

async function main() {
  const parchmentPath = resolve(CHRONICLER_TEXTURES, 'parchment.jpg');
  const vellumPath = resolve(CHRONICLER_TEXTURES, 'vellum.jpg');
  const outputPath = resolve(CHRONICLER_TEXTURES, 'parchment-tile.jpg');

  console.log('Prebaking parchment texture...');

  // Load sources at WORK_SIZE
  const parchment = await loadRaw(parchmentPath);
  const vellum = await loadRaw(vellumPath);
  const blurred = await blurDownscaleUpscale(parchmentPath);

  // Frequency blend
  const blended = frequencyBlend(parchment.data, blurred, vellum.data, parchment.channels);

  // Mirror tile → 1024x1024
  const tile = mirrorTile(blended, WORK_SIZE, WORK_SIZE, parchment.channels);

  // Write output
  await sharp(tile.data, {
    raw: { width: tile.width, height: tile.height, channels: parchment.channels },
  })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  const { size } = await import('node:fs').then(fs => fs.promises.stat(outputPath));
  console.log(`  Output: ${outputPath}`);
  console.log(`  Size: ${(size / 1024).toFixed(1)} KB (${tile.width}x${tile.height})`);
}

main().catch((err) => {
  console.error('Failed to prebake parchment texture:', err);
  process.exitCode = 1;
});
