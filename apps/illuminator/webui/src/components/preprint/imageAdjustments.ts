/**
 * Deterministic image adjustments — types, CSS filter preview, and canvas-based apply.
 *
 * Preview: brightness, contrast, saturation are previewed via CSS `filter` on the <img>.
 * Apply: all adjustments (including sharpen and warmth) are rendered to OffscreenCanvas
 * and returned as a new Blob.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageAdjustments {
  brightness: number; // 0.5–1.5, default 1
  contrast: number; // 0.5–2.0, default 1
  saturation: number; // 0–3, default 1
  sharpen: number; // 0–100, default 0 (unsharp mask amount)
  warmth: number; // -50 to 50, default 0 (color temperature shift)
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  warmth: 0,
};

export function isDefault(adj: ImageAdjustments): boolean {
  return (
    adj.brightness === 1 &&
    adj.contrast === 1 &&
    adj.saturation === 1 &&
    adj.sharpen === 0 &&
    adj.warmth === 0
  );
}

// ---------------------------------------------------------------------------
// CSS filter preview (brightness, contrast, saturation only)
// ---------------------------------------------------------------------------

export function buildCssFilter(adj: ImageAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 1) parts.push(`brightness(${adj.brightness})`);
  if (adj.contrast !== 1) parts.push(`contrast(${adj.contrast})`);
  if (adj.saturation !== 1) parts.push(`saturate(${adj.saturation})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ---------------------------------------------------------------------------
// SVG filter values for live preview of warmth and sharpen
// ---------------------------------------------------------------------------

/** feColorMatrix values string for warmth shift (matches applyWarmth channel math). */
export function warmthMatrixValues(warmth: number): string {
  const w = warmth / 100;
  let rMult: number;
  let bMult: number;
  if (w > 0) {
    rMult = 1 + w * 0.3;
    bMult = 1 - w * 0.15;
  } else {
    rMult = 1 + w * 0.15;
    bMult = 1 - w * 0.3;
  }
  return `${rMult} 0 0 0 0  0 1 0 0 0  0 0 ${bMult} 0 0  0 0 0 1 0`;
}

/** feConvolveMatrix kernel string for unsharp-mask sharpen preview. */
export function sharpenKernelValues(sharpen: number): string {
  const a = sharpen / 100;
  return `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`;
}

// ---------------------------------------------------------------------------
// Canvas-based apply (all adjustments)
// ---------------------------------------------------------------------------

export async function applyAdjustments(
  sourceBlob: Blob,
  adj: ImageAdjustments,
): Promise<Blob> {
  const bitmap = await createImageBitmap(sourceBlob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context from OffscreenCanvas");

  // Step 1: draw with brightness/contrast/saturation via canvas filter
  const cssFilter = buildCssFilter(adj);
  ctx.filter = cssFilter === "none" ? "none" : cssFilter;
  ctx.drawImage(bitmap, 0, 0);
  ctx.filter = "none";
  bitmap.close();

  // Step 2: sharpen (unsharp mask)
  if (adj.sharpen > 0) {
    applySharpen(ctx, width, height, adj.sharpen);
  }

  // Step 3: warmth (R/B channel shift)
  if (adj.warmth !== 0) {
    applyWarmth(ctx, width, height, adj.warmth);
  }

  return canvas.convertToBlob({ type: "image/png" });
}

// ---------------------------------------------------------------------------
// Sharpen — unsharp mask: result = original + factor * (original - blurred)
// ---------------------------------------------------------------------------

function applySharpen(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
): void {
  const factor = amount / 100;

  // Get current pixel data (already has brightness/contrast/saturation applied)
  const original = ctx.getImageData(0, 0, width, height);

  // Create blurred version via a second canvas with CSS blur
  const blurCanvas = new OffscreenCanvas(width, height);
  const blurCtx = blurCanvas.getContext("2d");
  if (!blurCtx) return;
  blurCtx.filter = "blur(1px)";
  blurCtx.drawImage(ctx.canvas, 0, 0);
  blurCtx.filter = "none";
  const blurred = blurCtx.getImageData(0, 0, width, height);

  // Unsharp mask per-pixel
  const d = original.data;
  const b = blurred.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(d[i] + factor * (d[i] - b[i]));
    d[i + 1] = clamp(d[i + 1] + factor * (d[i + 1] - b[i + 1]));
    d[i + 2] = clamp(d[i + 2] + factor * (d[i + 2] - b[i + 2]));
    // alpha channel untouched
  }

  ctx.putImageData(original, 0, 0);
}

// ---------------------------------------------------------------------------
// Warmth — shifts red/blue channel balance
// ---------------------------------------------------------------------------

function applyWarmth(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  warmth: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const w = warmth / 100; // -0.5 to 0.5

  for (let i = 0; i < d.length; i += 4) {
    if (w > 0) {
      // Warm: boost red, reduce blue
      d[i] = clamp(d[i] + d[i] * w * 0.3);
      d[i + 2] = clamp(d[i + 2] - d[i + 2] * w * 0.15);
    } else {
      // Cool: boost blue, reduce red
      d[i] = clamp(d[i] + d[i] * w * 0.15);
      d[i + 2] = clamp(d[i + 2] - d[i + 2] * w * 0.3);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
