#!/usr/bin/env node
/**
 * extract-og-metadata.mjs — Build OG route metadata from catalog.json.
 *
 * Reads the full image catalog and produces og-metadata.json mapping
 * each route slug to its OG tags. The Lambda reads this file from S3
 * to stamp per-route OG tags into the HTML shell.
 *
 * Usage: node extract-og-metadata.mjs <catalog.json> [dist/og-metadata.json]
 */

import { readFileSync, writeFileSync } from "fs";

const catalogPath = process.argv[2];
const outputPath = process.argv[3] || "dist/og-metadata.json";

if (!catalogPath) {
  console.error("Usage: node extract-og-metadata.mjs <catalog.json> [dist/og-metadata.json]");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

// Build facet id→name lookup for human-readable descriptions
const facetNames = new Map();
for (const list of Object.values(catalog.facets)) {
  for (const entry of list) {
    if (typeof entry === "string") {
      facetNames.set(entry, entry);
    } else if (entry && entry.id) {
      facetNames.set(entry.id, entry.name);
    }
  }
}

function facetName(id) {
  return facetNames.get(id) || id;
}

function buildDescription(img) {
  const parts = [];
  if (img.imageType === "entity" && img.entityName) {
    parts.push(`${img.entityName}`);
    if (img.entityKind) parts.push(`a ${img.entityKind}`);
    if (img.entityCulture) parts.push(`of ${facetName(img.entityCulture)} culture`);
  }
  const style = facetName(img.artisticStyleId);
  const composition = facetName(img.compositionStyleId);
  const palette = facetName(img.colorPaletteId);
  if (parts.length > 0) {
    parts.push(`— ${style}, ${composition}, ${palette}`);
  } else {
    parts.push(style, composition, palette);
  }
  return parts.join(" ");
}

function imageUrl(img) {
  return `${catalog.baseUrl}/${img.fullPath}`;
}

const routes = {};

for (const img of catalog.images) {
  routes[`img/${img.imageId}`] = {
    title: img.title,
    description: buildDescription(img),
    image: imageUrl(img),
    imageWidth: img.width,
    imageHeight: img.height,
    imageAlt: img.title,
    type: "article",
  };
}

routes["about"] = {
  title: "About & AI Disclosure",
  description: "About the AI-generated art gallery for The Ice Remembers.",
  image: null,
  imageWidth: null,
  imageHeight: null,
  imageAlt: null,
  type: "website",
};

const metadata = {
  siteName: "The Ice Remembers — Gallery",
  defaultImage: "https://pics.theiceremembers.com/og-image.png",
  locale: "en_US",
  themeColor: "#0a0a0f",
  routes,
};

writeFileSync(outputPath, JSON.stringify(metadata));
const sizeKB = (Buffer.byteLength(JSON.stringify(metadata)) / 1024).toFixed(1);
console.log(`OG metadata: ${Object.keys(routes).length} routes (${sizeKB} KB) → ${outputPath}`);
