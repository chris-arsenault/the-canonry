/**
 * Ornaments - SVG decorative elements for the Chronicler wiki
 *
 * Provides parchment texture, page frame scroll work, section dividers,
 * frost accents, and ornamental HR data URIs.
 *
 * Theme: Warm Library with frost/ice accents
 * Gold: #c49a5c  |  Frost: #8ab4c4
 */

import React from 'react';

/* ===================
   ParchmentTexture
   Perlin noise overlay that gives the content area organic paper grain.
   Position via CSS on the parent — this just renders the SVG.

   Requires the parent to have position: relative and the caller to
   apply positioning (e.g., position: absolute; inset: 0).
   =================== */

export function ParchmentTexture({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="parchment-noise"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves={4}
            seed={2}
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            in="noise"
            values="1.2 0   0   0 0.08
                    0   1.0 0   0 0.05
                    0   0   0.8 0 0.02
                    0   0   0   1 0"
          />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#parchment-noise)" />
    </svg>
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
