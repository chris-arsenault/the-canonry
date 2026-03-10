#!/usr/bin/env node
/**
 * inject-catalog.mjs — Inject first N catalog entries into dist/index.html.
 *
 * Reads the full catalog.json built by Illuminator and injects a subset
 * (first 50 images + all facets) into the built HTML as an inline JSON
 * script tag. This eliminates the network round-trip for initial render.
 *
 * Usage: node inject-catalog.mjs <catalog.json> [dist/index.html]
 */

import { readFileSync, writeFileSync } from "fs";

const INLINE_COUNT = 50;

const catalogPath = process.argv[2];
const htmlPath = process.argv[3] || "dist/index.html";

if (!catalogPath) {
  console.error("Usage: node inject-catalog.mjs <catalog.json> [dist/index.html]");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

const head = {
  version: catalog.version,
  generatedAt: catalog.generatedAt,
  baseUrl: catalog.baseUrl,
  images: catalog.images.slice(0, INLINE_COUNT),
  facets: catalog.facets,
};

const headJson = JSON.stringify(head);
const scriptTag = `<script type="application/json" id="initial-catalog">${headJson}</script>`;

const html = readFileSync(htmlPath, "utf-8");
const injected = html.replace("</head>", `  ${scriptTag}\n  </head>`);
writeFileSync(htmlPath, injected);

const sizeKB = (headJson.length / 1024).toFixed(1);
console.log(`Injected ${head.images.length} of ${catalog.images.length} images into ${htmlPath} (${sizeKB}KB)`);
