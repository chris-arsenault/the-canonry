/**
 * Image post-processing utilities.
 *
 * Runs in Web Worker context using OffscreenCanvas for pixel manipulation.
 */

/**
 * Boost saturation of an image blob by a given factor.
 * factor = 1.0 means no change, 2.0 doubles saturation, etc.
 *
 * Uses HSL conversion per-pixel on an OffscreenCanvas.
 */
export async function boostSaturation(blob: Blob, factor: number): Promise<Blob> {
  if (factor === 1.0) return blob;

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) continue; // achromatic — no saturation to boost

    const d = max - min;
    let s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;

    // Boost saturation, clamped to [0, 1]
    s = Math.min(1, s * factor);

    // HSL -> RGB
    let r2: number, g2: number, b2: number;
    if (s === 0) {
      r2 = g2 = b2 = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r2 = hueToRgb(p, q, h + 1 / 3);
      g2 = hueToRgb(p, q, h);
      b2 = hueToRgb(p, q, h - 1 / 3);
    }

    data[i] = Math.round(r2 * 255);
    data[i + 1] = Math.round(g2 * 255);
    data[i + 2] = Math.round(b2 * 255);
    // alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
