/**
 * Ornaments - Decorative elements for the Chronicler wiki
 *
 * Provides canvas-generated parchment texture, page frame scroll work,
 * section dividers, frost accents, and ornamental HR data URIs.
 *
 * Parchment texture uses tileable value noise rendered to a canvas,
 * displayed as a repeating CSS background with mix-blend-mode: screen.
 * On dark backgrounds, black areas are invisible and warm tan details
 * show through as organic paper grain.
 *
 * Theme: Warm Library with frost/ice accents
 * Gold: #c49a5c  |  Frost: #8ab4c4
 */

import React, { useState, useEffect, useCallback } from 'react';

/* =========================================
   Tileable noise utilities
   Value noise with wrapping for seamless tiles.
   ========================================= */

const TILE_SIZE = 512;

/** Integer hash → [0, 1] */
function hash(x: number, y: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h = h ^ (h >>> 16);
  return ((h >>> 0) & 0x7fffffff) / 0x7fffffff;
}

/** Smooth interpolated value noise, tileable at `wrap` cells */
function smoothNoise(x: number, y: number, seed: number, wrap: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (c: number) => ((c % wrap) + wrap) % wrap;

  const n00 = hash(w(ix), w(iy), seed);
  const n10 = hash(w(ix + 1), w(iy), seed);
  const n01 = hash(w(ix), w(iy + 1), seed);
  const n11 = hash(w(ix + 1), w(iy + 1), seed);

  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) +
         n01 * (1 - sx) * sy + n11 * sx * sy;
}

/** Fractional Brownian Motion — layered octaves of value noise */
function fbm(x: number, y: number, seed: number, baseGrid: number, octaves: number): number {
  let value = 0;
  let amp = 1;
  let total = 0;
  let grid = baseGrid;

  for (let o = 0; o < octaves; o++) {
    value += smoothNoise(x * grid / TILE_SIZE, y * grid / TILE_SIZE, seed + o * 31, grid) * amp;
    total += amp;
    amp *= 0.5;
    grid *= 2;
  }

  return value / total;
}

/* =========================================
   Parchment texture generation
   Renders multi-layer noise to an off-screen
   canvas and returns a data URL for use as a
   repeating CSS background-image.
   ========================================= */

// Warm parchment base color
const P_R = 210, P_G = 185, P_B = 140;

function generateTexture(config: ParchmentConfig): string {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const d = img.data;
  const { warmth, grain, creases, splotches } = config;
  const gGrid = Math.max(2, Math.round(grain.scale));
  const cGrid = Math.max(2, Math.round(creases.scale));
  const sGrid = Math.max(1, Math.round(splotches.scale));

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Start with noise in 0-1 range
      let noise = 0;

      // Fine grain — multi-octave fractal noise for paper fiber texture
      if (grain.enabled) {
        noise = fbm(x, y, 42, gGrid, grain.octaves);
      }

      // Creases darken the grain (reduce noise in crease areas)
      if (creases.enabled) {
        const cv = fbm(x, y, 137, cGrid, 2);
        const cm = Math.min(1, Math.max(0, cv - 0.52) * 4);
        noise = Math.max(0, noise - cm * creases.intensity);
      }

      // Splotches darken the grain (reduce noise in aged areas)
      if (splotches.enabled) {
        const sv = smoothNoise(
          x * sGrid / TILE_SIZE,
          y * sGrid / TILE_SIZE,
          313, sGrid,
        );
        const sm = Math.pow(Math.max(0, sv - 0.4) / 0.6, 0.8);
        noise = Math.max(0, noise - sm * splotches.intensity);
      }

      // Combine: uniform warm base + noise adds grain variation on top
      // warmth = minimum brightness (overall warm tint)
      // grain.contrast = how much noise modulates above the base
      const v = Math.min(1, warmth + noise * grain.contrast);
      const i = (y * TILE_SIZE + x) * 4;
      d[i]     = (P_R * v) | 0;
      d[i + 1] = (P_G * v) | 0;
      d[i + 2] = (P_B * v) | 0;
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/* =========================================
   ParchmentConfig
   ========================================= */

export interface ParchmentConfig {
  opacity: number;
  warmth: number;
  grain: { enabled: boolean; scale: number; contrast: number; octaves: number };
  creases: { enabled: boolean; scale: number; intensity: number };
  splotches: { enabled: boolean; scale: number; intensity: number };
}

export const DEFAULT_PARCHMENT_CONFIG: ParchmentConfig = {
  opacity: 1,
  warmth: 0.12,
  grain:    { enabled: true, scale: 128, contrast: 0.15, octaves: 4 },
  creases:  { enabled: true, scale: 5,   intensity: 0.08 },
  splotches:{ enabled: true, scale: 3,   intensity: 0.06 },
};

/* =========================================
   ParchmentTexture component
   Canvas-generated tileable parchment noise.
   Renders as a div with repeating background
   using mix-blend-mode: screen.
   ========================================= */

export function ParchmentTexture({ className, config = DEFAULT_PARCHMENT_CONFIG }: {
  className?: string;
  config?: ParchmentConfig;
}) {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);

  // Only regenerate when layer params change — opacity is CSS-only
  const genKey = JSON.stringify({ w: config.warmth, g: config.grain, c: config.creases, s: config.splotches });

  useEffect(() => {
    setTextureUrl(generateTexture(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey]);

  if (!textureUrl) return null;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundImage: `url(${textureUrl})`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${TILE_SIZE}px`,
        mixBlendMode: 'screen',
        opacity: config.opacity,
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
const SLIDER_ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 };
const LABEL: React.CSSProperties = { width: 70, flexShrink: 0, color: '#c4b99a' };
const VAL: React.CSSProperties = { width: 42, textAlign: 'right', color: '#8a7d6b', flexShrink: 0 };
const SECTION: React.CSSProperties = { marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(196,164,112,0.15)' };
const SECTION_LABEL: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, color: '#c49a5c' };

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={SLIDER_ROW}>
      <span style={LABEL}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#c49a5c' }} />
      <span style={VAL}>{step >= 1 ? value : value.toFixed(2)}</span>
    </div>
  );
}

export function ParchmentDebugPanel({ config, onChange }: {
  config: ParchmentConfig;
  onChange: (c: ParchmentConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = useCallback((path: string, val: number | boolean) => {
    const next = JSON.parse(JSON.stringify(config)) as ParchmentConfig;
    const parts = path.split('.');
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = val;
    onChange(next);
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
      <Slider label="Warmth" value={config.warmth} min={0} max={0.5} step={0.01} onChange={v => set('warmth', v)} />

      <div style={SECTION}>
        <label style={SECTION_LABEL}>
          <input type="checkbox" checked={config.grain.enabled} onChange={e => set('grain.enabled', e.target.checked)} />
          Paper Grain
        </label>
        <Slider label="Scale" value={config.grain.scale} min={16} max={256} step={1} onChange={v => set('grain.scale', v)} />
        <Slider label="Contrast" value={config.grain.contrast} min={0} max={0.5} step={0.01} onChange={v => set('grain.contrast', v)} />
        <Slider label="Octaves" value={config.grain.octaves} min={1} max={6} step={1} onChange={v => set('grain.octaves', v)} />
      </div>

      <div style={SECTION}>
        <label style={SECTION_LABEL}>
          <input type="checkbox" checked={config.creases.enabled} onChange={e => set('creases.enabled', e.target.checked)} />
          Crease Marks
        </label>
        <Slider label="Scale" value={config.creases.scale} min={2} max={16} step={1} onChange={v => set('creases.scale', v)} />
        <Slider label="Intensity" value={config.creases.intensity} min={0} max={1} step={0.01} onChange={v => set('creases.intensity', v)} />
      </div>

      <div style={SECTION}>
        <label style={SECTION_LABEL}>
          <input type="checkbox" checked={config.splotches.enabled} onChange={e => set('splotches.enabled', e.target.checked)} />
          Age Splotches
        </label>
        <Slider label="Scale" value={config.splotches.scale} min={1} max={8} step={1} onChange={v => set('splotches.scale', v)} />
        <Slider label="Intensity" value={config.splotches.intensity} min={0} max={1} step={0.01} onChange={v => set('splotches.intensity', v)} />
      </div>

      <button onClick={() => onChange({ ...DEFAULT_PARCHMENT_CONFIG })}
        style={{ background: 'none', border: '1px solid rgba(196,164,112,0.3)', borderRadius: 4,
          padding: '3px 10px', color: '#c4b99a', cursor: 'pointer', fontSize: 10 }}>
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
        stroke="#c49a5c" strokeWidth="1.5" opacity="0.55" strokeLinecap="round"
      />
      {/* Corner scroll — bold curve at the bend */}
      <path
        d="M6,35 C8,20 20,8 35,6"
        stroke="#c49a5c" strokeWidth="2.5" opacity="0.6" strokeLinecap="round"
      />
      {/* Inner curl — decorative spiral at corner */}
      <path
        d="M22,42 C24,28 28,22 42,20 C34,25 28,31 26,40"
        stroke="#c49a5c" strokeWidth="1.2" opacity="0.45" strokeLinecap="round"
      />
      {/* Secondary inner curve */}
      <path
        d="M14,90 L14,48 C14,28 28,14 48,14 L90,14"
        stroke="#c49a5c" strokeWidth="0.7" opacity="0.25" strokeLinecap="round"
      />
      {/* Frost accent tendril */}
      <path
        d="M10,100 C10,55 18,32 42,16 L78,11"
        stroke="#8ab4c4" strokeWidth="0.8" opacity="0.3" strokeLinecap="round"
      />
      {/* Corner diamond */}
      <path d="M30 30 L34 25 L38 30 L34 35 Z" fill="#c49a5c" opacity="0.45" />
      {/* Terminal gold dots */}
      <circle cx="6" cy="115" r="2.5" fill="#c49a5c" opacity="0.45" />
      <circle cx="115" cy="6" r="2.5" fill="#c49a5c" opacity="0.45" />
      {/* Frost dots */}
      <circle cx="14" cy="90" r="1.5" fill="#8ab4c4" opacity="0.3" />
      <circle cx="90" cy="14" r="1.5" fill="#8ab4c4" opacity="0.3" />
    </svg>
  );
}

export function PageFrame({ className }: { className?: string }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 90,
    height: 90,
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
