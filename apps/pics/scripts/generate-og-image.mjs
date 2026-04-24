/**
 * Generate OG image (1200x630) for social media sharing.
 * Uses sharp to composite text onto a dark gradient background.
 *
 * Run: node apps/pics/scripts/generate-og-image.mjs
 */

import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "../webui/public/og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;

// Build SVG overlay with title text and subtle ice-crystal decoration
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a14"/>
      <stop offset="50%" style="stop-color:#0d1520"/>
      <stop offset="100%" style="stop-color:#0a0a0f"/>
    </linearGradient>
    <linearGradient id="ice" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#b8d4e3"/>
      <stop offset="100%" style="stop-color:#4a7c9b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#4a7c9b;stop-opacity:0"/>
      <stop offset="50%" style="stop-color:#b8d4e3;stop-opacity:0.6"/>
      <stop offset="100%" style="stop-color:#4a7c9b;stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Decorative ice crystal (top-right, large, faint) -->
  <g transform="translate(900, 120) scale(3)" opacity="0.08">
    <polygon points="16,2 27.5,8.5 27.5,23.5 16,30 4.5,23.5 4.5,8.5"
      fill="none" stroke="url(#ice)" stroke-width="1.5"/>
    <line x1="16" y1="2" x2="16" y2="30" stroke="url(#ice)" stroke-width="0.8"/>
    <line x1="4.5" y1="8.5" x2="27.5" y2="23.5" stroke="url(#ice)" stroke-width="0.8"/>
    <line x1="27.5" y1="8.5" x2="4.5" y2="23.5" stroke="url(#ice)" stroke-width="0.8"/>
    <polygon points="16,10 22,16 16,22 10,16" fill="url(#ice)" opacity="0.3"/>
    <polygon points="16,10 22,16 16,22 10,16" fill="none" stroke="url(#ice)" stroke-width="1.2"/>
  </g>

  <!-- Decorative ice crystal (bottom-left, smaller, faint) -->
  <g transform="translate(80, 380) scale(2)" opacity="0.06">
    <polygon points="16,2 27.5,8.5 27.5,23.5 16,30 4.5,23.5 4.5,8.5"
      fill="none" stroke="url(#ice)" stroke-width="1.5"/>
    <line x1="16" y1="2" x2="16" y2="30" stroke="url(#ice)" stroke-width="0.8"/>
    <line x1="4.5" y1="8.5" x2="27.5" y2="23.5" stroke="url(#ice)" stroke-width="0.8"/>
    <line x1="27.5" y1="8.5" x2="4.5" y2="23.5" stroke="url(#ice)" stroke-width="0.8"/>
    <polygon points="16,10 22,16 16,22 10,16" fill="none" stroke="url(#ice)" stroke-width="1.2"/>
  </g>

  <!-- Accent line -->
  <rect x="100" y="340" width="400" height="1" fill="url(#accent)"/>

  <!-- Title -->
  <text x="120" y="290" font-family="serif" font-size="64" font-weight="400"
    fill="#e0ddd6" letter-spacing="0.02em">The Ice Remembers</text>

  <!-- Subtitle -->
  <text x="122" y="370" font-family="sans-serif" font-size="22" font-weight="300"
    fill="#e0ddd6" opacity="0.45" letter-spacing="0.08em">GALLERY</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUTPUT);
console.log(`OG image written to ${OUTPUT}`);
