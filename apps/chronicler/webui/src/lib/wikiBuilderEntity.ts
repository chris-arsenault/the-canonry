/**
 * wikiBuilderEntity — entity page construction
 */

import type {
  WorldState,
  WikiPage,
  WikiSection,
  WikiInfobox,
  HardState,
  LoreRecord,
} from "../types/world.ts";
import type { ChronicleRecord } from "./chronicleStorage.ts";
import { prominenceLabelFromScale, type ProminenceScale } from "@canonry/world-schema";
import { slugify, getEntityAliases, extractLinkedEntities, findRegionById, type ImageInfo } from "./wikiBuilderUtils.ts";

function appendLoreSections(
  sections: WikiSection[], sectionIndex: { value: number },
  loreRecord: LoreRecord, fallbackHeading: string
): void {
  if (loreRecord.wikiContent?.sections && loreRecord.wikiContent.sections.length > 0) {
    for (const section of loreRecord.wikiContent.sections) {
      sections.push({
        id: `section-${sectionIndex.value++}`, heading: section.heading,
        level: section.level || 2, content: section.content,
      });
    }
  } else if (loreRecord.text) {
    sections.push({
      id: `section-${sectionIndex.value++}`, heading: fallbackHeading,
      level: 2, content: loreRecord.text,
    });
  }
}

// eslint-disable-next-line complexity -- lore records come in multiple types with fallback priority; each check selects an independent content source
function buildEntitySections(entity: HardState, entityLore: LoreRecord[], worldData: WorldState): WikiSection[] {
  const sections: WikiSection[] = [];
  const sectionIndex = { value: 0 };
  const enhancedPage = entityLore.find((l) => l.type === "enhanced_entity_page");
  const entityChronicle = entityLore.find((l) => l.type === "entity_chronicle");
  const eraChapter = entityLore.find((l) => l.type === "era_chapter");

  if (enhancedPage?.wikiContent?.sections && enhancedPage.wikiContent.sections.length > 0) {
    appendLoreSections(sections, sectionIndex, enhancedPage, "Overview");
  } else if (entity.description) {
    sections.push({ id: `section-${sectionIndex.value++}`, heading: "Overview", level: 2, content: entity.description });
  }
  if (entityChronicle?.text) appendLoreSections(sections, sectionIndex, entityChronicle, "Chronicle");
  if (entity.kind === "era" && eraChapter?.text) appendLoreSections(sections, sectionIndex, eraChapter, "Chronicle");

  const relationships = worldData.relationships.filter((r) => r.src === entity.id || r.dst === entity.id);
  if (relationships.length > 0) {
    sections.push({
      id: `section-${sectionIndex.value++}`, heading: "Relationships", level: 2,
      content: formatRelationships(entity.id, relationships, worldData),
    });
  }
  return sections;
}

function resolveHistorianNotes(
  notes: NonNullable<HardState["enrichment"]>["historianNotes"]
): Array<{ noteId: string; anchorPhrase: string; text: string; type: string; display: "popout" | "full" }> {
  if (!notes) return [];
  return notes
    .filter((n) => (n.display || (n.enabled === false ? "disabled" : "full")) !== "disabled")
    .map((n) => ({
      noteId: n.noteId, anchorPhrase: n.anchorPhrase, text: n.text, type: n.type,
      display: (n.display || (n.enabled === false ? "disabled" : "full")) as "popout" | "full",
    }));
}

function buildEntityImages(entityId: string, entityName: string, imageIndex: Map<string, ImageInfo>): WikiPage["images"] {
  const imageInfo = imageIndex.get(entityId);
  if (!imageInfo) return [];
  return [{ entityId, path: imageInfo.path, caption: entityName, width: imageInfo.width, height: imageInfo.height, aspect: imageInfo.aspect }];
}

export function buildEntityPage(
  entity: HardState, worldData: WorldState,
  loreIndex: Map<string, LoreRecord[]>, imageIndex: Map<string, ImageInfo>,
  aliasIndex: Map<string, string>, prominenceScale: ProminenceScale,
  _chronicles: ChronicleRecord[] = []
): WikiPage {
  const entityLore = loreIndex.get(entity.id) || [];
  const aliases = getEntityAliases(entity);
  const sections = buildEntitySections(entity, entityLore, worldData);

  return {
    id: entity.id, slug: slugify(entity.name),
    title: entity.name, type: entity.kind === "era" ? "era" : "entity",
    aliases: aliases.length > 0 ? aliases : undefined,
    content: {
      sections, summary: entity.summary || undefined,
      infobox: buildEntityInfobox(entity, worldData, imageIndex, prominenceScale),
      historianNotes: resolveHistorianNotes(entity.enrichment?.historianNotes),
    },
    categories: buildEntityCategories(entity, worldData, prominenceScale),
    linkedEntities: extractLinkedEntities(sections, worldData, aliasIndex),
    images: buildEntityImages(entity.id, entity.name, imageIndex),
    lastUpdated: entity.updatedAt || entity.createdAt,
  };
}

// --- Relationship formatting ---

interface RelRow {
  entity: string; entityName: string; direction: "→" | "←" | "↔"; status: string; since: string;
}

type RelMapEntry = { otherId: string; kind: string; outgoing: WorldState["relationships"][0] | null; incoming: WorldState["relationships"][0] | null };

function buildBidirectionalRelMap(entityId: string, relationships: WorldState["relationships"]): Map<string, RelMapEntry> {
  const relMap = new Map<string, RelMapEntry>();
  for (const rel of relationships) {
    const isOutgoing = rel.src === entityId;
    const otherId = isOutgoing ? rel.dst : rel.src;
    const key = `${rel.kind}:${otherId}`;
    if (!relMap.has(key)) relMap.set(key, { otherId, kind: rel.kind, outgoing: null, incoming: null });
    const entry = relMap.get(key)!;
    if (isOutgoing) { entry.outgoing = rel; } else { entry.incoming = rel; }
  }
  return relMap;
}

function buildRelRowsByKind(relMap: Map<string, RelMapEntry>, entityMap: Map<string, HardState>): Map<string, RelRow[]> {
  const rowsByKind = new Map<string, RelRow[]>();
  for (const [, entry] of relMap) {
    const other = entityMap.get(entry.otherId);
    if (!other) continue;
    let direction: RelRow["direction"] = "←";
    if (entry.outgoing && entry.incoming) direction = "↔";
    else if (entry.outgoing) direction = "→";
    const primaryRel = entry.outgoing ?? entry.incoming!;
    const row: RelRow = {
      entity: `[[${other.name}]]`, entityName: other.name, direction,
      status: primaryRel.status || "active",
      since: primaryRel.createdAt != null ? `Tick ${primaryRel.createdAt}` : "—",
    };
    if (!rowsByKind.has(entry.kind)) rowsByKind.set(entry.kind, []);
    rowsByKind.get(entry.kind)!.push(row);
  }
  return rowsByKind;
}

function buildSortedPairRows(rowsByKind: Map<string, RelRow[]>): Array<{ kind: string; direction: string; entities: string[] }> {
  const byPair = new Map<string, RelRow[]>();
  for (const [kind, rows] of rowsByKind) {
    for (const row of rows) {
      const pairKey = `${kind}:${row.direction}`;
      if (!byPair.has(pairKey)) byPair.set(pairKey, []);
      byPair.get(pairKey)!.push(row);
    }
  }
  const pairRows: Array<{ kind: string; direction: string; entities: string[] }> = [];
  for (const [pairKey, rows] of byPair) {
    const [kind, direction] = pairKey.split(":");
    pairRows.push({ kind, direction, entities: [...rows].sort((a, b) => a.entityName.localeCompare(b.entityName)).map((r) => r.entity) });
  }
  const dirOrder = { "↔": 0, "→": 1, "←": 2 };
  pairRows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return (dirOrder[a.direction as keyof typeof dirOrder] || 0) - (dirOrder[b.direction as keyof typeof dirOrder] || 0);
  });
  return pairRows;
}

function formatRelationships(entityId: string, relationships: WorldState["relationships"], worldData: WorldState): string {
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));
  const relMap = buildBidirectionalRelMap(entityId, relationships);
  const rowsByKind = buildRelRowsByKind(relMap, entityMap);
  const pairRows = buildSortedPairRows(rowsByKind);

  const lines: string[] = ["| Relation | Dir | Entities |", "|----------|:---:|----------|"];
  for (const row of pairRows) lines.push(`| ${row.kind} | ${row.direction} | ${row.entities.join(", ")} |`);
  return lines.join("\n");
}

// eslint-disable-next-line complexity -- infobox fields are populated from many independent optional entity properties
function buildEntityInfobox(
  entity: HardState, worldData: WorldState,
  imageIndex: Map<string, ImageInfo>, prominenceScale: ProminenceScale
): WikiInfobox {
  const fields: WikiInfobox["fields"] = [];
  fields.push({ label: "Type", value: entity.kind });
  if (entity.subtype) fields.push({ label: "Subtype", value: entity.subtype });
  fields.push({ label: "Status", value: entity.status });
  fields.push({ label: "Prominence", value: prominenceLabelFromScale(entity.prominence, prominenceScale) });
  if (entity.culture) fields.push({ label: "Culture", value: entity.culture });

  const activeEra = worldData.relationships.find((r) => r.src === entity.id && r.kind === "active_during");
  if (activeEra) {
    const era = worldData.hardState.find((e) => e.id === activeEra.dst);
    if (era) fields.push({ label: "Era", value: era.name, linkedEntity: era.id });
  }
  if (entity.tags && Object.keys(entity.tags).length > 0) {
    const tagPairs = Object.entries(entity.tags).map(([k, v]) => (v === true ? k : `${k}:${v}`)).join(", ");
    fields.push({ label: "Tags", value: tagPairs });
  }
  if (entity.regionId) {
    const regionInfo = findRegionById(worldData, entity.regionId);
    if (regionInfo) fields.push({ label: "Region", value: regionInfo.region.label, linkedEntity: `region:${entity.regionId}` });
    else fields.push({ label: "Region", value: entity.regionId });
  }
  if (entity.coordinates) {
    const { x, y, z } = entity.coordinates;
    fields.push({ label: "Coords", value: `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})` });
  }

  const imageInfo = imageIndex.get(entity.id);
  return {
    type: entity.kind === "era" ? "era" : "entity", fields,
    image: imageInfo ? { entityId: entity.id, path: imageInfo.path, width: imageInfo.width, height: imageInfo.height, aspect: imageInfo.aspect } : undefined,
  };
}

export function buildEntityCategories(entity: HardState, worldData: WorldState, prominenceScale: ProminenceScale): string[] {
  const categories: string[] = [];
  categories.push(`kind-${entity.kind}`);
  if (entity.subtype) categories.push(`subtype-${entity.subtype}`);
  if (entity.culture) categories.push(`culture-${entity.culture}`);
  categories.push(`prominence-${prominenceLabelFromScale(entity.prominence, prominenceScale)}`);
  categories.push(`status-${entity.status}`);
  const activeEra = worldData.relationships.find((r) => r.src === entity.id && r.kind === "active_during");
  if (activeEra) categories.push(`era-${activeEra.dst}`);
  return categories;
}

/** Historian notes resolver exported for chronicle page building */
export { resolveHistorianNotes };
