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

   Sits ON TOP of all content with pointer-events: none so it
   doesn't block interaction. High z-index ensures it overlays
   elements with solid backgrounds.
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
        zIndex: 9999,
        mixBlendMode: 'overlay' as const,
        opacity: 0.12,
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
   ScrollBorder
   Ornamental border frame using gold scrollwork corners
   and frost-tinted edges. Wraps content areas like infoboxes.
   =================== */

export function ScrollBorder({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 400"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      {/* Top-left corner scrollwork */}
      <path
        d="M4,20 C4,10 10,4 20,4 M4,20 C6,15 8,12 14,10 C10,14 8,18 8,24"
        stroke="#c49a5c" strokeWidth="1" opacity="0.5" strokeLinecap="round"
      />
      <path
        d="M20,4 C14,6 10,10 8,16"
        stroke="#8ab4c4" strokeWidth="0.6" opacity="0.3" strokeLinecap="round"
      />
      <circle cx="4" cy="20" r="1.5" fill="#c49a5c" opacity="0.4" />

      {/* Top-right corner scrollwork */}
      <path
        d="M256,20 C256,10 250,4 240,4 M256,20 C254,15 252,12 246,10 C250,14 252,18 252,24"
        stroke="#c49a5c" strokeWidth="1" opacity="0.5" strokeLinecap="round"
      />
      <path
        d="M240,4 C246,6 250,10 252,16"
        stroke="#8ab4c4" strokeWidth="0.6" opacity="0.3" strokeLinecap="round"
      />
      <circle cx="256" cy="20" r="1.5" fill="#c49a5c" opacity="0.4" />

      {/* Bottom-left corner scrollwork */}
      <path
        d="M4,380 C4,390 10,396 20,396 M4,380 C6,385 8,388 14,390 C10,386 8,382 8,376"
        stroke="#c49a5c" strokeWidth="1" opacity="0.5" strokeLinecap="round"
      />
      <path
        d="M20,396 C14,394 10,390 8,384"
        stroke="#8ab4c4" strokeWidth="0.6" opacity="0.3" strokeLinecap="round"
      />
      <circle cx="4" cy="380" r="1.5" fill="#c49a5c" opacity="0.4" />

      {/* Bottom-right corner scrollwork */}
      <path
        d="M256,380 C256,390 250,396 240,396 M256,380 C254,385 252,388 246,390 C250,386 252,382 252,376"
        stroke="#c49a5c" strokeWidth="1" opacity="0.5" strokeLinecap="round"
      />
      <path
        d="M240,396 C246,394 250,390 252,384"
        stroke="#8ab4c4" strokeWidth="0.6" opacity="0.3" strokeLinecap="round"
      />
      <circle cx="256" cy="380" r="1.5" fill="#c49a5c" opacity="0.4" />

      {/* Top edge — thin frost line with gold center accent */}
      <line x1="24" y1="2" x2="236" y2="2" stroke="#8ab4c4" strokeWidth="0.4" opacity="0.2" />
      <line x1="100" y1="2" x2="160" y2="2" stroke="#c49a5c" strokeWidth="0.6" opacity="0.25" />

      {/* Bottom edge */}
      <line x1="24" y1="398" x2="236" y2="398" stroke="#8ab4c4" strokeWidth="0.4" opacity="0.2" />
      <line x1="100" y1="398" x2="160" y2="398" stroke="#c49a5c" strokeWidth="0.6" opacity="0.25" />

      {/* Left edge — frost line */}
      <line x1="2" y1="24" x2="2" y2="376" stroke="#8ab4c4" strokeWidth="0.4" opacity="0.15" />

      {/* Right edge — frost line */}
      <line x1="258" y1="24" x2="258" y2="376" stroke="#8ab4c4" strokeWidth="0.4" opacity="0.15" />
    </svg>
  );
}

/* ===================
   Ornamental HR Data URI
   SVG for use as CSS background-image on markdown <hr> elements.
   Gold line with center diamond, frost accent dots, small curls.
   =================== */

export const ORNAMENTAL_HR_DATA_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 24' fill='none'%3E%3Cline x1='20' y1='12' x2='220' y2='12' stroke='%23c49a5c' stroke-width='0.5' opacity='0.3'/%3E%3Cpath d='M120 6 L124 12 L120 18 L116 12 Z' fill='%23c49a5c' opacity='0.5'/%3E%3Ccircle cx='108' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Ccircle cx='132' cy='12' r='1.2' fill='%238ab4c4' opacity='0.4'/%3E%3Cpath d='M108 12 C100 8 88 10 75 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Cpath d='M132 12 C140 8 152 10 165 12' stroke='%23c49a5c' stroke-width='0.8' opacity='0.35' stroke-linecap='round'/%3E%3Ccircle cx='72' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3Ccircle cx='168' cy='12' r='1' fill='%238ab4c4' opacity='0.3'/%3E%3C/svg%3E")`;
