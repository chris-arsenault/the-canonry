/**
 * wikiBuilderChronicle — chronicle + era narrative page construction
 *
 * Uses @the-canonry/chronicle-renderer for the shared rendering pipeline
 * (section parsing, image attachment, historian notes). This file adds
 * chronicler-specific concerns: wiki linking, slug generation, page assembly.
 */

import type {
  WorldState,
  WikiPage,
  WikiSection,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import type { ChronicleRecord } from "./chronicleStorage.ts";
import { getChronicleContent } from "./chronicleStorage.ts";
import type { EraNarrativeViewRecord } from "./eraNarrativeStorage.ts";
import {
  buildChronicleRender,
  attachImagesToSections,
  resolveHistorianNotes,
  type ChronicleImageRef,
} from "@the-canonry/chronicle-renderer";
import { applyWikiLinks } from "./entityLinking.ts";
import { slugify, buildLinkableNamesForBacklinks, extractLinkedEntities } from "./wikiBuilderUtils.ts";

export type { ChronicleImageRef };

export interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

// ── Chronicle page ───────────────────────────────────────────────────────────

export function buildChronicleSections(
  content: string,
  imageRefs: Optional<ChronicleImageRefs>,
  worldData: Optional<WorldState>
): { sections: WikiSection[] } {
  const render = buildChronicleRender({
    content,
    imageRefs: imageRefs as { refs: ChronicleImageRef[] } | null,
    entities: worldData?.hardState ?? [],
  });
  return { sections: render.sections as WikiSection[] };
}

export function buildChroniclePageFromChronicle(
  chronicle: ChronicleRecord, worldData: WorldState,
  aliasIndex: Map<string, string>, pageNameIndex: Optional<Map<string, string>>
): WikiPage {
  const content = getChronicleContent(chronicle);
  const title = chronicle.title;
  const titleSlug = slugify(title);
  const chronicleSlug = titleSlug ? `chronicle/${titleSlug}` : "";

  const render = buildChronicleRender({
    content,
    imageRefs: chronicle.imageRefs as { refs: ChronicleImageRef[] } | null,
    entities: worldData.hardState,
    historianNotes: chronicle.historianNotes,
    coverImageId: chronicle.coverImage?.status === "complete" ? chronicle.coverImage?.generatedImageId : null,
  });

  const { sections, historianNotes, coverImageId } = render;
  const summary = chronicle.summary || "";

  // Wiki-link the sections (chronicler-specific)
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
      sections: sections as WikiSection[],
      summary: summary || undefined,
      coverImageId,
      historianNotes,
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

// ── Era narrative page ───────────────────────────────────────────────────────

/** Adapt era narrative image refs to the shared ChronicleImageRef shape */
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

  const render = buildChronicleRender({
    content: narrative.content,
    imageRefs: { refs: adaptEraNarrativeImageRefs(narrative) },
    entities: worldData.hardState,
    coverImageId: narrative.coverImage?.status === "complete" ? narrative.coverImage?.generatedImageId : null,
  });

  const { sections, coverImageId } = render;

  const linkableNames = buildLinkableNamesForBacklinks(worldData, pageNameIndex);
  const linkedSections = sections.map((s) => ({ ...s, content: applyWikiLinks(s.content, linkableNames) }));
  const linkedEntities = extractLinkedEntities(linkedSections, worldData, aliasIndex, pageNameIndex);

  return {
    id: narrative.narrativeId, slug: narrativeSlug, title: narrative.eraName, type: "era_narrative",
    eraNarrative: {
      eraId: narrative.eraId, tone: narrative.tone, thesis: narrative.thesis,
      sourceChronicleIds: narrative.sourceChronicles.map((s) => s.chronicleId),
    },
    content: { sections: sections as WikiSection[], summary: narrative.thesis || undefined, coverImageId },
    categories: [], linkedEntities: Array.from(new Set(linkedEntities)),
    images: [], lastUpdated: narrative.updatedAt,
  };
}
