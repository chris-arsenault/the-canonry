/**
 * Entity Rename - Reference scanning
 *
 * Normalization, partial name generation, text scanning, and the main
 * `scanForReferences` entry point that discovers all entity-name references
 * across entities, chronicles, and narrative events.
 */

import type { ChronicleRecord } from "./db/chronicleRepository";
import type {
  MatchSourceType,
  MatchTier,
  RenameMatch,
  RenameScanResult,
  ScanEntity,
  ScanNarrativeEvent,
  ScanRelationship,
} from "./entityRenameTypes";

// ---------------------------------------------------------------------------
// Normalization (mirrors wikiLinkService.ts)
// ---------------------------------------------------------------------------

function isAsciiAlphaNumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 48 && code <= 57) // 0-9
  );
}

interface NormalizedText {
  normalized: string;
  indexMap: number[];
}

function normalizeForMatch(text: string): NormalizedText {
  const normalizedChars: string[] = [];
  const indexMap: number[] = [];
  let prevSeparator = true;

  for (let i = 0; i < text.length; i += 1) {
    const lower = text[i].toLowerCase();
    if (isAsciiAlphaNumeric(lower)) {
      normalizedChars.push(lower);
      indexMap.push(i);
      prevSeparator = false;
    } else if (!prevSeparator) {
      normalizedChars.push("-");
      indexMap.push(i);
      prevSeparator = true;
    }
  }

  while (normalizedChars.length > 0 && normalizedChars[0] === "-") {
    normalizedChars.shift();
    indexMap.shift();
  }
  while (normalizedChars.length > 0 && normalizedChars[normalizedChars.length - 1] === "-") {
    normalizedChars.pop();
    indexMap.pop();
  }

  return { normalized: normalizedChars.join(""), indexMap };
}

function normalizeSlug(text: string): string {
  return normalizeForMatch(text).normalized;
}

// ---------------------------------------------------------------------------
// Partial name generation
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and",
  "or", "but", "is", "was", "are", "were", "be", "been", "by",
  "with", "from", "as", "its", "that", "this", "it", "no", "not",
]);

function generatePartials(name: string): string[] {
  const words = name.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);
  if (words.length <= 1) return [];

  const partials = new Set<string>();
  const fullSlug = normalizeSlug(name);

  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      const fragment = words.slice(start, end).join(" ");
      const slug = normalizeSlug(fragment);
      if (!slug || slug.length < 3) continue;
      if (slug === fullSlug) continue;
      if (words.slice(start, end).length === 1 && STOP_WORDS.has(slug)) continue;
      partials.add(slug);
    }
  }

  return [...partials].sort((a, b) => b.length - a.length);
}

// ---------------------------------------------------------------------------
// Text scanning primitives
// ---------------------------------------------------------------------------

interface RawMatch {
  start: number;
  end: number;
  matchedText: string;
}

function extendToTrailingDecorativeChars(originalText: string, rawEnd: number): number {
  let end = rawEnd;
  while (end < originalText.length) {
    const ch = originalText[end];
    if (/\s/.test(ch)) break;
    if (isAsciiAlphaNumeric(ch.toLowerCase())) break;
    if (ch === "'" || ch === "\u2019") break;
    end++;
  }
  return end;
}

function isWordBoundaryMatch(normalizedText: string, idx: number, matchEnd: number): boolean {
  const beforeOk = idx === 0 || normalizedText[idx - 1] === "-";
  const afterOk = matchEnd === normalizedText.length || normalizedText[matchEnd] === "-";
  return beforeOk && afterOk;
}

function findAllOccurrences(
  slug: string,
  normalizedText: string,
  indexMap: number[],
  originalText: string
): RawMatch[] {
  if (!slug || !normalizedText) return [];
  const matches: RawMatch[] = [];
  let searchFrom = 0;

  while (searchFrom <= normalizedText.length - slug.length) {
    const idx = normalizedText.indexOf(slug, searchFrom);
    if (idx === -1) break;
    const matchEnd = idx + slug.length;

    if (isWordBoundaryMatch(normalizedText, idx, matchEnd)) {
      const rawStart = indexMap[idx];
      const rawEnd = extendToTrailingDecorativeChars(originalText, indexMap[matchEnd - 1] + 1);
      matches.push({ start: rawStart, end: rawEnd, matchedText: originalText.slice(rawStart, rawEnd) });
    }
    searchFrom = idx + 1;
  }

  return matches;
}

function extractContext(
  text: string,
  start: number,
  end: number,
  contextSize: number = 60
): { before: string; after: string } {
  const beforeStart = Math.max(0, start - contextSize);
  const afterEnd = Math.min(text.length, end + contextSize);
  let before = text.slice(beforeStart, start);
  let after = text.slice(end, afterEnd);
  if (beforeStart > 0) before = "..." + before;
  if (afterEnd < text.length) after = after + "...";
  return { before, after };
}

// ---------------------------------------------------------------------------
// Scan context
// ---------------------------------------------------------------------------

type ScanFn = (
  sourceType: MatchSourceType,
  sourceId: string,
  sourceName: string,
  field: string,
  text: string | undefined | null
) => void;

interface ScanContext {
  entityId: string;
  fullSlug: string;
  partialSlugs: string[];
  matches: RenameMatch[];
  coveredPositions: Map<string, Set<string>>;
  currentTier: MatchTier;
}

let matchIdCounter = 0;
function nextMatchId(): string {
  return `rm-${++matchIdCounter}`;
}

function markCovered(ctx: ScanContext, key: string, start: number, end: number) {
  let set = ctx.coveredPositions.get(key);
  if (!set) {
    set = new Set();
    ctx.coveredPositions.set(key, set);
  }
  set.add(`${start}:${end}`);
}

function isOverlapping(ctx: ScanContext, key: string, start: number, end: number): boolean {
  const set = ctx.coveredPositions.get(key);
  if (!set) return false;
  for (const entry of set) {
    const [cs, ce] = entry.split(":").map(Number);
    if (start < ce && end > cs) return true;
  }
  return false;
}

function pushMatch(
  ctx: ScanContext,
  sourceType: MatchSourceType,
  sourceId: string,
  sourceName: string,
  field: string,
  matchType: RenameMatch["matchType"],
  m: RawMatch,
  text: string,
  partialFragment?: string
) {
  const ctxText = extractContext(text, m.start, m.end);
  ctx.matches.push({
    id: nextMatchId(),
    sourceType, sourceId, sourceName, field, matchType,
    matchedText: m.matchedText,
    position: m.start,
    contextBefore: ctxText.before,
    contextAfter: ctxText.after,
    partialFragment,
    tier: ctx.currentTier,
  });
}

// ---------------------------------------------------------------------------
// Field-level scanners
// ---------------------------------------------------------------------------

function scanTextField(
  ctx: ScanContext, sourceType: MatchSourceType, sourceId: string,
  sourceName: string, field: string, text: string | undefined | null
) {
  if (!text) return;
  const { normalized, indexMap } = normalizeForMatch(text);
  const posKey = `${sourceType}:${sourceId}:${field}`;
  const fullMatches = findAllOccurrences(ctx.fullSlug, normalized, indexMap, text);
  for (const m of fullMatches) {
    markCovered(ctx, posKey, m.start, m.end);
    pushMatch(ctx, sourceType, sourceId, sourceName, field, "full", m, text);
  }
  for (const partialSlug of ctx.partialSlugs) {
    const partialMatches = findAllOccurrences(partialSlug, normalized, indexMap, text);
    for (const m of partialMatches) {
      if (isOverlapping(ctx, posKey, m.start, m.end)) continue;
      markCovered(ctx, posKey, m.start, m.end);
      pushMatch(ctx, sourceType, sourceId, sourceName, field, "partial", m, text, partialSlug);
    }
  }
}

function scanTextFieldFullNameOnly(
  ctx: ScanContext, sourceType: MatchSourceType, sourceId: string,
  sourceName: string, field: string, text: string | undefined | null
) {
  if (!text) return;
  const { normalized, indexMap } = normalizeForMatch(text);
  const posKey = `${sourceType}:${sourceId}:${field}`;
  const fullMatches = findAllOccurrences(ctx.fullSlug, normalized, indexMap, text);
  for (const m of fullMatches) {
    if (isOverlapping(ctx, posKey, m.start, m.end)) continue;
    markCovered(ctx, posKey, m.start, m.end);
    pushMatch(ctx, sourceType, sourceId, sourceName, field, "full", m, text);
  }
}

function scanEntityTextFields(entity: ScanEntity, ctx: ScanContext, scanFn: ScanFn) {
  scanFn("entity", entity.id, entity.name, "summary", entity.summary);
  scanFn("entity", entity.id, entity.name, "description", entity.description);
  scanFn("entity", entity.id, entity.name, "narrativeHint", entity.narrativeHint);
  if (entity.enrichment?.descriptionHistory) {
    for (let i = 0; i < entity.enrichment.descriptionHistory.length; i++) {
      scanFn("entity", entity.id, entity.name,
        `enrichment.descriptionHistory[${i}].description`,
        entity.enrichment.descriptionHistory[i].description);
    }
  }
}

function pushMetadataMatch(
  ctx: ScanContext, sourceType: MatchSourceType, sourceId: string,
  sourceName: string, field: string, matchedText: string,
  contextBefore: string, contextAfter: string
) {
  ctx.matches.push({
    id: nextMatchId(), sourceType, sourceId, sourceName, field,
    matchType: "metadata", matchedText, position: 0,
    contextBefore, contextAfter, tier: ctx.currentTier,
  });
}

// ---------------------------------------------------------------------------
// Chronicle metadata scanning
// ---------------------------------------------------------------------------

function scanRoleAssignments(chronicle: ChronicleRecord, entityId: string, ctx: ScanContext): void {
  if (!chronicle.roleAssignments) return;
  for (let i = 0; i < chronicle.roleAssignments.length; i++) {
    const ra = chronicle.roleAssignments[i];
    if (ra.entityId === entityId) {
      pushMetadataMatch(ctx, "chronicle", chronicle.chronicleId, chronicle.title,
        `roleAssignments[${i}].entityName`, ra.entityName,
        `Role: ${ra.role}`, `(${ra.entityKind})`);
    }
  }
}

function scanLens(chronicle: ChronicleRecord, entityId: string, ctx: ScanContext): void {
  if (!chronicle.lens || chronicle.lens.entityId !== entityId) return;
  pushMetadataMatch(ctx, "chronicle", chronicle.chronicleId, chronicle.title,
    "lens.entityName", chronicle.lens.entityName, "Lens:", `(${chronicle.lens.entityKind})`);
}

function scanEntityDirectives(chronicle: ChronicleRecord, entityId: string, ctx: ScanContext): void {
  if (!chronicle.generationContext?.entityDirectives) return;
  for (let i = 0; i < chronicle.generationContext.entityDirectives.length; i++) {
    const ed = chronicle.generationContext.entityDirectives[i];
    if (ed.entityId === entityId) {
      const snippet = ed.directive.slice(0, 40) + (ed.directive.length > 40 ? "..." : "");
      pushMetadataMatch(ctx, "chronicle", chronicle.chronicleId, chronicle.title,
        `generationContext.entityDirectives[${i}].entityName`, ed.entityName, "Directive:", snippet);
    }
  }
}

function scanChronicleMetadata(chronicle: ChronicleRecord, entityId: string, ctx: ScanContext) {
  scanRoleAssignments(chronicle, entityId, ctx);
  scanLens(chronicle, entityId, ctx);
  scanEntityDirectives(chronicle, entityId, ctx);
}

function scanChronicleTextFields(chronicle: ChronicleRecord, scanFn: ScanFn) {
  const cId = chronicle.chronicleId;
  const cTitle = chronicle.title;
  scanFn("chronicle", cId, cTitle, "assembledContent", chronicle.assembledContent);
  scanFn("chronicle", cId, cTitle, "finalContent", chronicle.finalContent);
  scanFn("chronicle", cId, cTitle, "summary", chronicle.summary);
  if (chronicle.generationHistory) {
    for (const version of chronicle.generationHistory) {
      scanFn("chronicle", cId, cTitle, `generationHistory.${version.versionId}`, version.content);
    }
  }
}

// ---------------------------------------------------------------------------
// Narrative event scanning
// ---------------------------------------------------------------------------

function eventSnippetName(event: ScanNarrativeEvent): string {
  return event.description.length > 60 ? event.description.slice(0, 57) + "..." : event.description;
}

function scanEventMetadataFields(event: ScanNarrativeEvent, entityId: string, ctx: ScanContext) {
  const eId = event.id;
  const eName = eventSnippetName(event);
  if (event.subject.id === entityId) {
    pushMetadataMatch(ctx, "event", eId, eName, "subject.name", event.subject.name, "Subject:", "");
  }
  for (let pi = 0; pi < event.participantEffects.length; pi++) {
    const pe = event.participantEffects[pi];
    if (pe.entity.id === entityId) {
      pushMetadataMatch(ctx, "event", eId, eName,
        `participantEffects[${pi}].entity.name`, pe.entity.name, "Participant:", "");
    }
    for (let ei = 0; ei < pe.effects.length; ei++) {
      const eff = pe.effects[ei];
      if (eff.relatedEntity && eff.relatedEntity.id === entityId) {
        pushMetadataMatch(ctx, "event", eId, eName,
          `participantEffects[${pi}].effects[${ei}].relatedEntity.name`,
          eff.relatedEntity.name, `Related entity (${pe.entity.name}):`, "");
      }
    }
  }
}

function scanEventEffectDescriptions(event: ScanNarrativeEvent, scanFn: ScanFn) {
  const eId = event.id;
  const eName = eventSnippetName(event);
  for (let pi = 0; pi < event.participantEffects.length; pi++) {
    const pe = event.participantEffects[pi];
    for (let ei = 0; ei < pe.effects.length; ei++) {
      scanFn("event", eId, eName,
        `participantEffects[${pi}].effects[${ei}].description`, pe.effects[ei].description);
    }
  }
}

function scanSingleNarrativeEvent(
  event: ScanNarrativeEvent, entityId: string, isParticipant: boolean,
  ctx: ScanContext, fullAndPartial: ScanFn, fullOnly: ScanFn
): void {
  ctx.currentTier = isParticipant ? "participant" : "mention";
  const scan = isParticipant ? fullAndPartial : fullOnly;
  if (isParticipant) scanEventMetadataFields(event, entityId, ctx);
  scan("event", event.id, eventSnippetName(event), "description", event.description);
  scan("event", event.id, eventSnippetName(event), "action", event.action);
  if (isParticipant) scanEventEffectDescriptions(event, scan);
}

function scanNarrativeEvents(events: ScanNarrativeEvent[], entityId: string, ctx: ScanContext) {
  const participantIds = new Set<string>();
  for (const event of events) {
    if (event.subject.id === entityId || event.participantEffects.some((pe) => pe.entity.id === entityId)) {
      participantIds.add(event.id);
    }
  }
  const fullAndPartial: ScanFn = (st, si, sn, f, t) => scanTextField(ctx, st, si, sn, f, t);
  const fullOnly: ScanFn = (st, si, sn, f, t) => scanTextFieldFullNameOnly(ctx, st, si, sn, f, t);
  for (const event of events) {
    scanSingleNarrativeEvent(event, entityId, participantIds.has(event.id), ctx, fullAndPartial, fullOnly);
  }
}

// ---------------------------------------------------------------------------
// FK reference scanning
// ---------------------------------------------------------------------------

function scanRelationshipFkRefs(
  entityId: string, entityById: Map<string, ScanEntity>,
  relationships: ScanRelationship[], ctx: ScanContext
): void {
  for (const rel of relationships) {
    if (rel.src !== entityId && rel.dst !== entityId) continue;
    const otherId = rel.src === entityId ? rel.dst : rel.src;
    const otherName = entityById.get(otherId)?.name || otherId;
    const direction = rel.src === entityId ? "outgoing" : "incoming";
    ctx.matches.push({
      id: nextMatchId(), sourceType: "entity", sourceId: otherId, sourceName: otherName,
      field: `relationship.${rel.kind}`, matchType: "id_slug", matchedText: entityId,
      position: 0, contextBefore: `${direction} ${rel.kind}:`,
      contextAfter: `\u2192 ${otherName}${rel.status === "historical" ? " (historical)" : ""}`,
      tier: "related",
    });
  }
}

function scanChronicleFkRefs(entityId: string, chronicles: ChronicleRecord[], ctx: ScanContext): void {
  for (const chronicle of chronicles) {
    if (!chronicle.selectedEntityIds?.includes(entityId)) continue;
    ctx.matches.push({
      id: nextMatchId(), sourceType: "chronicle",
      sourceId: chronicle.chronicleId, sourceName: chronicle.title,
      field: "selectedEntityIds", matchType: "id_slug", matchedText: entityId,
      position: 0, contextBefore: "Cast member:",
      contextAfter: `(${chronicle.selectedEntityIds.length} entities in chronicle)`,
      tier: "cast",
    });
  }
}

// ---------------------------------------------------------------------------
// Main scan orchestration
// ---------------------------------------------------------------------------

function buildRelatedEntityIds(entityId: string, relationships: ScanRelationship[] | undefined): Set<string> {
  const ids = new Set<string>();
  if (!relationships) return ids;
  for (const rel of relationships) {
    if (rel.src === entityId) ids.add(rel.dst);
    if (rel.dst === entityId) ids.add(rel.src);
  }
  return ids;
}

function buildCastChronicleIds(entityId: string, chronicles: ChronicleRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const chronicle of chronicles) {
    if (chronicle.selectedEntityIds?.includes(entityId)) ids.add(chronicle.chronicleId);
  }
  return ids;
}

function scanSelfAndRelated(
  entityId: string, entityById: Map<string, ScanEntity>,
  relatedEntityIds: Set<string>, ctx: ScanContext, scanFn: ScanFn
): void {
  ctx.currentTier = "self";
  const selfEntity = entityById.get(entityId);
  if (selfEntity) scanEntityTextFields(selfEntity, ctx, scanFn);
  ctx.currentTier = "related";
  for (const relEntityId of relatedEntityIds) {
    const relEntity = entityById.get(relEntityId);
    if (relEntity) scanEntityTextFields(relEntity, ctx, scanFn);
  }
}

function scanCastChronicles(
  entityId: string, chronicles: ChronicleRecord[],
  castChronicleIds: Set<string>, ctx: ScanContext, scanFn: ScanFn
): void {
  ctx.currentTier = "cast";
  for (const chronicle of chronicles) {
    if (!castChronicleIds.has(chronicle.chronicleId)) continue;
    scanChronicleMetadata(chronicle, entityId, ctx);
    scanChronicleTextFields(chronicle, scanFn);
  }
}

function scanGeneralSweep(
  entityId: string, entities: ScanEntity[], chronicles: ChronicleRecord[],
  scannedEntityIds: Set<string>, castChronicleIds: Set<string>,
  ctx: ScanContext, fullOnly: ScanFn
): void {
  ctx.currentTier = "general";
  for (const entity of entities) {
    if (scannedEntityIds.has(entity.id)) continue;
    scanEntityTextFields(entity, ctx, fullOnly);
  }
  for (const chronicle of chronicles) {
    if (castChronicleIds.has(chronicle.chronicleId)) continue;
    scanChronicleMetadata(chronicle, entityId, ctx);
    scanChronicleTextFields(chronicle, fullOnly);
  }
}

export function scanForReferences(
  entityId: string, oldName: string,
  entities: ScanEntity[], chronicles: ChronicleRecord[],
  relationships?: ScanRelationship[], narrativeEvents?: ScanNarrativeEvent[]
): RenameScanResult {
  matchIdCounter = 0;
  const ctx: ScanContext = {
    entityId, fullSlug: normalizeSlug(oldName), partialSlugs: generatePartials(oldName),
    matches: [], coveredPositions: new Map(), currentTier: "general",
  };
  const fullAndPartial: ScanFn = (st, si, sn, f, t) => scanTextField(ctx, st, si, sn, f, t);
  const fullOnly: ScanFn = (st, si, sn, f, t) => scanTextFieldFullNameOnly(ctx, st, si, sn, f, t);
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const relatedEntityIds = buildRelatedEntityIds(entityId, relationships);
  const castChronicleIds = buildCastChronicleIds(entityId, chronicles);

  scanSelfAndRelated(entityId, entityById, relatedEntityIds, ctx, fullAndPartial);
  scanCastChronicles(entityId, chronicles, castChronicleIds, ctx, fullAndPartial);
  const scannedEntityIds = new Set([entityId, ...relatedEntityIds]);
  scanGeneralSweep(entityId, entities, chronicles, scannedEntityIds, castChronicleIds, ctx, fullOnly);
  if (narrativeEvents) scanNarrativeEvents(narrativeEvents, entityId, ctx);
  if (relationships) scanRelationshipFkRefs(entityId, entityById, relationships, ctx);
  scanChronicleFkRefs(entityId, chronicles, ctx);

  return { entityId, oldName, matches: ctx.matches };
}
