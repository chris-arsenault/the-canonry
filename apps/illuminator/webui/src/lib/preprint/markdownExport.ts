/**
 * Markdown Export
 *
 * Builds a ZIP file from the content tree containing:
 * - Markdown files for each content item (entity, chronicle, static page)
 * - manifest.json with full metadata
 * - s3-config.json and download-images.sh (when S3 configured)
 */

import JSZip from "jszip";
import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord, ChronicleImageRef } from "../chronicleTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { StaticPage } from "../staticPageTypes";
import type { EraNarrativeRecord } from "../eraNarrativeTypes";
import type { HistorianNote } from "../historianTypes";
import { isNoteActive, noteDisplay } from "../historianTypes";
import { resolveAnchorPhrase } from "../fuzzyAnchor";
import { resolveActiveContent } from "../db/eraNarrativeRepository";
import type {
  ContentTreeState,
  ContentTreeNode,
  ExportManifest,
  ExportImageEntry,
  S3ExportConfig,
  IdmlLayoutOptions,
} from "./prePrintTypes";
import { flattenForExport } from "./contentTree";
import { countWords } from "../db/staticPageRepository";
import { buildIdmlPackage } from "./idmlExport";

// =============================================================================
// Public API
// =============================================================================

export interface ExportOptions {
  treeState: ContentTreeState;
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  images: ImageMetadataRecord[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrativeRecord[];
  projectId: string;
  simulationRunId: string;
  s3Config: S3ExportConfig | null;
  idmlLayout?: IdmlLayoutOptions;
}

export async function buildExportZip(options: ExportOptions): Promise<Blob> {
  const {
    treeState,
    entities,
    chronicles,
    images,
    staticPages,
    eraNarratives,
    projectId,
    simulationRunId,
    s3Config,
  } = options;

  const zip = new JSZip();
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const chronicleMap = new Map(chronicles.map((c) => [c.chronicleId, c]));
  const pageMap = new Map(staticPages.map((p) => [p.pageId, p]));
  const narrativeMap = new Map(eraNarratives.map((n) => [n.narrativeId, n]));
  const imageMap = new Map(images.map((i) => [i.imageId, i]));

  // Collect all referenced image IDs for the manifest
  const referencedImages = new Map<string, ExportImageEntry>();

  // Flatten tree and generate files
  const flattened = flattenForExport(treeState);

  for (const { path, node } of flattened) {
    if (node.type === "folder") {
      // Create empty directory entry
      zip.folder(path);
      continue;
    }

    if (!node.contentId) continue;

    let markdown: string | null = null;

    if (node.type === "entity") {
      const entity = entityMap.get(node.contentId);
      if (entity) {
        markdown = formatEntityMarkdown(entity, referencedImages, imageMap);
      }
    } else if (node.type === "chronicle") {
      const chronicle = chronicleMap.get(node.contentId);
      if (chronicle) {
        markdown = formatChronicleMarkdown(chronicle, referencedImages, imageMap);
      }
    } else if (node.type === "static_page") {
      const page = pageMap.get(node.contentId);
      if (page) {
        markdown = formatStaticPageMarkdown(page, entities);
      }
    } else if (node.type === "era_narrative") {
      const narrative = narrativeMap.get(node.contentId);
      if (narrative) {
        markdown = formatEraNarrativeMarkdown(narrative, referencedImages, imageMap);
      }
    }

    if (markdown) {
      const filename = slugify(node.name) + ".md";
      zip.file(`${path}/${filename}`, markdown);
    }
  }

  // Build manifest
  const manifest = buildManifest(
    treeState,
    entities,
    chronicles,
    staticPages,
    eraNarratives,
    images,
    referencedImages,
    projectId,
    simulationRunId,
    s3Config
  );
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // S3 download script
  if (s3Config) {
    zip.file(
      "s3-config.json",
      JSON.stringify(
        {
          bucket: s3Config.bucket,
          basePrefix: s3Config.basePrefix,
          rawPrefix: s3Config.rawPrefix,
          projectId,
          region: s3Config.region,
        },
        null,
        2
      )
    );

    zip.file("download-images.sh", buildDownloadScript());
  }

  return zip.generateAsync({ type: "blob" });
}

export async function buildInDesignExportZip(options: ExportOptions): Promise<Blob> {
  const { treeState, entities, chronicles, images, staticPages, eraNarratives, idmlLayout } =
    options;

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const chronicleMap = new Map(chronicles.map((c) => [c.chronicleId, c]));
  const pageMap = new Map(staticPages.map((p) => [p.pageId, p]));
  const narrativeMap = new Map(eraNarratives.map((n) => [n.narrativeId, n]));
  const imageMap = new Map(images.map((i) => [i.imageId, i]));
  const referencedImages = new Map<string, ExportImageEntry>();

  // Build a complete IDML package — opens directly in InDesign.
  // IDML is already a ZIP internally, so we return the blob directly
  // rather than wrapping it in another ZIP.
  return buildIdmlPackage(
    treeState,
    { entityMap, chronicleMap, pageMap, narrativeMap },
    imageMap,
    referencedImages,
    idmlLayout
  );
}

// =============================================================================
// Markdown Formatters
// =============================================================================

function formatEntityMarkdown(
  entity: PersistedEntity,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const lines: string[] = [];

  // Frontmatter
  const imageId = entity.enrichment?.image?.imageId;
  lines.push("---");
  lines.push(`title: ${yamlString(entity.name)}`);
  lines.push("type: entity");
  lines.push(`entity_kind: ${entity.kind}`);
  if (entity.subtype) lines.push(`entity_subtype: ${entity.subtype}`);
  if (entity.culture) lines.push(`culture: ${entity.culture}`);
  lines.push(`status: ${entity.status}`);
  lines.push(`prominence: ${entity.prominence}`);
  lines.push(`word_count: ${countWords(entity.description || "")}`);
  lines.push(`has_image: ${!!imageId}`);
  if (imageId) lines.push(`image_id: ${imageId}`);

  const aliases = entity.enrichment?.text?.aliases;
  if (aliases?.length) {
    lines.push("aliases:");
    for (const a of aliases) lines.push(`  - ${yamlString(a)}`);
  }

  if (entity.tags && Object.keys(entity.tags).length > 0) {
    lines.push("tags:");
    for (const [k, v] of Object.entries(entity.tags)) {
      lines.push(`  ${k}: ${yamlString(String(v))}`);
    }
  }
  lines.push("---");
  lines.push("");

  // Title and summary
  lines.push(`# ${entity.name}`);
  lines.push("");
  if (entity.summary) {
    lines.push(`*${entity.summary}*`);
    lines.push("");
  }

  // Description
  if (entity.description) {
    lines.push(entity.description);
    lines.push("");
  }

  // Entity image
  if (imageId) {
    registerImage(referencedImages, imageId, imageMap, "entity", entity.id, entity.name);
    const ext = getImageExt(imageMap.get(imageId));
    lines.push(`![${entity.name} portrait](images/${imageId}${ext})`);
    lines.push("");
  }

  // Historian notes
  const notes = entity.enrichment?.historianNotes?.filter((n) => isNoteActive(n));
  if (notes?.length) {
    const fullNotes = notes.filter((n) => noteDisplay(n) === "full");
    const popoutNotes = notes.filter((n) => noteDisplay(n) === "popout");

    if (fullNotes.length > 0) {
      lines.push("## Historian's Notes");
      lines.push("");
      for (const note of fullNotes) {
        lines.push(formatHistorianNote(note));
      }
      lines.push("");
    }

    if (popoutNotes.length > 0) {
      if (fullNotes.length === 0) {
        lines.push("## Historian's Notes");
        lines.push("");
      }
      for (const note of popoutNotes) {
        lines.push(formatHistorianFootnote(note));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatChronicleMarkdown(
  chronicle: ChronicleRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const lines: string[] = [];
  const content = chronicle.finalContent || chronicle.assembledContent || "";

  // Frontmatter
  const sceneCount =
    chronicle.imageRefs?.refs?.filter((r) => r.type === "prompt_request" && r.status === "complete")
      .length || 0;
  const coverImageId = chronicle.coverImage?.generatedImageId;

  lines.push("---");
  lines.push(`title: ${yamlString(chronicle.title)}`);
  lines.push("type: chronicle");
  lines.push(`format: ${chronicle.format}`);
  if (chronicle.narrativeStyle?.name) {
    lines.push(`narrative_style: ${yamlString(chronicle.narrativeStyle.name)}`);
  }
  lines.push(`focus_type: ${chronicle.focusType}`);
  lines.push(`word_count: ${countWords(content)}`);
  lines.push(`has_cover_image: ${!!coverImageId}`);
  if (coverImageId) lines.push(`cover_image_id: ${coverImageId}`);
  lines.push(`scene_image_count: ${sceneCount}`);
  lines.push("---");
  lines.push("");

  // Title and summary
  lines.push(`# ${chronicle.title}`);
  lines.push("");
  if (chronicle.summary) {
    lines.push(`*${chronicle.summary}*`);
    lines.push("");
  }

  // Cast table
  if (chronicle.roleAssignments?.length) {
    lines.push("## Cast");
    lines.push("");
    lines.push("| Role | Character | Kind | Emphasis |");
    lines.push("|------|-----------|------|----------|");
    for (const ra of chronicle.roleAssignments) {
      lines.push(
        `| ${ra.role} | ${ra.entityName} | ${ra.entityKind} | ${ra.isPrimary ? "Primary" : "Supporting"} |`
      );
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Cover image
  if (coverImageId && chronicle.coverImage?.status === "complete") {
    registerImage(
      referencedImages,
      coverImageId,
      imageMap,
      "cover",
      undefined,
      undefined,
      chronicle.chronicleId
    );
    const ext = getImageExt(imageMap.get(coverImageId));
    lines.push(`![Cover](images/${coverImageId}${ext})`);
    lines.push("");
  }

  // Full narrative with inline image markers
  if (content) {
    let annotatedContent = content;

    // Insert image markers at anchor points
    if (chronicle.imageRefs?.refs) {
      const promptRefs = chronicle.imageRefs.refs.filter(
        (r): r is Extract<ChronicleImageRef, { type: "prompt_request" }> =>
          r.type === "prompt_request" && r.status === "complete" && !!r.generatedImageId
      );

      const promptInsertions = promptRefs
        .map((ref) => ({
          ref,
          insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        }))
        .sort((a, b) => b.insertAt - a.insertAt);

      for (const { ref, insertAt } of promptInsertions) {
        const imgId = ref.generatedImageId!;
        registerImage(
          referencedImages,
          imgId,
          imageMap,
          "chronicle",
          undefined,
          undefined,
          chronicle.chronicleId
        );
        const ext = getImageExt(imageMap.get(imgId));
        const caption = ref.caption || "";
        const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
        annotatedContent =
          annotatedContent.slice(0, insertAt) + marker + annotatedContent.slice(insertAt);
      }

      // Entity ref images
      const entityRefs = chronicle.imageRefs.refs.filter(
        (r): r is Extract<ChronicleImageRef, { type: "entity_ref" }> => r.type === "entity_ref"
      );
      const entityInsertions = entityRefs
        .map((ref) => ({
          ref,
          insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        }))
        .sort((a, b) => b.insertAt - a.insertAt);

      for (const { ref, insertAt } of entityInsertions) {
        // Entity portraits are registered via entity pages; just add comment markers
        const caption = ref.caption || "";
        const marker = `\n\n<!-- IMAGE: entity-portrait-${ref.entityId} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
        annotatedContent =
          annotatedContent.slice(0, insertAt) + marker + annotatedContent.slice(insertAt);
      }
    }

    lines.push(annotatedContent);
    lines.push("");
  }

  // Historian notes
  const chronicleNotes = chronicle.historianNotes?.filter((n) => isNoteActive(n));
  if (chronicleNotes?.length) {
    const fullNotes = chronicleNotes.filter((n) => noteDisplay(n) === "full");
    const popoutNotes = chronicleNotes.filter((n) => noteDisplay(n) === "popout");

    if (fullNotes.length > 0) {
      lines.push("## Historian's Notes");
      lines.push("");
      for (const note of fullNotes) {
        lines.push(formatHistorianNote(note));
      }
      lines.push("");
    }

    if (popoutNotes.length > 0) {
      if (fullNotes.length === 0) {
        lines.push("## Historian's Notes");
        lines.push("");
      }
      for (const note of popoutNotes) {
        lines.push(formatHistorianFootnote(note));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function resolveInsertPosition(text: string, anchorText: string, anchorIndex?: number): number {
  const resolved = anchorText ? resolveAnchorPhrase(anchorText, text) : null;
  let position = resolved ? resolved.index : -1;
  if (position < 0 && anchorIndex !== undefined && anchorIndex < text.length) {
    position = anchorIndex;
  }
  if (position < 0) position = text.length;

  const anchorLength = anchorText?.length ?? 0;
  const anchorEnd = position + anchorLength;
  const paragraphEnd = text.indexOf("\n\n", anchorEnd);
  return paragraphEnd >= 0 ? paragraphEnd : text.length;
}

function formatStaticPageMarkdown(page: StaticPage, entities: PersistedEntity[]): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  lines.push(`title: ${yamlString(page.title)}`);
  lines.push("type: static_page");
  lines.push(`word_count: ${page.wordCount}`);

  if (page.linkedEntityIds?.length) {
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    lines.push("linked_entities:");
    for (const id of page.linkedEntityIds) {
      const name = entityMap.get(id)?.name || id;
      lines.push(`  - ${yamlString(name)}`);
    }
  }
  lines.push("---");
  lines.push("");

  // Content as-is (already markdown)
  lines.push(page.content || "");
  lines.push("");

  return lines.join("\n");
}

function formatEraNarrativeMarkdown(
  narrative: EraNarrativeRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const lines: string[] = [];
  const { content } = resolveActiveContent(narrative);

  // Frontmatter
  const coverImageId = narrative.coverImage?.generatedImageId;
  lines.push("---");
  lines.push(`title: ${yamlString(narrative.eraName)}`);
  lines.push("type: era_narrative");
  lines.push(`era_id: ${narrative.eraId}`);
  lines.push(`tone: ${narrative.tone}`);
  lines.push(`status: ${narrative.status}`);
  lines.push(`word_count: ${countWords(content || "")}`);
  lines.push(`has_cover_image: ${!!coverImageId && narrative.coverImage?.status === "complete"}`);
  if (coverImageId) lines.push(`cover_image_id: ${coverImageId}`);

  if (narrative.threadSynthesis?.thesis) {
    lines.push(`thesis: ${yamlString(narrative.threadSynthesis.thesis)}`);
  }

  if (narrative.threadSynthesis?.threads?.length) {
    lines.push("threads:");
    for (const t of narrative.threadSynthesis.threads) {
      lines.push(`  - ${yamlString(t.name)}`);
    }
  }
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${narrative.eraName}`);
  lines.push("");

  // Thesis as epigraph
  if (narrative.threadSynthesis?.thesis) {
    lines.push(`*${narrative.threadSynthesis.thesis}*`);
    lines.push("");
  }

  // Cover image
  if (coverImageId && narrative.coverImage?.status === "complete") {
    registerImage(referencedImages, coverImageId, imageMap, "cover");
    const ext = getImageExt(imageMap.get(coverImageId));
    lines.push(`![Cover](images/${coverImageId}${ext})`);
    lines.push("");
  }

  // Narrative content with inline image markers
  if (content) {
    let annotatedContent = content;

    if (narrative.imageRefs?.refs) {
      const insertableRefs = narrative.imageRefs.refs.filter((r) => {
        if (r.type === "chronicle_ref") return true;
        if (r.type === "prompt_request" && r.status === "complete" && r.generatedImageId)
          return true;
        return false;
      });

      const insertions = insertableRefs
        .map((ref) => ({
          ref,
          insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        }))
        .sort((a, b) => b.insertAt - a.insertAt);

      for (const { ref, insertAt } of insertions) {
        const imgId = ref.type === "chronicle_ref" ? ref.imageId : (ref as any).generatedImageId!;
        registerImage(referencedImages, imgId, imageMap, "chronicle");
        const ext = getImageExt(imageMap.get(imgId));
        const caption = ref.caption || "";
        const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
        annotatedContent =
          annotatedContent.slice(0, insertAt) + marker + annotatedContent.slice(insertAt);
      }
    }

    lines.push(annotatedContent);
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// Historian Notes
// =============================================================================

function formatHistorianNote(note: HistorianNote): string {
  const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
  return `> **[${typeLabel}]** ${note.text} *(anchored to: "${note.anchorPhrase}")*\n`;
}

function formatHistorianFootnote(note: HistorianNote): string {
  const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
  return `- *[${typeLabel}]* ${note.text} — "${note.anchorPhrase}"\n`;
}

// =============================================================================
// Manifest
// =============================================================================

function buildManifest(
  treeState: ContentTreeState,
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  staticPages: StaticPage[],
  eraNarratives: EraNarrativeRecord[],
  images: ImageMetadataRecord[],
  referencedImages: Map<string, ExportImageEntry>,
  projectId: string,
  simulationRunId: string,
  s3Config: S3ExportConfig | null
): ExportManifest {
  const publishedChronicles = chronicles.filter(
    (c) => c.status === "complete" || c.status === "assembly_ready"
  );
  const publishedPages = staticPages.filter((p) => p.status === "published");
  const completedNarratives = eraNarratives.filter(
    (n) => n.status === "complete" || n.status === "step_complete"
  );

  const allHistorianNotes =
    entities.reduce((n, e) => n + (e.enrichment?.historianNotes?.length || 0), 0) +
    publishedChronicles.reduce((n, c) => n + (c.historianNotes?.length || 0), 0);

  const narrativeWords = completedNarratives.reduce((s, n) => {
    const { content } = resolveActiveContent(n);
    return s + countWords(content || "");
  }, 0);

  const totalWords =
    publishedChronicles.reduce(
      (s, c) => s + countWords(c.finalContent || c.assembledContent || ""),
      0
    ) +
    entities.reduce(
      (s, e) => s + countWords(e.description || "") + countWords(e.summary || ""),
      0
    ) +
    publishedPages.reduce((s, p) => s + p.wordCount, 0) +
    narrativeWords;

  const manifest: ExportManifest = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    projectId,
    simulationRunId,
    stats: {
      totalWordCount: totalWords,
      estimatedPages: Math.ceil(totalWords / 250),
      entityCount: entities.length,
      chronicleCount: publishedChronicles.length,
      staticPageCount: publishedPages.length,
      eraNarrativeCount: completedNarratives.length,
      imageCount: referencedImages.size,
      historianNoteCount: allHistorianNotes,
    },
    tree: treeState.nodes,
    images: Object.fromEntries(referencedImages),
  };

  if (s3Config) {
    manifest.s3 = {
      bucket: s3Config.bucket,
      basePrefix: s3Config.basePrefix,
      rawPrefix: s3Config.rawPrefix,
      projectId,
      region: s3Config.region,
    };
  }

  return manifest;
}

// =============================================================================
// IDML Image Download Script
// =============================================================================

/**
 * Generates a self-contained bash script that downloads all images referenced
 * by the IDML export from S3. The script embeds the S3 config and image list
 * directly — no manifest.json or s3-config.json needed.
 *
 * Place the script next to the .idml file and run it. It creates images/
 * alongside the IDML so InDesign resolves the `file:images/...` links.
 */
export function buildIdmlImageScript(options: ExportOptions): string {
  const { entities, chronicles, eraNarratives, images, projectId, s3Config } = options;
  if (!s3Config) return "";

  const imageMap = new Map(images.map((i) => [i.imageId, i]));
  const seen = new Set<string>();
  const imageEntries: { id: string; filename: string }[] = [];

  // Match the extension logic used by idmlExport's collectEntryImages
  // (defaults to .png when mimeType is unknown)
  function idmlExt(img?: ImageMetadataRecord): string {
    if (!img?.mimeType) return ".png";
    if (img.mimeType.includes("png")) return ".png";
    if (img.mimeType.includes("jpeg") || img.mimeType.includes("jpg")) return ".jpg";
    if (img.mimeType.includes("webp")) return ".webp";
    return ".png";
  }

  function addImage(imageId: string) {
    if (!imageId || seen.has(imageId)) return;
    // Skip image IDs not present in metadata — they are likely malformed
    // composite keys (e.g. chronicleId:imageRefId) that won't exist in S3
    if (!imageMap.has(imageId)) return;
    seen.add(imageId);
    const ext = idmlExt(imageMap.get(imageId));
    imageEntries.push({ id: imageId, filename: `${imageId}${ext}` });
  }

  // Entity portraits
  for (const entity of entities) {
    const imageId = entity.enrichment?.image?.imageId;
    if (imageId) addImage(imageId);
  }

  // Chronicle covers and scene images
  for (const chronicle of chronicles) {
    if (chronicle.coverImage?.generatedImageId && chronicle.coverImage.status === "complete") {
      addImage(chronicle.coverImage.generatedImageId);
    }
    if (chronicle.imageRefs?.refs) {
      for (const ref of chronicle.imageRefs.refs) {
        if (ref.type === "prompt_request" && ref.status === "complete" && ref.generatedImageId) {
          addImage(ref.generatedImageId);
        }
      }
    }
  }

  // Era narrative covers and inline refs
  for (const narrative of eraNarratives) {
    if (narrative.coverImage?.generatedImageId && narrative.coverImage?.status === "complete") {
      addImage(narrative.coverImage.generatedImageId);
    }
    if (narrative.imageRefs?.refs) {
      for (const ref of narrative.imageRefs.refs) {
        if (ref.type === "prompt_request" && ref.status === "complete" && ref.generatedImageId) {
          addImage(ref.generatedImageId);
        }
        if (ref.type === "chronicle_ref" && ref.imageId) {
          addImage(ref.imageId);
        }
      }
    }
  }

  if (imageEntries.length === 0) {
    return `#!/usr/bin/env bash
# No images referenced in this export.
echo "No images to download."
`;
  }

  const downloads = imageEntries.map((e) => `download_image "${e.id}" "${e.filename}"`).join("\n");

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

echo "Downloading ${imageEntries.length} images from s3://\${BUCKET}/\${S3_PREFIX}/"
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

function buildDownloadScript(): string {
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

// =============================================================================
// Helpers
// =============================================================================

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

function yamlString(value: string): string {
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function getImageExt(image?: ImageMetadataRecord): string {
  if (!image?.mimeType) return "";
  if (image.mimeType.includes("png")) return ".png";
  if (image.mimeType.includes("jpeg") || image.mimeType.includes("jpg")) return ".jpg";
  if (image.mimeType.includes("webp")) return ".webp";
  return "";
}

function registerImage(
  map: Map<string, ExportImageEntry>,
  imageId: string,
  imageMap: Map<string, ImageMetadataRecord>,
  type: "entity" | "chronicle" | "cover",
  entityId?: string,
  entityName?: string,
  chronicleId?: string
): void {
  if (map.has(imageId)) return;
  const img = imageMap.get(imageId);
  // Skip image IDs not present in metadata — malformed composite keys won't exist in S3
  if (!img) return;
  const ext = getImageExt(img);
  map.set(imageId, {
    imageId,
    filename: `${imageId}${ext}`,
    width: img?.width,
    height: img?.height,
    aspect: img?.aspect,
    imageType: type,
    entityId: entityId || img?.entityId,
    entityName: entityName || img?.entityName,
    chronicleId: chronicleId || img?.chronicleId,
    mimeType: img?.mimeType,
  });
}
