/**
 * Entity Rename - Core scan and replacement logic
 *
 * Scans all entities and chronicles for references to an entity name,
 * including partial name matches. Uses the same normalization approach
 * as wikiLinkService.ts (lowercase ASCII slug, word-boundary matching).
 */

import type { ChronicleRecord } from "./db/chronicleRepository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How closely related this match source is to the entity being renamed. */
export type MatchTier = "self" | "related" | "cast" | "participant" | "mention" | "general";

export type MatchSourceType = "entity" | "chronicle" | "event";

export interface RenameMatch {
  /** Unique match ID */
  id: string;
  /** Where the match was found */
  sourceType: MatchSourceType;
  /** Entity ID, chronicle ID, or event ID */
  sourceId: string;
  /** Entity name, chronicle title, or event description snippet (for display) */
  sourceName: string;
  /** Which field contains the match */
  field: string;
  /** full = complete name, partial = sub-sequence, metadata = denormalized field, id_slug = entity ID reference */
  matchType: "full" | "partial" | "metadata" | "id_slug";
  /** The original text span that matched */
  matchedText: string;
  /** Character offset in the field's text */
  position: number;
  /** ~60 chars before the match */
  contextBefore: string;
  /** ~60 chars after the match */
  contextAfter: string;
  /** Which name fragment matched (for partial matches) */
  partialFragment?: string;
  /** Relationship tier: how the source relates to the entity being renamed */
  tier: MatchTier;
}

export interface MatchDecision {
  matchId: string;
  action: "accept" | "reject" | "edit";
  /** Custom replacement text (only for 'edit') */
  editText?: string;
}

export interface RenameScanResult {
  entityId: string;
  oldName: string;
  matches: RenameMatch[];
}

export interface EntityPatch {
  entityId: string;
  changes: Record<string, string>;
}

export interface ChroniclePatch {
  chronicleId: string;
  /** Map of field name -> new full field value */
  fieldUpdates: Record<string, unknown>;
}

export interface EventPatch {
  eventId: string;
  changes: Record<string, string>;
}

export interface RenamePatches {
  entityPatches: EntityPatch[];
  chroniclePatches: ChroniclePatch[];
  eventPatches: EventPatch[];
}

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
  /** Maps each index in `normalized` back to the original text index */
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
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "and",
  "or",
  "but",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "by",
  "with",
  "from",
  "as",
  "its",
  "that",
  "this",
  "it",
  "no",
  "not",
]);

/**
 * Generate all meaningful sub-sequences of a name for partial matching.
 * Returns slugs sorted longest-first so longer matches take priority.
 */
function generatePartials(name: string): string[] {
  // Split on non-alpha-numeric to get raw words
  const words = name.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);

  if (words.length <= 1) return [];

  const partials = new Set<string>();
  const fullSlug = normalizeSlug(name);

  // Generate all contiguous sub-sequences of words
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      const fragment = words.slice(start, end).join(" ");
      const slug = normalizeSlug(fragment);

      // Skip: empty, too short, stop words standing alone, or the full name itself
      if (!slug || slug.length < 3) continue;
      if (slug === fullSlug) continue;
      if (words.slice(start, end).length === 1 && STOP_WORDS.has(slug)) continue;

      partials.add(slug);
    }
  }

  // Sort longest first so longer matches are found before shorter ones
  return [...partials].sort((a, b) => b.length - a.length);
}

// ---------------------------------------------------------------------------
// Text scanning
// ---------------------------------------------------------------------------

interface RawMatch {
  /** Start index in the original text */
  start: number;
  /** End index in the original text (exclusive) */
  end: number;
  /** The original text span */
  matchedText: string;
}

/**
 * Extend rawEnd past trailing decorative chars (e.g. ~ or ]) that belong
 * to the matched word, stopping at whitespace, alphanumeric, or apostrophes.
 */
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

/**
 * Find all occurrences of `slug` in `text` on word boundaries.
 * Returns positions mapped back to the original text.
 */
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

      matches.push({
        start: rawStart,
        end: rawEnd,
        matchedText: originalText.slice(rawStart, rawEnd),
      });
    }

    searchFrom = idx + 1;
  }

  return matches;
}

/**
 * Extract context around a match position.
 */
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
// Main scan
// ---------------------------------------------------------------------------

export interface ScanEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  summary?: string;
  description?: string;
  narrativeHint?: string;
  enrichment?: {
    descriptionHistory?: Array<{
      description: string;
      replacedAt: number;
      source: string;
    }>;
  };
}

export interface ScanNarrativeEvent {
  id: string;
  subject: { id: string; name: string };
  action: string;
  description: string;
  participantEffects: Array<{
    entity: { id: string; name: string };
    effects: Array<{
      description: string;
      relatedEntity?: { id: string; name: string };
    }>;
  }>;
}

let matchIdCounter = 0;
function nextMatchId(): string {
  return `rm-${++matchIdCounter}`;
}

interface ScanRelationship {
  kind: string;
  src: string;
  dst: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Scan context — shared state for a single scanForReferences call
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
    sourceType,
    sourceId,
    sourceName,
    field,
    matchType,
    matchedText: m.matchedText,
    position: m.start,
    contextBefore: ctxText.before,
    contextAfter: ctxText.after,
    partialFragment,
    tier: ctx.currentTier,
  });
}

function scanTextField(
  ctx: ScanContext,
  sourceType: MatchSourceType,
  sourceId: string,
  sourceName: string,
  field: string,
  text: string | undefined | null
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
  ctx: ScanContext,
  sourceType: MatchSourceType,
  sourceId: string,
  sourceName: string,
  field: string,
  text: string | undefined | null
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
      scanFn(
        "entity",
        entity.id,
        entity.name,
        `enrichment.descriptionHistory[${i}].description`,
        entity.enrichment.descriptionHistory[i].description
      );
    }
  }
}

function pushMetadataMatch(
  ctx: ScanContext,
  sourceType: MatchSourceType,
  sourceId: string,
  sourceName: string,
  field: string,
  matchedText: string,
  contextBefore: string,
  contextAfter: string
) {
  ctx.matches.push({
    id: nextMatchId(),
    sourceType,
    sourceId,
    sourceName,
    field,
    matchType: "metadata",
    matchedText,
    position: 0,
    contextBefore,
    contextAfter,
    tier: ctx.currentTier,
  });
}

function scanChronicleMetadata(
  chronicle: ChronicleRecord,
  entityId: string,
  ctx: ScanContext
) {
  const cId = chronicle.chronicleId;
  const cTitle = chronicle.title;

  if (chronicle.roleAssignments) {
    for (let i = 0; i < chronicle.roleAssignments.length; i++) {
      const ra = chronicle.roleAssignments[i];
      if (ra.entityId === entityId) {
        pushMetadataMatch(ctx, "chronicle", cId, cTitle,
          `roleAssignments[${i}].entityName`, ra.entityName,
          `Role: ${ra.role}`, `(${ra.entityKind})`);
      }
    }
  }

  if (chronicle.lens && chronicle.lens.entityId === entityId) {
    pushMetadataMatch(ctx, "chronicle", cId, cTitle,
      "lens.entityName", chronicle.lens.entityName,
      "Lens:", `(${chronicle.lens.entityKind})`);
  }

  if (chronicle.generationContext?.entityDirectives) {
    for (let i = 0; i < chronicle.generationContext.entityDirectives.length; i++) {
      const ed = chronicle.generationContext.entityDirectives[i];
      if (ed.entityId === entityId) {
        pushMetadataMatch(ctx, "chronicle", cId, cTitle,
          `generationContext.entityDirectives[${i}].entityName`, ed.entityName,
          "Directive:", ed.directive.slice(0, 40) + (ed.directive.length > 40 ? "..." : ""));
      }
    }
  }
}

function scanChronicleTextFields(
  chronicle: ChronicleRecord,
  scanFn: ScanFn
) {
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

function scanEventMetadataFields(
  event: ScanNarrativeEvent,
  entityId: string,
  ctx: ScanContext
) {
  const eId = event.id;
  const eName = event.description.length > 60
    ? event.description.slice(0, 57) + "..."
    : event.description;

  if (event.subject.id === entityId) {
    pushMetadataMatch(ctx, "event", eId, eName, "subject.name",
      event.subject.name, "Subject:", "");
  }

  for (let pi = 0; pi < event.participantEffects.length; pi++) {
    const pe = event.participantEffects[pi];
    if (pe.entity.id === entityId) {
      pushMetadataMatch(ctx, "event", eId, eName,
        `participantEffects[${pi}].entity.name`, pe.entity.name,
        "Participant:", "");
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

function scanEventEffectDescriptions(
  event: ScanNarrativeEvent,
  scanFn: ScanFn
) {
  const eId = event.id;
  const eName = event.description.length > 60
    ? event.description.slice(0, 57) + "..."
    : event.description;

  for (let pi = 0; pi < event.participantEffects.length; pi++) {
    const pe = event.participantEffects[pi];
    for (let ei = 0; ei < pe.effects.length; ei++) {
      scanFn("event", eId, eName,
        `participantEffects[${pi}].effects[${ei}].description`,
        pe.effects[ei].description);
    }
  }
}

function scanNarrativeEvents(
  narrativeEvents: ScanNarrativeEvent[],
  entityId: string,
  ctx: ScanContext
) {
  const participantEventIds = new Set<string>();
  for (const event of narrativeEvents) {
    if (event.subject.id === entityId) {
      participantEventIds.add(event.id);
      continue;
    }
    for (const pe of event.participantEffects) {
      if (pe.entity.id === entityId) {
        participantEventIds.add(event.id);
        break;
      }
    }
  }

  const fullAndPartial: ScanFn = (st, si, sn, f, t) => scanTextField(ctx, st, si, sn, f, t);
  const fullOnly: ScanFn = (st, si, sn, f, t) => scanTextFieldFullNameOnly(ctx, st, si, sn, f, t);

  for (const event of narrativeEvents) {
    const eId = event.id;
    const eName = event.description.length > 60
      ? event.description.slice(0, 57) + "..."
      : event.description;
    const isParticipant = participantEventIds.has(eId);
    ctx.currentTier = isParticipant ? "participant" : "mention";
    const scan = isParticipant ? fullAndPartial : fullOnly;

    if (isParticipant) {
      scanEventMetadataFields(event, entityId, ctx);
    }

    scan("event", eId, eName, "description", event.description);
    scan("event", eId, eName, "action", event.action);

    if (isParticipant) {
      scanEventEffectDescriptions(event, scan);
    }
  }
}

function scanFkReferences(
  entityId: string,
  entityById: Map<string, ScanEntity>,
  relationships: ScanRelationship[] | undefined,
  chronicles: ChronicleRecord[],
  ctx: ScanContext
) {
  if (relationships) {
    for (const rel of relationships) {
      if (rel.src !== entityId && rel.dst !== entityId) continue;
      const otherId = rel.src === entityId ? rel.dst : rel.src;
      const otherName = entityById.get(otherId)?.name || otherId;
      const direction = rel.src === entityId ? "outgoing" : "incoming";
      ctx.matches.push({
        id: nextMatchId(),
        sourceType: "entity",
        sourceId: otherId,
        sourceName: otherName,
        field: `relationship.${rel.kind}`,
        matchType: "id_slug",
        matchedText: entityId,
        position: 0,
        contextBefore: `${direction} ${rel.kind}:`,
        contextAfter: `\u2192 ${otherName}${rel.status === "historical" ? " (historical)" : ""}`,
        tier: "related",
      });
    }
  }

  for (const chronicle of chronicles) {
    if (chronicle.selectedEntityIds?.includes(entityId)) {
      ctx.matches.push({
        id: nextMatchId(),
        sourceType: "chronicle",
        sourceId: chronicle.chronicleId,
        sourceName: chronicle.title,
        field: "selectedEntityIds",
        matchType: "id_slug",
        matchedText: entityId,
        position: 0,
        contextBefore: "Cast member:",
        contextAfter: `(${chronicle.selectedEntityIds.length} entities in chronicle)`,
        tier: "cast",
      });
    }
  }
}

/**
 * Scan all entities and chronicles for references to the given entity name.
 * Also surfaces all foreign-key references to the entity ID (relationships,
 * chronicle selectedEntityIds, etc.) so the user can verify completeness.
 */
export function scanForReferences(
  entityId: string,
  oldName: string,
  entities: ScanEntity[],
  chronicles: ChronicleRecord[],
  relationships?: ScanRelationship[],
  narrativeEvents?: ScanNarrativeEvent[]
): RenameScanResult {
  matchIdCounter = 0;

  const ctx: ScanContext = {
    entityId,
    fullSlug: normalizeSlug(oldName),
    partialSlugs: generatePartials(oldName),
    matches: [],
    coveredPositions: new Map(),
    currentTier: "general",
  };

  const fullAndPartial: ScanFn = (st, si, sn, f, t) => scanTextField(ctx, st, si, sn, f, t);
  const fullOnly: ScanFn = (st, si, sn, f, t) => scanTextFieldFullNameOnly(ctx, st, si, sn, f, t);

  const entityById = new Map(entities.map((e) => [e.id, e]));

  // Build related entity set from relationships
  const relatedEntityIds = new Set<string>();
  if (relationships) {
    for (const rel of relationships) {
      if (rel.src === entityId) relatedEntityIds.add(rel.dst);
      if (rel.dst === entityId) relatedEntityIds.add(rel.src);
    }
  }

  // Build cast chronicle set
  const castChronicleIds = new Set<string>();
  for (const chronicle of chronicles) {
    if (chronicle.selectedEntityIds?.includes(entityId)) {
      castChronicleIds.add(chronicle.chronicleId);
    }
  }

  // 1. SELF
  ctx.currentTier = "self";
  const selfEntity = entityById.get(entityId);
  if (selfEntity) scanEntityTextFields(selfEntity, ctx, fullAndPartial);

  // 2. RELATED
  ctx.currentTier = "related";
  for (const relEntityId of relatedEntityIds) {
    const relEntity = entityById.get(relEntityId);
    if (relEntity) scanEntityTextFields(relEntity, ctx, fullAndPartial);
  }

  // 3. CAST CHRONICLES
  ctx.currentTier = "cast";
  for (const chronicle of chronicles) {
    if (!castChronicleIds.has(chronicle.chronicleId)) continue;
    scanChronicleMetadata(chronicle, entityId, ctx);
    scanChronicleTextFields(chronicle, fullAndPartial);
  }

  // 4. GENERAL SWEEP
  ctx.currentTier = "general";
  const scannedEntityIds = new Set([entityId, ...relatedEntityIds]);
  for (const entity of entities) {
    if (scannedEntityIds.has(entity.id)) continue;
    scanEntityTextFields(entity, ctx, fullOnly);
  }

  for (const chronicle of chronicles) {
    if (castChronicleIds.has(chronicle.chronicleId)) continue;
    scanChronicleMetadata(chronicle, entityId, ctx);
    scanChronicleTextFields(chronicle, fullOnly);
  }

  // 5. NARRATIVE EVENTS
  if (narrativeEvents) {
    scanNarrativeEvents(narrativeEvents, entityId, ctx);
  }

  // FK references
  scanFkReferences(entityId, entityById, relationships, chronicles, ctx);

  return { entityId, oldName, matches: ctx.matches };
}

// ---------------------------------------------------------------------------
// Grammar-aware replacement adjustment
// ---------------------------------------------------------------------------

/** Strip the leading "..." display prefix from contextBefore */
function rawCtxBefore(ctx: string): string {
  return ctx.startsWith("...") ? ctx.slice(3) : ctx;
}

/** Strip the trailing "..." display suffix from contextAfter */
function rawCtxAfter(ctx: string): string {
  return ctx.endsWith("...") ? ctx.slice(0, -3) : ctx;
}

/** Is this match at the start of a sentence? */
function isAtSentenceStart(rawBefore: string): boolean {
  if (rawBefore.length === 0) return true;
  const trimmed = rawBefore.trimEnd();
  if (trimmed.length === 0) return true;
  const last = trimmed[trimmed.length - 1];
  return ".!?:\n".includes(last);
}

interface PrecedingArticle {
  text: string;
  normalized: "the" | "a" | "an";
  length: number;
}

/** Detect a preceding article (the/a/an) + trailing space at end of context. */
function findPrecedingArticle(rawBefore: string): PrecedingArticle | null {
  const m = rawBefore.match(/(the|an?)\s+$/i);
  if (!m) return null;
  const fullMatch = m[0]; // e.g. "the ", "The  ", "a ", "an "
  const norm = m[1].toLowerCase() as "the" | "a" | "an";
  // Verify word boundary: char before the article must not be alphanumeric
  const beforeArticle = rawBefore.slice(0, rawBefore.length - fullMatch.length);
  if (beforeArticle.length > 0) {
    const lastChar = beforeArticle[beforeArticle.length - 1];
    if (/[a-zA-Z0-9]/.test(lastChar)) return null; // "bathe " — not an article
  }
  return { text: fullMatch, normalized: norm, length: fullMatch.length };
}

type CasePattern = "allCaps" | "allLower" | "mixed";

function detectCasePattern(text: string): CasePattern {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return "mixed";
  if (letters === letters.toUpperCase()) return "allCaps";
  if (letters === letters.toLowerCase()) return "allLower";
  return "mixed";
}

// Common words starting with vowel letters but consonant sounds (yoo-, yew-)
const CONSONANT_SOUND_VOWEL_PREFIXES = [
  "uni",
  "use",
  "used",
  "user",
  "using",
  "usual",
  "usually",
  "unique",
  "union",
  "unit",
  "united",
  "universal",
  "university",
  "euro",
];
// Common words starting with consonant letters but vowel sounds (silent h)
const VOWEL_SOUND_CONSONANT_PREFIXES = ["hour", "honest", "honor", "honour", "heir", "herb"];

/** Heuristic: does text start with a vowel sound? */
function startsWithVowelSound(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return false;
  const firstWord = trimmed.split(/\s/)[0].toLowerCase();
  for (const prefix of CONSONANT_SOUND_VOWEL_PREFIXES) {
    if (firstWord.startsWith(prefix)) return false;
  }
  for (const prefix of VOWEL_SOUND_CONSONANT_PREFIXES) {
    if (firstWord.startsWith(prefix)) return true;
  }
  return "aeiou".includes(firstWord[0]);
}

interface AdjustedReplacement {
  position: number;
  originalLength: number;
  replacement: string;
}

/**
 * Adjust a replacement for grammar given its surrounding context.
 * Applies deterministic rules for article deduplication, case echo,
 * mid-sentence lowercasing, a/an agreement, and possessive transfer.
 */
interface GrammarState {
  position: number;
  originalLength: number;
  replacement: string;
}

function applyCaseEcho(state: GrammarState, casePattern: CasePattern): void {
  if (casePattern === "allCaps") {
    state.replacement = state.replacement.toUpperCase();
  } else if (casePattern === "allLower") {
    state.replacement = state.replacement.toLowerCase();
  }
}

function applyArticleDeduplication(
  state: GrammarState,
  matchPosition: number,
  matchedTextLength: number,
  precedingArticle: PrecedingArticle | null
): boolean {
  const startsWithThe = /^the\s/i.test(state.replacement);
  if (!startsWithThe || !precedingArticle) return false;

  const theMatch = state.replacement.match(/^(the\s+)/i);
  if (!theMatch) return false;
  const thePrefix = theMatch[0];
  const withoutThe = state.replacement.slice(thePrefix.length);

  if (precedingArticle.normalized === "the") {
    state.replacement = withoutThe;
  } else {
    state.position = matchPosition - precedingArticle.length;
    state.originalLength = matchedTextLength + precedingArticle.length;
    const wasCapitalized = /^[A-Z]/.test(precedingArticle.text);
    state.replacement = (wasCapitalized ? "The " : "the ") + withoutThe;
  }
  return true;
}

function applyMidSentenceArticleLowercasing(state: GrammarState): void {
  const articleMatch = state.replacement.match(/^(The|A|An)\b/);
  if (articleMatch) {
    state.replacement = articleMatch[1].toLowerCase() + state.replacement.slice(articleMatch[1].length);
  }
}

function applyAAnAgreement(
  state: GrammarState,
  matchPosition: number,
  matchedTextLength: number,
  precedingArticle: PrecedingArticle
): void {
  const needsAn = startsWithVowelSound(state.replacement);
  const hasAn = precedingArticle.normalized === "an";
  if (needsAn === hasAn) return;

  const correctArticle = needsAn ? "an" : "a";
  const wasCapitalized = /^[A-Z]/.test(precedingArticle.text);
  const casedArticle = wasCapitalized
    ? correctArticle[0].toUpperCase() + correctArticle.slice(1)
    : correctArticle;

  state.position = matchPosition - precedingArticle.length;
  state.originalLength = matchedTextLength + precedingArticle.length;
  state.replacement = casedArticle + " " + state.replacement;
}

function applyPossessiveTransfer(state: GrammarState, rawAfter: string): void {
  const possessiveMatch = rawAfter.match(
    /^(?:'\u0073|\u2019s|'(?=[^a-zA-Z]|$)|\u2019(?=[^a-zA-Z]|$))/
  );
  if (!possessiveMatch) return;

  const possessiveText = possessiveMatch[0];
  const alreadyPossessive =
    state.replacement.endsWith("'s") ||
    state.replacement.endsWith("\u2019s") ||
    state.replacement.endsWith("'") ||
    state.replacement.endsWith("\u2019");

  if (alreadyPossessive) return;

  state.originalLength += possessiveText.length;
  const lastChar = state.replacement[state.replacement.length - 1]?.toLowerCase() ?? "";
  const useBareSuffix = lastChar === "s" || lastChar === "x" || lastChar === "z";
  const apostrophe = possessiveText.includes("\u2019") ? "\u2019" : "'";
  state.replacement += useBareSuffix ? apostrophe : apostrophe + "s";
}

export function adjustReplacementForGrammar(
  contextBefore: string,
  contextAfter: string,
  matchPosition: number,
  matchedText: string,
  replacement: string
): AdjustedReplacement {
  const state: GrammarState = {
    position: matchPosition,
    originalLength: matchedText.length,
    replacement,
  };

  const rawBefore = rawCtxBefore(contextBefore);
  const rawAfter = rawCtxAfter(contextAfter);
  const sentenceStart = isAtSentenceStart(rawBefore);
  const casePattern = detectCasePattern(matchedText);

  applyCaseEcho(state, casePattern);

  const precedingArticle = findPrecedingArticle(rawBefore);
  const replacementStartsWithThe = /^the\s/i.test(state.replacement);
  const articleAbsorbed = applyArticleDeduplication(state, matchPosition, matchedText.length, precedingArticle);

  if (!sentenceStart && casePattern !== "allCaps" && !articleAbsorbed) {
    applyMidSentenceArticleLowercasing(state);
  }

  if (
    precedingArticle &&
    !replacementStartsWithThe &&
    !articleAbsorbed &&
    (precedingArticle.normalized === "a" || precedingArticle.normalized === "an")
  ) {
    applyAAnAgreement(state, matchPosition, matchedText.length, precedingArticle);
  }

  applyPossessiveTransfer(state, rawAfter);

  return { position: state.position, originalLength: state.originalLength, replacement: state.replacement };
}

// ---------------------------------------------------------------------------
// Patch building
// ---------------------------------------------------------------------------

export interface FieldReplacement {
  position: number;
  originalLength: number;
  replacement: string;
}

/**
 * Apply a set of replacements to a text string. Replacements must not overlap
 * and are applied in reverse order to preserve positions.
 */
export function applyReplacements(text: string, replacements: FieldReplacement[]): string {
  // Sort by position descending so earlier positions aren't shifted
  const sorted = [...replacements].sort((a, b) => b.position - a.position);
  let result = text;
  for (const r of sorted) {
    result =
      result.slice(0, r.position) + r.replacement + result.slice(r.position + r.originalLength);
  }
  return result;
}

/**
 * Build concrete patches from scan results and user decisions.
 */
function processChronicleMetadataMatch(
  meta: Partial<ChronicleRecord>,
  field: string,
  replacementText: string
): void {
  if (field.startsWith("roleAssignments[")) {
    const idxMatch = field.match(/\[(\d+)\]/);
    if (idxMatch) {
      const idx = parseInt(idxMatch[1], 10);
      if (!meta.roleAssignments) {
        meta._roleAssignmentUpdates = meta._roleAssignmentUpdates || [];
        (meta as any)._roleAssignmentUpdates.push({ index: idx, entityName: replacementText });
      }
    }
  } else if (field === "lens.entityName") {
    (meta as any)._lensNameUpdate = replacementText;
  } else if (field.startsWith("generationContext.entityDirectives[")) {
    const idxMatch = field.match(/\[(\d+)\]/);
    if (idxMatch) {
      const idx = parseInt(idxMatch[1], 10);
      (meta as any)._directiveUpdates = (meta as any)._directiveUpdates || [];
      (meta as any)._directiveUpdates.push({ index: idx, entityName: replacementText });
    }
  }
}

function computeReplacement(match: RenameMatch, decision: MatchDecision, newName: string): FieldReplacement {
  const replacementText = decision.action === "edit" ? (decision.editText ?? newName) : newName;
  const isEdit = decision.action === "edit";
  const adjusted = isEdit
    ? { position: match.position, originalLength: match.matchedText.length, replacement: replacementText }
    : adjustReplacementForGrammar(match.contextBefore, match.contextAfter, match.position, match.matchedText, replacementText);
  return { position: adjusted.position, originalLength: adjusted.originalLength, replacement: adjusted.replacement };
}

function appendReplacementToMap(
  patchMap: Map<string, Record<string, any>>,
  sourceId: string,
  field: string,
  replacement: FieldReplacement,
  serialize: boolean
): void {
  const existing = patchMap.get(sourceId) || {};
  const rKey = `__replacements_${field}`;
  if (serialize) {
    const list: FieldReplacement[] = existing[rKey] ? JSON.parse(existing[rKey]) : [];
    list.push(replacement);
    existing[rKey] = JSON.stringify(list);
  } else {
    const list: FieldReplacement[] = (existing[rKey] as FieldReplacement[]) || [];
    list.push(replacement);
    existing[rKey] = list;
  }
  patchMap.set(sourceId, existing);
}

export function buildRenamePatches(
  scanResult: RenameScanResult,
  newName: string,
  decisions: MatchDecision[]
): RenamePatches {
  const decisionMap = new Map(decisions.map((d) => [d.matchId, d]));

  const entityPatchMap = new Map<string, Record<string, any>>();
  const chroniclePatchMap = new Map<string, Record<string, any>>();
  const eventPatchMap = new Map<string, Record<string, any>>();
  const chronicleMetaUpdates = new Map<string, Partial<ChronicleRecord>>();
  const eventMetaUpdates = new Map<string, Record<string, string>>();

  for (const match of scanResult.matches) {
    const decision = decisionMap.get(match.id);
    if (!decision || decision.action === "reject") continue;

    const replacementText = decision.action === "edit" ? (decision.editText ?? newName) : newName;

    if (match.matchType === "metadata") {
      if (match.sourceType === "event") {
        const meta = eventMetaUpdates.get(match.sourceId) || {};
        meta[match.field] = replacementText;
        eventMetaUpdates.set(match.sourceId, meta);
      } else {
        const meta = chronicleMetaUpdates.get(match.sourceId) || {};
        processChronicleMetadataMatch(meta, match.field, replacementText);
        chronicleMetaUpdates.set(match.sourceId, meta);
      }
    } else {
      const replacement = computeReplacement(match, decision, newName);

      if (match.sourceType === "entity") {
        appendReplacementToMap(entityPatchMap, match.sourceId, match.field, replacement, true);
      } else if (match.sourceType === "chronicle") {
        appendReplacementToMap(chroniclePatchMap, match.sourceId, match.field, replacement, false);
      } else if (match.sourceType === "event") {
        appendReplacementToMap(eventPatchMap, match.sourceId, match.field, replacement, true);
      }
    }
  }

  // Merge metadata updates into chronicle patches
  for (const [chronicleId, meta] of chronicleMetaUpdates) {
    const existing = chroniclePatchMap.get(chronicleId) || {};
    Object.assign(existing, meta);
    chroniclePatchMap.set(chronicleId, existing);
  }

  for (const [eventId, meta] of eventMetaUpdates) {
    const existing = eventPatchMap.get(eventId) || {};
    Object.assign(existing, meta);
    eventPatchMap.set(eventId, existing);
  }

  return {
    entityPatches: [...entityPatchMap].map(([entityId, changes]) => ({ entityId, changes })),
    chroniclePatches: [...chroniclePatchMap].map(([chronicleId, fieldUpdates]) => ({
      chronicleId,
      fieldUpdates,
    })),
    eventPatches: [...eventPatchMap].map(([eventId, changes]) => ({ eventId, changes })),
  };
}

// ---------------------------------------------------------------------------
// Apply helpers
// ---------------------------------------------------------------------------

/**
 * Apply entity patches to an entity array. Returns a new array with patches applied.
 * Handles summary, description, and enrichment.descriptionHistory text replacements.
 */
export function applyEntityPatches<T extends ScanEntity>(
  entities: T[],
  patches: EntityPatch[],
  targetEntityId: string | null,
  newName: string
): T[] {
  const patchMap = new Map(patches.map((p) => [p.entityId, p]));

  return entities.map((entity) => {
    // The target entity always gets its name updated, even without a text patch
    const isTarget = entity.id === targetEntityId;
    const patch = patchMap.get(entity.id);
    if (!patch && !isTarget) return entity;

    const updated = { ...entity };

    if (isTarget) {
      updated.name = newName;
      // Store the entity ID as a slug alias so deep links using the old
      // ID-based slug still resolve after the name changes. The chronicler's
      // bySlug map indexes these for URL resolution.
      const existingAliases = (entity as any).enrichment?.slugAliases || [];
      if (!existingAliases.includes(entity.id)) {
        if (!updated.enrichment) updated.enrichment = { ...(entity as any).enrichment };
        (updated as any).enrichment.slugAliases = [...existingAliases, entity.id];
      }
    }

    if (!patch) return updated;

    // Apply text replacements
    for (const [key, value] of Object.entries(patch.changes)) {
      if (!key.startsWith("__replacements_")) continue;
      const field = key.replace("__replacements_", "");
      const replacements: FieldReplacement[] = JSON.parse(value);

      if (field === "summary" || field === "description" || field === "narrativeHint") {
        const originalText = (entity as any)[field];
        if (typeof originalText === "string") {
          (updated as any)[field] = applyReplacements(originalText, replacements);
        }
      } else if (field.startsWith("enrichment.descriptionHistory[")) {
        // Parse index from: enrichment.descriptionHistory[N].description
        const idxMatch = field.match(/\[(\d+)\]/);
        if (idxMatch && entity.enrichment?.descriptionHistory) {
          const idx = parseInt(idxMatch[1], 10);
          // Shallow-copy enrichment chain on first write
          if (!updated.enrichment || updated.enrichment === entity.enrichment) {
            updated.enrichment = { ...entity.enrichment };
          }
          if (
            !updated.enrichment.descriptionHistory ||
            updated.enrichment.descriptionHistory === entity.enrichment.descriptionHistory
          ) {
            updated.enrichment.descriptionHistory = [...entity.enrichment.descriptionHistory];
          }
          const entry = updated.enrichment.descriptionHistory[idx];
          if (entry) {
            updated.enrichment.descriptionHistory[idx] = {
              ...entry,
              description: applyReplacements(entry.description, replacements),
            };
          }
        }
      }
    }

    return updated;
  });
}

/**
 * Apply chronicle patches. Reads each chronicle from IDB, applies changes, writes back.
 * Returns the number of successfully updated chronicles.
 */
export async function applyChroniclePatches(
  patches: ChroniclePatch[],
  getChronicle: (id: string) => Promise<ChronicleRecord | undefined>,
  putChronicle: (record: ChronicleRecord) => Promise<void>
): Promise<number> {
  let successCount = 0;

  for (const patch of patches) {
    try {
      const chronicle = await getChronicle(patch.chronicleId);
      if (!chronicle) {
        console.warn(`[EntityRename] Chronicle not found: ${patch.chronicleId}`);
        continue;
      }

      const updated = { ...chronicle };

      // Apply metadata updates
      if ((patch.fieldUpdates as any)._roleAssignmentUpdates) {
        const updates: Array<{ index: number; entityName: string }> = (patch.fieldUpdates as any)
          ._roleAssignmentUpdates;
        updated.roleAssignments = [...chronicle.roleAssignments];
        for (const u of updates) {
          if (updated.roleAssignments[u.index]) {
            updated.roleAssignments[u.index] = {
              ...updated.roleAssignments[u.index],
              entityName: u.entityName,
            };
          }
        }
      }

      if ((patch.fieldUpdates as any)._lensNameUpdate && chronicle.lens) {
        updated.lens = {
          ...chronicle.lens,
          entityName: (patch.fieldUpdates as any)._lensNameUpdate,
        };
      }

      if (
        (patch.fieldUpdates as any)._directiveUpdates &&
        chronicle.generationContext?.entityDirectives
      ) {
        const updates: Array<{ index: number; entityName: string }> = (patch.fieldUpdates as any)
          ._directiveUpdates;
        updated.generationContext = {
          ...chronicle.generationContext,
          entityDirectives: [...chronicle.generationContext.entityDirectives],
        };
        for (const u of updates) {
          if (updated.generationContext.entityDirectives[u.index]) {
            updated.generationContext.entityDirectives[u.index] = {
              ...updated.generationContext.entityDirectives[u.index],
              entityName: u.entityName,
            };
          }
        }
      }

      // Apply text field replacements
      for (const [key, value] of Object.entries(patch.fieldUpdates)) {
        if (!key.startsWith("__replacements_")) continue;
        const field = key.replace("__replacements_", "");
        const replacements = value as FieldReplacement[];

        if (field.startsWith("generationHistory.")) {
          // Handle generation history versions
          const versionId = field.replace("generationHistory.", "");
          if (updated.generationHistory) {
            updated.generationHistory = updated.generationHistory.map((v) => {
              if (v.versionId === versionId) {
                return { ...v, content: applyReplacements(v.content, replacements) };
              }
              return v;
            });
          }
        } else if (field === "assembledContent" && typeof updated.assembledContent === "string") {
          updated.assembledContent = applyReplacements(updated.assembledContent, replacements);
        } else if (field === "finalContent" && typeof updated.finalContent === "string") {
          updated.finalContent = applyReplacements(updated.finalContent, replacements);
        } else if (field === "summary" && typeof updated.summary === "string") {
          updated.summary = applyReplacements(updated.summary, replacements);
        }
      }

      updated.updatedAt = Date.now();
      await putChronicle(updated);
      successCount++;
    } catch (err) {
      console.error(`[EntityRename] Failed to update chronicle ${patch.chronicleId}:`, err);
    }
  }

  return successCount;
}

/**
 * Apply narrative event patches to an event array. Returns a new array with patches applied.
 * Handles both structured name fields (metadata) and text replacements.
 */
export function applyNarrativeEventPatches<T extends ScanNarrativeEvent>(
  events: T[],
  patches: EventPatch[]
): T[] {
  if (patches.length === 0) return events;

  const patchMap = new Map(patches.map((p) => [p.eventId, p]));

  return events.map((event) => {
    const patch = patchMap.get(event.id);
    if (!patch) return event;

    const updated: any = { ...event };

    for (const [key, value] of Object.entries(patch.changes)) {
      if (key.startsWith("__replacements_")) {
        // Text field replacements
        const field = key.replace("__replacements_", "");
        const replacements: FieldReplacement[] = JSON.parse(value);

        if (field === "description" && typeof updated.description === "string") {
          updated.description = applyReplacements(updated.description, replacements);
        } else if (field === "action" && typeof updated.action === "string") {
          updated.action = applyReplacements(updated.action, replacements);
        } else if (field.startsWith("participantEffects[")) {
          // Parse: participantEffects[N].effects[M].description
          const idxMatch = field.match(
            /participantEffects\[(\d+)\]\.effects\[(\d+)\]\.description/
          );
          if (idxMatch) {
            const pi = parseInt(idxMatch[1], 10);
            const ei = parseInt(idxMatch[2], 10);
            if (
              !updated.participantEffects ||
              updated.participantEffects === event.participantEffects
            ) {
              updated.participantEffects = [...event.participantEffects];
            }
            if (updated.participantEffects[pi]) {
              const pe = { ...updated.participantEffects[pi] };
              if (pe.effects === event.participantEffects[pi].effects) {
                pe.effects = [...event.participantEffects[pi].effects];
              }
              if (pe.effects[ei]) {
                pe.effects[ei] = {
                  ...pe.effects[ei],
                  description: applyReplacements(pe.effects[ei].description, replacements),
                };
              }
              updated.participantEffects[pi] = pe;
            }
          }
        }
      } else if (key === "subject.name") {
        // Structured name field: subject.name
        updated.subject = { ...event.subject, name: value };
      } else if (key.startsWith("participantEffects[")) {
        // Structured name: participantEffects[N].entity.name or participantEffects[N].effects[M].relatedEntity.name
        if (
          !updated.participantEffects ||
          updated.participantEffects === event.participantEffects
        ) {
          updated.participantEffects = [...event.participantEffects];
        }

        const entityNameMatch = key.match(/^participantEffects\[(\d+)\]\.entity\.name$/);
        if (entityNameMatch) {
          const pi = parseInt(entityNameMatch[1], 10);
          if (updated.participantEffects[pi]) {
            updated.participantEffects[pi] = {
              ...updated.participantEffects[pi],
              entity: { ...updated.participantEffects[pi].entity, name: value },
            };
          }
        }

        const relatedMatch = key.match(
          /^participantEffects\[(\d+)\]\.effects\[(\d+)\]\.relatedEntity\.name$/
        );
        if (relatedMatch) {
          const pi = parseInt(relatedMatch[1], 10);
          const ei = parseInt(relatedMatch[2], 10);
          if (updated.participantEffects[pi]) {
            const pe = { ...updated.participantEffects[pi] };
            if (pe.effects === event.participantEffects[pi]?.effects) {
              pe.effects = [...event.participantEffects[pi].effects];
            }
            if (pe.effects[ei]?.relatedEntity) {
              pe.effects[ei] = {
                ...pe.effects[ei],
                relatedEntity: { ...pe.effects[ei].relatedEntity!, name: value },
              };
            }
            updated.participantEffects[pi] = pe;
          }
        }
      }
    }

    return updated as T;
  });
}

// ---------------------------------------------------------------------------
// Brute-force narrative history patch (for repairing already-broken data)
// ---------------------------------------------------------------------------

/**
 * Case-insensitive replace of `oldName` with `newName` in a string.
 * Preserves surrounding text.
 */
function replaceAllCaseInsensitive(text: string, oldName: string, newName: string): string {
  if (!text || !oldName) return text;
  // Escape regex special chars in oldName
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), newName);
}

/**
 * Brute-force patch of all narrative events for a single entity rename.
 *
 * Unlike the scan-based approach (which uses position-based replacements and
 * per-match decisions), this function does a simple find-and-replace across
 * ALL name fields and text fields in every event where the entity appears.
 *
 * Use this to repair data that was missed by a previous rename, or as a
 * one-shot fix when you don't need per-match granularity.
 *
 * @returns { events: patched array, patchCount: number of events modified }
 */
export function patchNarrativeHistory<T extends ScanNarrativeEvent>(
  events: T[],
  entityId: string,
  oldName: string,
  newName: string
): { events: T[]; patchCount: number } {
  let patchCount = 0;

  const patched = events.map((event) => {
    // Quick check: is this entity involved at all?
    const isSubject = event.subject.id === entityId;
    const participantIdx = event.participantEffects.findIndex((pe) => pe.entity.id === entityId);
    // Also check if old name appears anywhere in the event text
    const hasTextMatch =
      event.description.toLowerCase().includes(oldName.toLowerCase()) ||
      event.action.toLowerCase().includes(oldName.toLowerCase());

    const hasRelatedRef = event.participantEffects.some((pe) =>
      pe.effects.some((eff) => eff.relatedEntity?.id === entityId)
    );

    if (!isSubject && participantIdx === -1 && !hasTextMatch && !hasRelatedRef) {
      return event;
    }

    let didChange = false;
    const updated: any = { ...event };

    // Patch subject.name
    if (isSubject && event.subject.name !== newName) {
      updated.subject = { ...event.subject, name: newName };
      didChange = true;
    }

    // Patch participantEffects
    const newPE = [...event.participantEffects];
    for (let pi = 0; pi < newPE.length; pi++) {
      const pe = newPE[pi];
      let peChanged = false;
      let updatedPE: any = pe;

      // Participant entity.name
      if (pe.entity.id === entityId && pe.entity.name !== newName) {
        updatedPE = { ...pe, entity: { ...pe.entity, name: newName } };
        peChanged = true;
      }

      // Effects
      const newEffects = [...(updatedPE.effects || pe.effects)];
      for (let ei = 0; ei < newEffects.length; ei++) {
        const eff = newEffects[ei];
        let effChanged = false;
        let updatedEff: any = eff;

        // relatedEntity.name
        if (eff.relatedEntity?.id === entityId && eff.relatedEntity.name !== newName) {
          updatedEff = { ...eff, relatedEntity: { ...eff.relatedEntity, name: newName } };
          effChanged = true;
        }

        // effect.description (free text)
        const patchedDesc = replaceAllCaseInsensitive(updatedEff.description, oldName, newName);
        if (patchedDesc !== updatedEff.description) {
          updatedEff = { ...(effChanged ? updatedEff : eff), description: patchedDesc };
          effChanged = true;
        }

        if (effChanged) {
          newEffects[ei] = updatedEff;
          peChanged = true;
        }
      }

      if (peChanged) {
        updatedPE = { ...(updatedPE === pe ? pe : updatedPE), effects: newEffects };
        newPE[pi] = updatedPE;
        didChange = true;
      }
    }

    if (didChange) {
      updated.participantEffects = newPE;
    }

    // Patch top-level text fields
    const patchedDesc = replaceAllCaseInsensitive(
      updated.description || event.description,
      oldName,
      newName
    );
    if (patchedDesc !== (updated.description || event.description)) {
      updated.description = patchedDesc;
      didChange = true;
    }

    const patchedAction = replaceAllCaseInsensitive(
      updated.action || event.action,
      oldName,
      newName
    );
    if (patchedAction !== (updated.action || event.action)) {
      updated.action = patchedAction;
      didChange = true;
    }

    if (didChange) {
      patchCount++;
      return updated as T;
    }
    return event;
  });

  return { events: patched, patchCount };
}
