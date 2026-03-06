/**
 * Markdown Export — bash script generators.
 *
 * Produces self-contained download scripts for S3 image assets,
 * used by both the markdown ZIP and IDML exports.
 */

import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord, ChronicleImageRef as ChrImageRef } from "../chronicleTypes";
import type { EraNarrativeRecord, EraNarrativeImageRef } from "../eraNarrativeTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { S3ExportConfig } from "./prePrintTypes";

// =============================================================================
// IDML Image Extension Helper
// =============================================================================

function idmlExt(img?: ImageMetadataRecord): string {
  if (!img?.mimeType) return ".png";
  if (img.mimeType.includes("png")) return ".png";
  if (img.mimeType.includes("jpeg") || img.mimeType.includes("jpg")) return ".jpg";
  if (img.mimeType.includes("webp")) return ".webp";
  return ".png";
}

// =============================================================================
// Image Collection Helpers
// =============================================================================

interface ScriptImageEntry {
  id: string;
  filename: string;
}

function collectEntityImages(
  entities: PersistedEntity[],
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  for (const entity of entities) {
    const imageId = entity.enrichment?.image?.imageId;
    if (imageId) addImageEntry(imageId, imageMap, seen, entries);
  }
}

function extractChronicleRefId(ref: ChrImageRef): string | undefined {
  if (ref.type === "prompt_request" && ref.status === "complete") return ref.generatedImageId;
  return undefined;
}

function collectChronicleImages(
  chronicles: ChronicleRecord[],
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  for (const chronicle of chronicles) {
    if (chronicle.coverImage?.generatedImageId && chronicle.coverImage.status === "complete") {
      addImageEntry(chronicle.coverImage.generatedImageId, imageMap, seen, entries);
    }
    collectChronicleRefImages(chronicle.imageRefs?.refs, imageMap, seen, entries);
  }
}

function collectChronicleRefImages(
  refs: ChrImageRef[] | undefined,
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  if (!refs) return;
  for (const ref of refs) {
    const id = extractChronicleRefId(ref);
    if (id) addImageEntry(id, imageMap, seen, entries);
  }
}

function extractNarrativeRefId(ref: EraNarrativeImageRef): string | undefined {
  if (ref.type === "prompt_request" && ref.status === "complete") return ref.generatedImageId;
  if (ref.type === "chronicle_ref") return ref.imageId;
  return undefined;
}

function collectNarrativeImages(
  eraNarratives: EraNarrativeRecord[],
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  for (const narrative of eraNarratives) {
    if (narrative.coverImage?.generatedImageId && narrative.coverImage?.status === "complete") {
      addImageEntry(narrative.coverImage.generatedImageId, imageMap, seen, entries);
    }
    collectNarrativeRefImages(narrative.imageRefs?.refs, imageMap, seen, entries);
  }
}

function collectNarrativeRefImages(
  refs: EraNarrativeImageRef[] | undefined,
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  if (!refs) return;
  for (const ref of refs) {
    const id = extractNarrativeRefId(ref);
    if (id) addImageEntry(id, imageMap, seen, entries);
  }
}

function addImageEntry(
  imageId: string,
  imageMap: Map<string, ImageMetadataRecord>,
  seen: Set<string>,
  entries: ScriptImageEntry[]
): void {
  if (!imageId || seen.has(imageId)) return;
  if (!imageMap.has(imageId)) return;
  seen.add(imageId);
  const ext = idmlExt(imageMap.get(imageId));
  entries.push({ id: imageId, filename: `${imageId}${ext}` });
}

// =============================================================================
// IDML Image Download Script
// =============================================================================

export interface IdmlImageScriptOptions {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  eraNarratives: EraNarrativeRecord[];
  images: ImageMetadataRecord[];
  projectId: string;
  s3Config: S3ExportConfig | null;
}

export function buildIdmlImageScript(options: IdmlImageScriptOptions): string {
  const { entities, chronicles, eraNarratives, images, projectId, s3Config } = options;
  if (!s3Config) return "";

  const imageMap = new Map(images.map((i) => [i.imageId, i]));
  const seen = new Set<string>();
  const imageEntries: ScriptImageEntry[] = [];

  collectEntityImages(entities, imageMap, seen, imageEntries);
  collectChronicleImages(chronicles, imageMap, seen, imageEntries);
  collectNarrativeImages(eraNarratives, imageMap, seen, imageEntries);

  if (imageEntries.length === 0) {
    return `#!/usr/bin/env bash
# No images referenced in this export.
echo "No images to download."
`;
  }

  const downloads = imageEntries.map((e) => `download_image "${e.id}" "${e.filename}"`).join("\n");
  return formatIdmlScript(s3Config, projectId, imageEntries.length, downloads);
}

function formatIdmlScript(
  s3Config: S3ExportConfig,
  projectId: string,
  imageCount: number,
  downloads: string
): string {
  return `#!/usr/bin/env bash
# Download images from S3 for InDesign IDML import
# Generated by Illuminator Pre-Print Export
#
# Place this script next to your .idml file, then run it.
# It creates an images/ directory alongside the IDML file
# so InDesign resolves the linked image paths automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
IMAGE_DIR="\${SCRIPT_DIR}/images"

# --- Embedded S3 Configuration ---
BUCKET="${s3Config.bucket}"
BASE_PREFIX="${s3Config.basePrefix}"
RAW_PREFIX="${s3Config.rawPrefix}"
PROJECT_ID="${projectId}"
REGION="${s3Config.region}"

# Build S3 key prefix, filtering out empty segments
S3_PREFIX=$(echo "\${BASE_PREFIX}/\${RAW_PREFIX}/\${PROJECT_ID}" | sed 's|/\\+|/|g; s|^/||; s|/$||')

# --- Pre-flight checks ---
if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI is required but not installed."
  echo "  Install: https://aws.amazon.com/cli/"
  exit 1
fi

mkdir -p "\${IMAGE_DIR}"

echo "Downloading ${imageCount} images from s3://\${BUCKET}/\${S3_PREFIX}/"
echo "Region: \${REGION}"
echo "Target: \${IMAGE_DIR}/"
echo ""

DOWNLOADED=0
SKIPPED=0
FAILED=0

download_image() {
  local IMAGE_ID="\$1"
  local FILENAME="\$2"
  local DEST="\${IMAGE_DIR}/\${FILENAME}"

  if [ -f "\${DEST}" ]; then
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  local S3_KEY="\${S3_PREFIX}/\${IMAGE_ID}"
  echo "  GET  \${FILENAME}"
  if aws s3 cp "s3://\${BUCKET}/\${S3_KEY}" "\${DEST}" --region "\${REGION}" --quiet 2>/dev/null; then
    DOWNLOADED=$((DOWNLOADED + 1))
  else
    echo "  FAIL \${FILENAME}"
    FAILED=$((FAILED + 1))
  fi
}

${downloads}

echo ""
echo "Done. Downloaded: \${DOWNLOADED}  Skipped: \${SKIPPED}  Failed: \${FAILED}"
echo "Images directory: \${IMAGE_DIR}"
`;
}

// =============================================================================
// Markdown Download Script
// =============================================================================

export function buildDownloadScript(): string {
  return `#!/usr/bin/env bash
# Download images from S3 for print preparation
# Generated by Illuminator Pre-Print Export

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="\${SCRIPT_DIR}/s3-config.json"
IMAGE_DIR="\${SCRIPT_DIR}/images"
MANIFEST_FILE="\${SCRIPT_DIR}/manifest.json"

if [ ! -f "\${CONFIG_FILE}" ]; then
  echo "ERROR: s3-config.json not found. Cannot download images."
  exit 1
fi

if [ ! -f "\${MANIFEST_FILE}" ]; then
  echo "ERROR: manifest.json not found. Cannot determine image list."
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed. Install via: brew install jq / apt install jq"
  exit 1
fi

if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI is required but not installed. See: https://aws.amazon.com/cli/"
  exit 1
fi

mkdir -p "\${IMAGE_DIR}"

BUCKET=$(jq -r '.bucket' "\${CONFIG_FILE}")
BASE_PREFIX=$(jq -r '.basePrefix' "\${CONFIG_FILE}")
RAW_PREFIX=$(jq -r '.rawPrefix' "\${CONFIG_FILE}")
PROJECT_ID=$(jq -r '.projectId' "\${CONFIG_FILE}")
REGION=$(jq -r '.region' "\${CONFIG_FILE}")

# Build S3 key prefix, filtering out empty segments
S3_PREFIX=$(echo "\${BASE_PREFIX}/\${RAW_PREFIX}/\${PROJECT_ID}" | sed 's|/\\+|/|g; s|^/||; s|/$||')

echo "Downloading images from s3://\${BUCKET}/\${S3_PREFIX}/"
echo "Region: \${REGION}"

TOTAL=0
SKIPPED=0
DOWNLOADED=0

jq -r '.images | keys[]' "\${MANIFEST_FILE}" | while read -r IMAGE_ID; do
  TOTAL=$((TOTAL + 1))
  DEST="\${IMAGE_DIR}/\${IMAGE_ID}"

  # Check for any existing file with this ID (may have extension appended)
  if ls "\${DEST}"* &>/dev/null 2>&1; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  S3_KEY="\${S3_PREFIX}/\${IMAGE_ID}"
  echo "  GET  \${IMAGE_ID}"
  aws s3 cp "s3://\${BUCKET}/\${S3_KEY}" "\${DEST}" --region "\${REGION}" --quiet || {
    echo "  FAIL \${IMAGE_ID}"
    continue
  }
  DOWNLOADED=$((DOWNLOADED + 1))
done

echo ""
echo "Done. $(ls -1 "\${IMAGE_DIR}" 2>/dev/null | wc -l | tr -d ' ') images in \${IMAGE_DIR}"
`;
}
