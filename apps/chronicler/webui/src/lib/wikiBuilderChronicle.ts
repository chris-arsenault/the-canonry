/**
 * wikiBuilderChronicle — chronicle + era narrative page construction
 */

import type {
  WorldState,
  WikiPage,
  WikiSection,
  WikiSectionImage,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import type { ChronicleRecord } from "./chronicleStorage.ts";
import { getChronicleContent } from "./chronicleStorage.ts";
import type { EraNarrativeViewRecord } from "./eraNarrativeStorage.ts";
import { applyWikiLinks } from "./entityLinking.ts";
import { resolveAnchorPhrase } from "./fuzzyAnchor.ts";
import { slugify, buildLinkableNamesForBacklinks, extractLinkedEntities } from "./wikiBuilderUtils.ts";
import { resolveHistorianNotes } from "./wikiBuilderEntity.ts";

const DEBUG_WIKI_BUILDER = import.meta.env?.DEV;

export interface ChronicleImageRef {
  refId: string;
  anchorText: string;
  anchorIndex: Optional<number>;
  size: "small" | "medium" | "large" | "full-width";
  justification: Optional<"left" | "right">;
  caption: Optional<string>;
  type: "entity_ref" | "prompt_request";
  entityId: Optional<string>;
  sceneDescription: Optional<string>;
  status: Optional<"pending" | "generating" | "complete" | "failed">;
  generatedImageId: Optional<string>;
}

export interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

// --- Image attachment helpers ---

function findSectionForAnchor(sections: WikiSection[], anchorText: string): WikiSection | null {
  if (!anchorText || sections.length === 0) return sections.length > 0 ? sections[0] : null;
  for (const section of sections) {
    if (resolveAnchorPhrase(anchorText, section.content)) return section;
  }
  console.warn("[wikiBuilder] Anchor text not found in any section, using first section:", anchorText);
  return sections[0];
}

function resolveImageRefId(ref: ChronicleImageRef, worldData: WorldState): string | undefined {
  if (ref.type === "entity_ref" && ref.entityId) {
    const entity = worldData.hardState.find((e) => e.id === ref.entityId);
    const imageId = entity?.enrichment?.image?.imageId;
    if (!imageId) console.warn("[wikiBuilder] entity_ref has no image:", ref.refId, ref.entityId);
    return imageId;
  }
  if (ref.type === "prompt_request" && ref.generatedImageId) return ref.generatedImageId;
  if (ref.type === "prompt_request") console.warn("[wikiBuilder] prompt_request missing generatedImageId:", ref.refId, ref);
  return undefined;
}

function buildSectionImage(ref: ChronicleImageRef, imageId: string): WikiSectionImage {
  return {
    refId: ref.refId,
    type: ref.type === "entity_ref" ? "entity_ref" : "chronicle_image",
    entityId: ref.type === "entity_ref" ? ref.entityId : undefined,
    imageId, anchorText: ref.anchorText, anchorIndex: ref.anchorIndex,
    size: ref.size, justification: ref.justification, caption: ref.caption,
  };
}

export function attachImagesToSections(sections: WikiSection[], refs: ChronicleImageRef[], worldData: WorldState): void {
  for (const ref of refs) {
    if (ref.type === "prompt_request" && ref.status !== "complete") continue;
    const section = findSectionForAnchor(sections, ref.anchorText);
    if (!section) continue;
    const imageId = resolveImageRefId(ref, worldData);
    if (!imageId) continue;
    if (!section.images) section.images = [];
    section.images.push(buildSectionImage(ref, imageId));
  }
}

// --- Section parsing ---

function parseMarkdownSections(content: string, prefix: string, defaultHeading: string): WikiSection[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  let body = trimmed;
  if (body.startsWith("# ")) {
    const lines = body.split("\n");
    body = lines.slice(1).join("\n").trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = defaultHeading;
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join("\n").trim();
    if (!sectionBody) return;
    sections.push({ id: `${prefix}-section-${sectionIndex}`, heading: currentHeading, level: 2, content: sectionBody });
    sectionIndex++;
  };

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      currentHeading = line.replace(/^##\s+/, "").trim() || defaultHeading;
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0 && body) {
    sections.push({ id: `${prefix}-section-0`, heading: defaultHeading, level: 2, content: body });
  }
  return sections;
}

// --- Chronicle page ---

export function buildChronicleSections(
  content: string, imageRefs: Optional<ChronicleImageRefs>, worldData: Optional<WorldState>
): { sections: WikiSection[] } {
  const sections = parseMarkdownSections(content, "chronicle", "Chronicle");

  if (DEBUG_WIKI_BUILDER) {
    console.log("[wikiBuilder] buildChronicleSections:", {
      contentLength: content.length, sectionCount: sections.length,
      sectionHeadings: sections.map((s) => s.heading), imageRefsCount: imageRefs?.refs?.length ?? 0,
    });
  }

  if (imageRefs?.refs && worldData) attachImagesToSections(sections, imageRefs.refs, worldData);

  if (DEBUG_WIKI_BUILDER) {
    console.log("[wikiBuilder] After image attachment:", {
      sectionsWithImages: sections.filter((s) => s.images && s.images.length > 0).length,
      imagesPerSection: sections.map((s) => ({ heading: s.heading, imageCount: s.images?.length ?? 0 })),
    });
  }
  return { sections };
}

export function buildChroniclePageFromChronicle(
  chronicle: ChronicleRecord, worldData: WorldState,
  aliasIndex: Map<string, string>, pageNameIndex: Optional<Map<string, string>>
): WikiPage {
  const content = getChronicleContent(chronicle);
  const title = chronicle.title;
  const titleSlug = slugify(title);
  const chronicleSlug = titleSlug ? `chronicle/${titleSlug}` : "";

  const { sections } = buildChronicleSections(content, chronicle.imageRefs, worldData);
  const summary = chronicle.summary || "";

  const linkableNames = buildLinkableNamesForBacklinks(worldData, pageNameIndex);
  const linkedSections = sections.map((s) => ({ ...s, content: applyWikiLinks(s.content, linkableNames) }));
  const linkedEntities = Array.from(new Set([
    ...chronicle.selectedEntityIds,
    ...extractLinkedEntities(linkedSections, worldData, aliasIndex, pageNameIndex),
    ...(chronicle.entrypointId ? [chronicle.entrypointId] : []),
  ]));

  return {
    id: chronicle.chronicleId, slug: chronicleSlug, title, type: "chronicle",
    chronicle: {
      format: chronicle.format, entrypointId: chronicle.entrypointId,
      narrativeStyleId: chronicle.narrativeStyleId, roleAssignments: chronicle.roleAssignments,
      selectedEventIds: chronicle.selectedEventIds,
      selectedRelationshipIds: chronicle.selectedRelationshipIds,
      temporalContext: chronicle.temporalContext,
    },
    content: {
      sections, summary: summary || undefined,
      coverImageId: chronicle.coverImage?.status === "complete" && chronicle.coverImage?.generatedImageId
        ? chronicle.coverImage.generatedImageId : undefined,
      historianNotes: resolveHistorianNotes(chronicle.historianNotes),
    },
    categories: [], linkedEntities, images: [],
    lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
  };
}

export function buildChroniclePagesFromChronicles(
  chronicles: ChronicleRecord[], worldData: WorldState, aliasIndex: Map<string, string>
): WikiPage[] {
  return chronicles
    .filter((chronicle) => getChronicleContent(chronicle))
    .map((chronicle) => buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex));
}

// --- Era narrative page ---

/** Adapt era narrative image refs to chronicle ref shape */
function adaptEraNarrativeImageRefs(narrative: EraNarrativeViewRecord): ChronicleImageRef[] {
  if (!narrative.imageRefs?.refs) return [];
  return narrative.imageRefs.refs
    .map((ref) => {
      if (ref.type === "chronicle_ref" && ref.imageId) {
        return {
          refId: ref.refId, anchorText: ref.anchorText, anchorIndex: ref.anchorIndex,
          size: ref.size as ChronicleImageRef["size"], justification: ref.justification, caption: ref.caption,
          type: "prompt_request" as const, status: "complete" as const, generatedImageId: ref.imageId,
        };
      }
      if (ref.type === "prompt_request") {
        return {
          refId: ref.refId, anchorText: ref.anchorText, anchorIndex: ref.anchorIndex,
          size: ref.size as ChronicleImageRef["size"], justification: ref.justification, caption: ref.caption,
          type: "prompt_request" as const, sceneDescription: ref.sceneDescription,
          status: ref.status as ChronicleImageRef["status"], generatedImageId: ref.generatedImageId,
        };
      }
      return null;
    })
    .filter((r): r is ChronicleImageRef => r !== null);
}

export function buildEraNarrativePage(
  narrative: EraNarrativeViewRecord, worldData: WorldState,
  aliasIndex: Map<string, string>, pageNameIndex: Optional<Map<string, string>>
): WikiPage {
  const narrativeSlug = `era-narrative/${slugify(narrative.eraName)}`;
  const sections = parseMarkdownSections(narrative.content, "era-narrative", "Narrative");

  const adaptedRefs = adaptEraNarrativeImageRefs(narrative);
  if (adaptedRefs.length > 0) attachImagesToSections(sections, adaptedRefs, worldData);

  const linkableNames = buildLinkableNamesForBacklinks(worldData, pageNameIndex);
  const linkedSections = sections.map((s) => ({ ...s, content: applyWikiLinks(s.content, linkableNames) }));
  const linkedEntities = extractLinkedEntities(linkedSections, worldData, aliasIndex, pageNameIndex);
  const coverImageId = narrative.coverImage?.status === "complete" && narrative.coverImage?.generatedImageId
    ? narrative.coverImage.generatedImageId : undefined;

  return {
    id: narrative.narrativeId, slug: narrativeSlug, title: narrative.eraName, type: "era_narrative",
    eraNarrative: {
      eraId: narrative.eraId, tone: narrative.tone, thesis: narrative.thesis,
      sourceChronicleIds: narrative.sourceChronicles.map((s) => s.chronicleId),
    },
    content: { sections, summary: narrative.thesis || undefined, coverImageId },
    categories: [], linkedEntities: Array.from(new Set(linkedEntities)),
    images: [], lastUpdated: narrative.updatedAt,
  };
}
