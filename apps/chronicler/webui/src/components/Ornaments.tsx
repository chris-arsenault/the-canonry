/**
 * Ornaments - SVG decorative elements for the Chronicler wiki
 *
 * Provides parchment texture, section dividers, frost accents,
 * and ornamental HR data URIs. All SVG definitions in one file
 * for easy reuse across components.
 *
 * Theme: Warm Library with frost/ice accents
 * Gold: #c49a5c  |  Frost: #8ab4c4
 */

import React from 'react';

/* ===================
   ParchmentTexture
   Full-viewport Perlin noise overlay that gives the background
   an organic paper grain. Render once at app root level.
   =================== */

export function ParchmentTexture() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        mixBlendMode: 'soft-light' as const,
        opacity: 0.06,
      }}
    >
      <defs>
        <filter
          id="parchment-noise"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          {/* Fractal noise produces organic, paper-like texture.
              baseFrequency 0.65 = fine grain. numOctaves 4 = multi-scale detail. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves={4}
            seed={2}
            stitchTiles="stitch"
            result="noise"
          />
          {/* Warm-tint the noise toward parchment tones:
              boost red, slightly reduce blue, add warm offset */}
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
   Ice crystalline decorative band. Irregular crystal spikes
   along a baseline. For infobox edges and similar borders.
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
      viewBox="0 0 260 8"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style={position === 'bottom' ? { transform: 'scaleY(-1)' } : undefined}
    >
      {/* Base frost line */}
      <line
        x1="0" y1="7" x2="260" y2="7"
        stroke="#8ab4c4"
        strokeWidth="0.5"
        opacity="0.3"
      />
      {/* Crystal spikes — irregular heights */}
      <path
        d="M20,7 L22,3 L24,7 M50,7 L51,4 L52,7 M65,7 L67,1 L69,7
           M90,7 L91,5 L92,7 M110,7 L112,2 L114,7 M130,7 L131,5 L132,7
           M150,7 L152,0 L154,7 M170,7 L171,4 L172,7 M195,7 L197,2 L199,7
           M215,7 L216,5 L217,7 M240,7 L241,3 L242,7"
        stroke="#8ab4c4"
        strokeWidth="0.6"
        opacity="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crystal tip dots */}
      <circle cx="67" cy="1" r="0.8" fill="#a8ccd8" opacity="0.3" />
      <circle cx="152" cy="0" r="0.8" fill="#a8ccd8" opacity="0.3" />
      <circle cx="112" cy="2" r="0.6" fill="#a8ccd8" opacity="0.2" />
    </svg>
  );
}

/* ===================
   Ornamental HR Data URI
   SVG for use as CSS background-image on markdown <hr> elements.
   Gold line with center diamond, frost accent dots, small curls.
   =================== */

export const ORNAMENTAL_HR_DATA_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 24' fill='none'%3E%3Cline x1='20' y1='12' x2='220' y2='12' stroke='%23c49a5c' stroke-width='0.5' opacity='0.3'/%3E%3Cpath d='M120 6 L124 12 L120 18 L116 12 Z' fill='%23c49a5c' opacity='0.5'/%3E%3Ccircle cx='108' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Ccircle cx='132' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Cpath d='M108 12 C100 8 88 10 75 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Cpath d='M132 12 C140 8 152 10 165 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Ccircle cx='72' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3Ccircle cx='168' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3C/svg%3E")`;
