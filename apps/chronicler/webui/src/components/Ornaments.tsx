/**
 * Ornaments - Decorative elements for the Chronicler wiki
 *
 * Parchment texture uses real photographic vellum images processed
 * through a canvas pipeline:
 *   1. Frequency blend — fiber detail from parchment + smooth tones from vellum
 *   2. Mirror tile — 2x2 flip for guaranteed seamless tiling
 * Natural warm tones are preserved (no desaturation). The processed tile
 * is displayed with mix-blend-mode: soft-light over the warm brown background,
 * adding organic grain variation.
 *
 * Theme: Warm Library with frost/ice accents
 * Gold: #c49a5c  |  Frost: #8ab4c4
 */

import React, { useState, useEffect, useCallback } from 'react';
import parchmentSrc from '../assets/textures/parchment.jpg';
import vellumSrc from '../assets/textures/vellum.jpg';

/* =========================================
   Image processing pipeline
   ========================================= */

const WORK_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

/** Draw image scaled to fill a canvas of the given size */
function drawScaled(img: HTMLImageElement | HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * Downscale-upscale blur — works in all browsers (no ctx.filter needed).
 * The downscale ratio controls blur strength.
 */
function blurCanvas(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;

  // Downscale factor: smaller = more blur
  const scale = Math.max(0.02, 1 / (radius * 1.5));
  const sw = Math.max(1, (src.width * scale) | 0);
  const sh = Math.max(1, (src.height * scale) | 0);

  // Draw small, then scale back up — bilinear interpolation acts as blur
  ctx.drawImage(src, 0, 0, sw, sh);
  ctx.drawImage(c, 0, 0, sw, sh, 0, 0, c.width, c.height);

  return c;
}

/**
 * Frequency blend — high-frequency detail from parchment on smooth vellum base.
 * result = vellum + strength * (parchment - blur(parchment))
 */
function frequencyBlend(
  parchmentCanvas: HTMLCanvasElement,
  vellumCanvas: HTMLCanvasElement,
  blurRadius: number,
  strength: number,
): HTMLCanvasElement {
  const w = parchmentCanvas.width;
  const h = parchmentCanvas.height;

  // Get pixel data from both sources
  const pCtx = parchmentCanvas.getContext('2d')!;
  const pData = pCtx.getImageData(0, 0, w, h).data;

  // Blur the parchment to extract its low-frequency component
  const blurred = blurCanvas(parchmentCanvas, blurRadius);
  const bData = blurred.getContext('2d')!.getImageData(0, 0, w, h).data;

  // Get vellum data (scaled to same size)
  const vCanvas = drawScaled(vellumCanvas, w, h);
  const vCtx = vCanvas.getContext('2d')!;
  const vImgData = vCtx.getImageData(0, 0, w, h);
  const vData = vImgData.data;

  // result = vellum + strength * (parchment - blur(parchment))
  for (let i = 0; i < vData.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const highPass = pData[i + c] - bData[i + c];
      vData[i + c] = Math.max(0, Math.min(255, vData[i + c] + highPass * strength));
    }
  }

  vCtx.putImageData(vImgData, 0, 0);
  return vCanvas;
}

/**
 * Mirror tile — 2x2 flip for guaranteed seamless tiling.
 * For organic textures like parchment, the symmetry is undetectable.
 */
function mirrorTile(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const ctx = c.getContext('2d')!;

  // Top-left: original
  ctx.drawImage(src, 0, 0);

  // Top-right: flipped horizontally
  ctx.save();
  ctx.translate(w * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  // Bottom-left: flipped vertically
  ctx.save();
  ctx.translate(0, h * 2);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  // Bottom-right: flipped both
  ctx.save();
  ctx.translate(w * 2, h * 2);
  ctx.scale(-1, -1);
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  return c;
}

/** Export canvas as object URL (more memory-efficient than data URL) */
function canvasToObjectURL(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, 'image/png');
  });
}

/* =========================================
   ParchmentConfig
   ========================================= */

export interface ParchmentConfig {
  opacity: number;        // overall texture visibility (0–1)
  blurRadius: number;     // frequency split point for blending (2–20)
  detailStrength: number; // how much parchment fiber detail to add (0–3)
}

export const DEFAULT_PARCHMENT_CONFIG: ParchmentConfig = {
  opacity: 1,
  blurRadius: 10,
  detailStrength: 1.2,
};

/* =========================================
   ParchmentTexture component
   Loads real parchment/vellum photos, processes
   them through the canvas pipeline, and displays
   as a repeating background with soft-light blend.
   ========================================= */

export function ParchmentTexture({ className, config = DEFAULT_PARCHMENT_CONFIG, prebakedUrl }: {
  className?: string;
  config?: ParchmentConfig;
  /** Pre-baked tile URL — skips runtime canvas pipeline when provided */
  prebakedUrl?: string;
}) {
  const [textureUrl, setTextureUrl] = useState<string | null>(prebakedUrl ?? null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);

  // Regenerate when processing params change — opacity is CSS-only
  // Skip entirely when a prebaked tile is provided
  const genKey = JSON.stringify({
    br: config.blurRadius,
    ds: config.detailStrength,
  });

  useEffect(() => {
    if (prebakedUrl) return;

    let cancelled = false;

    async function generate() {
      try {
        const [parchmentImg, vellumImg] = await Promise.all([
          loadImage(parchmentSrc),
          loadImage(vellumSrc),
        ]);
        if (cancelled) return;

        // Normalize both to working size
        const pCanvas = drawScaled(parchmentImg, WORK_SIZE, WORK_SIZE);
        const vCanvas = drawScaled(vellumImg, WORK_SIZE, WORK_SIZE);

        // Pipeline: frequency blend → mirror tile
        // Keep natural warm tones — soft-light blend adds organic warmth
        const blended = frequencyBlend(pCanvas, vCanvas, config.blurRadius, config.detailStrength);
        const tileable = mirrorTile(blended);

        const url = await canvasToObjectURL(tileable);
        if (!cancelled) {
          setTextureUrl(url);
        }
      } catch (err) {
        console.error('[ParchmentTexture] Failed to generate:', err);
      }
    }

    generate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prebakedUrl, genKey]);

  // Revoke previous object URL to avoid memory leaks (only for generated URLs)
  useEffect(() => {
    if (prevUrl && prevUrl !== textureUrl && prevUrl !== prebakedUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    setPrevUrl(textureUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureUrl]);

  // Cleanup on unmount (only for generated URLs)
  useEffect(() => {
    return () => {
      if (textureUrl && textureUrl !== prebakedUrl) URL.revokeObjectURL(textureUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!textureUrl) return null;

  // Mirror tile is 2x WORK_SIZE
  const tileSize = WORK_SIZE * 2;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundImage: `url(${textureUrl})`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${tileSize}px ${tileSize}px`,
        opacity: config.opacity,
        mixBlendMode: 'soft-light',
        pointerEvents: 'none',
      }}
    />
  );
}

/* =========================================
   ParchmentDebugPanel
   Temporary config popup for tuning params.
   ========================================= */

const PANEL: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 100,
  background: 'rgba(20,16,12,0.95)', border: '1px solid #c49a5c',
  borderRadius: 8, padding: 12, width: 300, maxHeight: '80vh', overflowY: 'auto',
  fontFamily: 'system-ui, sans-serif', fontSize: 11, color: '#e8dcc8',
};
const BTN: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 100,
  background: 'rgba(20,16,12,0.8)', border: '1px solid #c49a5c',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif', fontSize: 11, color: '#c49a5c',
};
const SLIDER_ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 };
const LABEL_S: React.CSSProperties = { width: 85, flexShrink: 0, color: '#c4b99a' };
const VAL_S: React.CSSProperties = { width: 42, textAlign: 'right', color: '#8a7d6b', flexShrink: 0 };

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={SLIDER_ROW}>
      <span style={LABEL_S}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#c49a5c' }} />
      <span style={VAL_S}>{step >= 1 ? value : value.toFixed(2)}</span>
    </div>
  );
}

export function ParchmentDebugPanel({ config, onChange }: {
  config: ParchmentConfig;
  onChange: (c: ParchmentConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  const set = useCallback((key: keyof ParchmentConfig, val: number) => {
    onChange({ ...config, [key]: val });
  }, [config, onChange]);

  if (!open) return <button style={BTN} onClick={() => setOpen(true)}>Parchment Config</button>;

  return (
    <div style={PANEL}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ color: '#c49a5c' }}>Parchment Config</strong>
        <button onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#c49a5c', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      <Slider label="Opacity" value={config.opacity} min={0} max={1} step={0.01} onChange={v => set('opacity', v)} />
      <Slider label="Blur radius" value={config.blurRadius} min={2} max={20} step={1} onChange={v => set('blurRadius', v)} />
      <Slider label="Detail" value={config.detailStrength} min={0} max={3} step={0.1} onChange={v => set('detailStrength', v)} />

      <button onClick={() => onChange({ ...DEFAULT_PARCHMENT_CONFIG })}
        style={{ background: 'none', border: '1px solid rgba(196,164,112,0.3)', borderRadius: 4,
          padding: '3px 10px', color: '#c4b99a', cursor: 'pointer', fontSize: 10, marginTop: 6 }}>
        Reset Defaults
      </button>
    </div>
  );
}

/* ===================
   PageFrame
   Four corner scroll work ornaments for framing the content area.
   Each corner is a fixed-size SVG (doesn't stretch/distort).
   Render inside a position:relative container.
   =================== */

function ScrollCorner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main gold L-curve */}
      <path
        d="M6,115 L6,35 C6,16 16,6 35,6 L115,6"
        stroke="#d4aa6c" strokeWidth="2.5" opacity="0.75" strokeLinecap="round"
      />
      {/* Corner scroll — bold curve at the bend */}
      <path
        d="M6,35 C8,20 20,8 35,6"
        stroke="#d4aa6c" strokeWidth="4" opacity="0.8" strokeLinecap="round"
      />
      {/* Inner curl — decorative spiral at corner */}
      <path
        d="M22,42 C24,28 28,22 42,20 C34,25 28,31 26,40"
        stroke="#d4aa6c" strokeWidth="2" opacity="0.65" strokeLinecap="round"
      />
      {/* Secondary inner curve */}
      <path
        d="M14,90 L14,48 C14,28 28,14 48,14 L90,14"
        stroke="#d4aa6c" strokeWidth="1.2" opacity="0.4" strokeLinecap="round"
      />
      {/* Frost accent tendril */}
      <path
        d="M10,100 C10,55 18,32 42,16 L78,11"
        stroke="#a8ccd8" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"
      />
      {/* Corner diamond */}
      <path d="M30 30 L35 23 L40 30 L35 37 Z" fill="#d4aa6c" opacity="0.7" />
      {/* Terminal gold dots */}
      <circle cx="6" cy="115" r="3.5" fill="#d4aa6c" opacity="0.65" />
      <circle cx="115" cy="6" r="3.5" fill="#d4aa6c" opacity="0.65" />
      {/* Frost dots */}
      <circle cx="14" cy="90" r="2.5" fill="#a8ccd8" opacity="0.45" />
      <circle cx="90" cy="14" r="2.5" fill="#a8ccd8" opacity="0.45" />
    </svg>
  );
}

export function PageFrame({ className }: { className?: string }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 140,
    height: 140,
    pointerEvents: 'none',
  };

  return (
    <div aria-hidden="true" className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Top-left */}
      <div style={{ ...base, top: 0, left: 0 }}>
        <ScrollCorner />
      </div>
      {/* Top-right */}
      <div style={{ ...base, top: 0, right: 0, transform: 'scaleX(-1)' }}>
        <ScrollCorner />
      </div>
      {/* Bottom-left */}
      <div style={{ ...base, bottom: 0, left: 0, transform: 'scaleY(-1)' }}>
        <ScrollCorner />
      </div>
      {/* Bottom-right */}
      <div style={{ ...base, bottom: 0, right: 0, transform: 'scale(-1)' }}>
        <ScrollCorner />
      </div>
    </div>
  );
}

/* ===================
   SectionDivider
   Ornamental filigree for section headings. Gold scrollwork
   with frost blue accent tendrils. Replaces Unicode ❦.
   =================== */

export function SectionDivider({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Center diamond */}
      <path d="M100 4 L104 12 L100 20 L96 12 Z" fill="#c49a5c" opacity="0.7" />

      {/* Left scrollwork — gold main curve */}
      <path
        d="M94 12 C85 12 78 6 65 6 C55 6 50 10 45 12 C40 14 35 14 28 12"
        stroke="#c49a5c"
        strokeWidth="1.2"
        opacity="0.6"
        strokeLinecap="round"
      />
      {/* Left frost accent tendril */}
      <path
        d="M94 12 C87 14 80 18 68 16 C58 14 52 16 45 14"
        stroke="#8ab4c4"
        strokeWidth="0.8"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* Right scrollwork — gold main curve (mirrored) */}
      <path
        d="M106 12 C115 12 122 6 135 6 C145 6 150 10 155 12 C160 14 165 14 172 12"
        stroke="#c49a5c"
        strokeWidth="1.2"
        opacity="0.6"
        strokeLinecap="round"
      />
      {/* Right frost accent tendril (mirrored) */}
      <path
        d="M106 12 C113 14 120 18 132 16 C142 14 148 16 155 14"
        stroke="#8ab4c4"
        strokeWidth="0.8"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* Terminal frost dots */}
      <circle cx="25" cy="12" r="1.5" fill="#8ab4c4" opacity="0.4" />
      <circle cx="175" cy="12" r="1.5" fill="#8ab4c4" opacity="0.4" />
    </svg>
  );
}

/* ===================
   FrostEdge
   Ice crystalline decorative band with a visible frost-blue
   background gradient. Irregular crystal spikes grow from a
   frosted bar. For infobox edges, hero image bottoms, etc.
   =================== */

export function FrostEdge({
  position = 'top',
  className,
}: {
  position?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 12"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style={position === 'bottom' ? { transform: 'scaleY(-1)' } : undefined}
    >
      {/* Frost background band — visible blue-tinted bar */}
      <rect
        x="0" y="6" width="260" height="6"
        fill="#8ab4c4"
        opacity="0.12"
      />
      {/* Frost gradient fade at the bar edge */}
      <defs>
        <linearGradient id={`frost-fade-${position}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ab4c4" stopOpacity="0" />
          <stop offset="60%" stopColor="#8ab4c4" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#8ab4c4" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="260" height="12" fill={`url(#frost-fade-${position})`} />

      {/* Crystal spikes — irregular heights, more prominent */}
      <path
        d="M15,11 L17,5 L19,11 M35,11 L36,7 L37,11 M55,11 L57,2 L59,11
           M75,11 L76,6 L77,11 M95,11 L97,1 L99,11 M115,11 L116,7 L117,11
           M135,11 L137,0 L139,11 M155,11 L156,5 L157,11 M175,11 L177,2 L179,11
           M195,11 L196,6 L197,11 M215,11 L217,1 L219,11 M240,11 L241,5 L242,11"
        stroke="#8ab4c4"
        strokeWidth="0.8"
        opacity="0.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Filled crystal highlights on tallest spikes */}
      <path d="M55,11 L57,2 L59,11 Z" fill="#8ab4c4" opacity="0.06" />
      <path d="M95,11 L97,1 L99,11 Z" fill="#8ab4c4" opacity="0.06" />
      <path d="M135,11 L137,0 L139,11 Z" fill="#a8ccd8" opacity="0.08" />
      <path d="M175,11 L177,2 L179,11 Z" fill="#8ab4c4" opacity="0.06" />
      <path d="M215,11 L217,1 L219,11 Z" fill="#8ab4c4" opacity="0.06" />

      {/* Crystal tip dots — glint effect */}
      <circle cx="57" cy="2" r="0.8" fill="#a8ccd8" opacity="0.5" />
      <circle cx="97" cy="1" r="0.9" fill="#a8ccd8" opacity="0.5" />
      <circle cx="137" cy="0" r="1.0" fill="#d0e8f0" opacity="0.6" />
      <circle cx="177" cy="2" r="0.8" fill="#a8ccd8" opacity="0.5" />
      <circle cx="217" cy="1" r="0.9" fill="#a8ccd8" opacity="0.5" />
    </svg>
  );
}

/* ===================
   Ornamental HR Data URI
   SVG for use as CSS background-image on markdown <hr> elements.
   Gold line with center diamond, frost accent dots, small curls.
   =================== */

export const ORNAMENTAL_HR_DATA_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 24' fill='none'%3E%3Cline x1='20' y1='12' x2='220' y2='12' stroke='%23c49a5c' stroke-width='0.5' opacity='0.3'/%3E%3Cpath d='M120 6 L124 12 L120 18 L116 12 Z' fill='%23c49a5c' opacity='0.5'/%3E%3Ccircle cx='108' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Ccircle cx='132' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Cpath d='M108 12 C100 8 88 10 75 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Cpath d='M132 12 C140 8 152 10 165 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Ccircle cx='72' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3Ccircle cx='168' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3C/svg%3E")`;
