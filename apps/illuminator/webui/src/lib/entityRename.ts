/**
 * Entity Rename - Core scan and replacement logic
 *
 * Scans all entities and chronicles for references to an entity name,
 * including partial name matches. Uses the same normalization approach
 * as wikiLinkService.ts (lowercase ASCII slug, word-boundary matching).
 */

import type { ChronicleRecord } from './db/chronicleRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How closely related this match source is to the entity being renamed. */
export type MatchTier = 'self' | 'related' | 'cast' | 'participant' | 'mention' | 'general';

export interface RenameMatch {
  /** Unique match ID */
  id: string;
  /** Where the match was found */
  sourceType: 'entity' | 'chronicle' | 'event';
  /** Entity ID, chronicle ID, or event ID */
  sourceId: string;
  /** Entity name, chronicle title, or event description snippet (for display) */
  sourceName: string;
  /** Which field contains the match */
  field: string;
  /** full = complete name, partial = sub-sequence, metadata = denormalized field, id_slug = entity ID reference */
  matchType: 'full' | 'partial' | 'metadata' | 'id_slug';
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
  action: 'accept' | 'reject' | 'edit';
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
      normalizedChars.push('-');
      indexMap.push(i);
      prevSeparator = true;
    }
  }

  while (normalizedChars.length > 0 && normalizedChars[0] === '-') {
    normalizedChars.shift();
    indexMap.shift();
  }
  while (
    normalizedChars.length > 0 &&
    normalizedChars[normalizedChars.length - 1] === '-'
  ) {
    normalizedChars.pop();
    indexMap.pop();
  }

  return { normalized: normalizedChars.join(''), indexMap };
}

function normalizeSlug(text: string): string {
  return normalizeForMatch(text).normalized;
}

// ---------------------------------------------------------------------------
// Partial name generation
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'but', 'is', 'was', 'are', 'were', 'be', 'been', 'by', 'with', 'from',
  'as', 'its', 'that', 'this', 'it', 'no', 'not',
]);

/**
 * Generate all meaningful sub-sequences of a name for partial matching.
 * Returns slugs sorted longest-first so longer matches take priority.
 */
function generatePartials(name: string): string[] {
  // Split on non-alpha-numeric to get raw words
  const words = name
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0);

  if (words.length <= 1) return [];

  const partials = new Set<string>();
  const fullSlug = normalizeSlug(name);

  // Generate all contiguous sub-sequences of words
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      const fragment = words.slice(start, end).join(' ');
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
 * Find all occurrences of `slug` in `text` on word boundaries.
 * Returns positions mapped back to the original text.
 */
function findAllOccurrences(
  slug: string,
  normalizedText: string,
  indexMap: number[],
  originalText: string,
): RawMatch[] {
  if (!slug || !normalizedText) return [];

  const matches: RawMatch[] = [];
  let searchFrom = 0;

  while (searchFrom <= normalizedText.length - slug.length) {
    const idx = normalizedText.indexOf(slug, searchFrom);
    if (idx === -1) break;

    const matchEnd = idx + slug.length;

    // Check word boundaries
    const beforeOk = idx === 0 || normalizedText[idx - 1] === '-';
    const afterOk = matchEnd === normalizedText.length || normalizedText[matchEnd] === '-';

    if (beforeOk && afterOk) {
      const rawStart = indexMap[idx];
      // For end: find the last char of the match in the original text
      // The indexMap entry at matchEnd-1 is the last matched normalized char.
      // We need to extend to include any trailing non-normalized chars that belong to this word.
      const lastNormIdx = matchEnd - 1;
      let rawEnd = indexMap[lastNormIdx] + 1;
      // Extend past any non-ASCII/non-alpha trailing chars that are part of the same "word"
      // (e.g., decorative chars like ~ or ]) but stop at possessive markers ('s)
      // and whitespace or the next word
      while (rawEnd < originalText.length) {
        const ch = originalText[rawEnd];
        if (/\s/.test(ch)) break;
        // If the next char is a letter/number, we've hit the next word - stop
        if (isAsciiAlphaNumeric(ch.toLowerCase())) break;
        // Stop at apostrophes — trailing apostrophes are grammatical (possessive/
        // contraction), not part of the entity name. Apostrophes *within* names
        // (e.g. O'Brien) are already captured via the indexMap within the match span.
        if (ch === "'" || ch === '\u2019') break;
        // Include trailing non-alphanumeric, non-space chars (like ~ or ])
        rawEnd++;
      }

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
  contextSize: number = 60,
): { before: string; after: string } {
  const beforeStart = Math.max(0, start - contextSize);
  const afterEnd = Math.min(text.length, end + contextSize);

  let before = text.slice(beforeStart, start);
  let after = text.slice(end, afterEnd);

  if (beforeStart > 0) before = '...' + before;
  if (afterEnd < text.length) after = after + '...';

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

/**
 * Scan all entities and chronicles for references to the given entity name.
 * Also surfaces all foreign-key references to the entity ID (relationships,
 * chronicle selectedEntityIds, etc.) so the user can verify completeness.
 */
export async function scanForReferences(
  entityId: string,
  oldName: string,
  entities: ScanEntity[],
  chronicles: ChronicleRecord[],
  relationships?: ScanRelationship[],
  narrativeEvents?: ScanNarrativeEvent[],
): Promise<RenameScanResult> {
  matchIdCounter = 0;
  const matches: RenameMatch[] = [];
  const fullSlug = normalizeSlug(oldName);
  const partialSlugs = generatePartials(oldName);

  // Current tier label — set before each scan pass, read by match-push sites.
  let currentTier: MatchTier = 'general';

  // Track positions covered by full matches to exclude from partial results
  // Key: `${sourceType}:${sourceId}:${field}`, Value: Set of `${start}:${end}`
  const coveredPositions = new Map<string, Set<string>>();

  function markCovered(key: string, start: number, end: number) {
    let set = coveredPositions.get(key);
    if (!set) {
      set = new Set();
      coveredPositions.set(key, set);
    }
    set.add(`${start}:${end}`);
  }

  function isOverlapping(key: string, start: number, end: number): boolean {
    const set = coveredPositions.get(key);
    if (!set) return false;
    for (const entry of set) {
      const [cs, ce] = entry.split(':').map(Number);
      // Overlap if ranges intersect
      if (start < ce && end > cs) return true;
    }
    return false;
  }

  function scanTextField(
    sourceType: 'entity' | 'chronicle' | 'event',
    sourceId: string,
    sourceName: string,
    field: string,
    text: string | undefined | null,
  ) {
    if (!text) return;

    const { normalized, indexMap } = normalizeForMatch(text);
    const posKey = `${sourceType}:${sourceId}:${field}`;

    // Full name matches
    const fullMatches = findAllOccurrences(fullSlug, normalized, indexMap, text);
    for (const m of fullMatches) {
      const ctx = extractContext(text, m.start, m.end);
      markCovered(posKey, m.start, m.end);
      matches.push({
        id: nextMatchId(),
        sourceType,
        sourceId,
        sourceName,
        field,
        matchType: 'full',
        matchedText: m.matchedText,
        position: m.start,
        contextBefore: ctx.before,
        contextAfter: ctx.after,
        tier: currentTier,
      });
    }

    // Partial matches
    for (const partialSlug of partialSlugs) {
      const partialMatches = findAllOccurrences(partialSlug, normalized, indexMap, text);
      for (const m of partialMatches) {
        if (isOverlapping(posKey, m.start, m.end)) continue;
        const ctx = extractContext(text, m.start, m.end);
        markCovered(posKey, m.start, m.end);
        matches.push({
          id: nextMatchId(),
          sourceType,
          sourceId,
          sourceName,
          field,
          matchType: 'partial',
          matchedText: m.matchedText,
          position: m.start,
          contextBefore: ctx.before,
          contextAfter: ctx.after,
          partialFragment: partialSlug,
          tier: currentTier,
        });
      }
    }
  }

  // Scan uses a tiered approach based on hard FK links:
  //
  // 1. SELF: The entity's own summary/description/descriptionHistory (full + partial)
  // 2. RELATED: Entities with relationships to this entity (full + partial)
  //    Found via hard relationship FK lookup, not blind text search.
  // 3. CAST CHRONICLES: Chronicles where this entity is a cast member (full + partial)
  //    Found via selectedEntityIds FK, plus metadata (roleAssignments, lens, directives).
  // 4. GENERAL: All other entities and chronicles (FULL NAME ONLY, no partials)
  //    Avoids noise from common word fragments like "amulet" appearing everywhere.
  //
  // FK references (relationships, chronicle cast) are shown as non-actionable
  // id_slug matches so the user can audit whether the sweep was comprehensive.

  const entityById = new Map(entities.map((e) => [e.id, e]));

  // --- Build related entity set from relationships ---
  const relatedEntityIds = new Set<string>();
  if (relationships) {
    for (const rel of relationships) {
      if (rel.src === entityId) relatedEntityIds.add(rel.dst);
      if (rel.dst === entityId) relatedEntityIds.add(rel.src);
    }
  }

  // --- Build cast chronicle set from selectedEntityIds ---
  const castChronicleIds = new Set<string>();
  for (const chronicle of chronicles) {
    if (chronicle.selectedEntityIds?.includes(entityId)) {
      castChronicleIds.add(chronicle.chronicleId);
    }
  }

  // --- Helper: scan all entity text fields (summary, description, narrativeHint, descriptionHistory) ---
  function scanEntityTextFields(
    entity: ScanEntity,
    scanFn: (
      sourceType: 'entity' | 'chronicle' | 'event',
      sourceId: string,
      sourceName: string,
      field: string,
      text: string | undefined | null,
    ) => void,
  ) {
    scanFn('entity', entity.id, entity.name, 'summary', entity.summary);
    scanFn('entity', entity.id, entity.name, 'description', entity.description);
    scanFn('entity', entity.id, entity.name, 'narrativeHint', entity.narrativeHint);
    if (entity.enrichment?.descriptionHistory) {
      for (let i = 0; i < entity.enrichment.descriptionHistory.length; i++) {
        scanFn(
          'entity', entity.id, entity.name,
          `enrichment.descriptionHistory[${i}].description`,
          entity.enrichment.descriptionHistory[i].description,
        );
      }
    }
  }

  // --- Full + partial scan (for self, related, cast) ---
  function scanTextFieldFullAndPartial(
    sourceType: 'entity' | 'chronicle' | 'event',
    sourceId: string,
    sourceName: string,
    field: string,
    text: string | undefined | null,
  ) {
    scanTextField(sourceType, sourceId, sourceName, field, text);
  }

  // --- Full name only scan (for general sweep) ---
  function scanTextFieldFullNameOnly(
    sourceType: 'entity' | 'chronicle' | 'event',
    sourceId: string,
    sourceName: string,
    field: string,
    text: string | undefined | null,
  ) {
    if (!text) return;

    const { normalized, indexMap } = normalizeForMatch(text);
    const posKey = `${sourceType}:${sourceId}:${field}`;

    const fullMatches = findAllOccurrences(fullSlug, normalized, indexMap, text);
    for (const m of fullMatches) {
      if (isOverlapping(posKey, m.start, m.end)) continue;
      const ctx = extractContext(text, m.start, m.end);
      markCovered(posKey, m.start, m.end);
      matches.push({
        id: nextMatchId(),
        sourceType,
        sourceId,
        sourceName,
        field,
        matchType: 'full',
        matchedText: m.matchedText,
        position: m.start,
        contextBefore: ctx.before,
        contextAfter: ctx.after,
        tier: currentTier,
      });
    }
  }

  // =========================================================================
  // 1. SELF: The renamed entity's own fields (full + partial)
  // =========================================================================
  currentTier = 'self';
  const selfEntity = entityById.get(entityId);
  if (selfEntity) {
    scanEntityTextFields(selfEntity, scanTextFieldFullAndPartial);
  }

  // =========================================================================
  // 2. RELATED: Entities connected via relationship FK (full + partial)
  // =========================================================================
  currentTier = 'related';
  for (const relEntityId of relatedEntityIds) {
    const relEntity = entityById.get(relEntityId);
    if (!relEntity) continue;
    scanEntityTextFields(relEntity, scanTextFieldFullAndPartial);
  }

  // =========================================================================
  // 3. CAST CHRONICLES: Chronicles where entity is a cast member (full + partial + metadata)
  // =========================================================================
  currentTier = 'cast';
  for (const chronicle of chronicles) {
    if (!castChronicleIds.has(chronicle.chronicleId)) continue;

    const cId = chronicle.chronicleId;
    const cTitle = chronicle.title;

    // Metadata matches (denormalized entityName fields)
    if (chronicle.roleAssignments) {
      for (let i = 0; i < chronicle.roleAssignments.length; i++) {
        const ra = chronicle.roleAssignments[i];
        if (ra.entityId === entityId) {
          matches.push({
            id: nextMatchId(),
            sourceType: 'chronicle',
            sourceId: cId,
            sourceName: cTitle,
            field: `roleAssignments[${i}].entityName`,
            matchType: 'metadata',
            matchedText: ra.entityName,
            position: 0,
            contextBefore: `Role: ${ra.role}`,
            contextAfter: `(${ra.entityKind})`,
            tier: currentTier,
          });
        }
      }
    }

    if (chronicle.lens && chronicle.lens.entityId === entityId) {
      matches.push({
        id: nextMatchId(),
        sourceType: 'chronicle',
        sourceId: cId,
        sourceName: cTitle,
        field: 'lens.entityName',
        matchType: 'metadata',
        matchedText: chronicle.lens.entityName,
        position: 0,
        contextBefore: 'Lens:',
        contextAfter: `(${chronicle.lens.entityKind})`,
        tier: currentTier,
      });
    }

    if (chronicle.generationContext?.entityDirectives) {
      for (let i = 0; i < chronicle.generationContext.entityDirectives.length; i++) {
        const ed = chronicle.generationContext.entityDirectives[i];
        if (ed.entityId === entityId) {
          matches.push({
            id: nextMatchId(),
            sourceType: 'chronicle',
            sourceId: cId,
            sourceName: cTitle,
            field: `generationContext.entityDirectives[${i}].entityName`,
            matchType: 'metadata',
            matchedText: ed.entityName,
            position: 0,
            contextBefore: 'Directive:',
            contextAfter: ed.directive.slice(0, 40) + (ed.directive.length > 40 ? '...' : ''),
            tier: currentTier,
          });
        }
      }
    }

    // Text field matches (full + partial since this entity is in the cast)
    scanTextFieldFullAndPartial('chronicle', cId, cTitle, 'assembledContent', chronicle.assembledContent);
    scanTextFieldFullAndPartial('chronicle', cId, cTitle, 'finalContent', chronicle.finalContent);
    scanTextFieldFullAndPartial('chronicle', cId, cTitle, 'summary', chronicle.summary);

    if (chronicle.generationHistory) {
      for (const version of chronicle.generationHistory) {
        scanTextFieldFullAndPartial(
          'chronicle', cId, cTitle,
          `generationHistory.${version.versionId}`,
          version.content,
        );
      }
    }
  }

  // =========================================================================
  // 4. GENERAL SWEEP: All other entities and chronicles (FULL NAME ONLY)
  //    No partial matches here to avoid noise from common word fragments.
  // =========================================================================
  currentTier = 'general';
  const scannedEntityIds = new Set([entityId, ...relatedEntityIds]);
  for (const entity of entities) {
    if (scannedEntityIds.has(entity.id)) continue;
    scanEntityTextFields(entity, scanTextFieldFullNameOnly);
  }

  for (const chronicle of chronicles) {
    if (castChronicleIds.has(chronicle.chronicleId)) continue;
    const cId = chronicle.chronicleId;
    const cTitle = chronicle.title;

    // Still check metadata by ID (these are always relevant)
    if (chronicle.roleAssignments) {
      for (let i = 0; i < chronicle.roleAssignments.length; i++) {
        const ra = chronicle.roleAssignments[i];
        if (ra.entityId === entityId) {
          matches.push({
            id: nextMatchId(),
            sourceType: 'chronicle',
            sourceId: cId,
            sourceName: cTitle,
            field: `roleAssignments[${i}].entityName`,
            matchType: 'metadata',
            matchedText: ra.entityName,
            position: 0,
            contextBefore: `Role: ${ra.role}`,
            contextAfter: `(${ra.entityKind})`,
            tier: currentTier,
          });
        }
      }
    }

    if (chronicle.lens && chronicle.lens.entityId === entityId) {
      matches.push({
        id: nextMatchId(),
        sourceType: 'chronicle',
        sourceId: cId,
        sourceName: cTitle,
        field: 'lens.entityName',
        matchType: 'metadata',
        matchedText: chronicle.lens.entityName,
        position: 0,
        contextBefore: 'Lens:',
        contextAfter: `(${chronicle.lens.entityKind})`,
        tier: currentTier,
      });
    }

    // Full name only text search
    scanTextFieldFullNameOnly('chronicle', cId, cTitle, 'assembledContent', chronicle.assembledContent);
    scanTextFieldFullNameOnly('chronicle', cId, cTitle, 'finalContent', chronicle.finalContent);
    scanTextFieldFullNameOnly('chronicle', cId, cTitle, 'summary', chronicle.summary);

    if (chronicle.generationHistory) {
      for (const version of chronicle.generationHistory) {
        scanTextFieldFullNameOnly(
          'chronicle', cId, cTitle,
          `generationHistory.${version.versionId}`,
          version.content,
        );
      }
    }
  }

  // =========================================================================
  // 5. NARRATIVE EVENTS: Events from simulation history
  //    Participant events (entity is subject or participant) → full + partial
  //    Non-participant events → full name only
  // =========================================================================
  if (narrativeEvents) {
    // Build set of events where entity is a participant
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

    for (const event of narrativeEvents) {
      const eId = event.id;
      const eName = event.description.length > 60
        ? event.description.slice(0, 57) + '...'
        : event.description;
      const isParticipant = participantEventIds.has(eId);
      currentTier = isParticipant ? 'participant' : 'mention';
      const scan = isParticipant ? scanTextFieldFullAndPartial : scanTextFieldFullNameOnly;

      // Structured name fields (metadata matches for participant events)
      if (isParticipant) {
        if (event.subject.id === entityId) {
          matches.push({
            id: nextMatchId(),
            sourceType: 'event',
            sourceId: eId,
            sourceName: eName,
            field: 'subject.name',
            matchType: 'metadata',
            matchedText: event.subject.name,
            position: 0,
            contextBefore: 'Subject:',
            contextAfter: '',
            tier: currentTier,
          });
        }
        for (let pi = 0; pi < event.participantEffects.length; pi++) {
          const pe = event.participantEffects[pi];
          if (pe.entity.id === entityId) {
            matches.push({
              id: nextMatchId(),
              sourceType: 'event',
              sourceId: eId,
              sourceName: eName,
              field: `participantEffects[${pi}].entity.name`,
              matchType: 'metadata',
              matchedText: pe.entity.name,
              position: 0,
              contextBefore: 'Participant:',
              contextAfter: '',
              tier: currentTier,
            });
          }
          for (let ei = 0; ei < pe.effects.length; ei++) {
            const eff = pe.effects[ei];
            if (eff.relatedEntity && eff.relatedEntity.id === entityId) {
              matches.push({
                id: nextMatchId(),
                sourceType: 'event',
                sourceId: eId,
                sourceName: eName,
                field: `participantEffects[${pi}].effects[${ei}].relatedEntity.name`,
                matchType: 'metadata',
                matchedText: eff.relatedEntity.name,
                position: 0,
                contextBefore: `Related entity (${pe.entity.name}):`,
                contextAfter: '',
                tier: currentTier,
              });
            }
          }
        }
      }

      // Free-text fields
      scan('event', eId, eName, 'description', event.description);
      scan('event', eId, eName, 'action', event.action);

      // Scan effect descriptions for participant events
      if (isParticipant) {
        for (let pi = 0; pi < event.participantEffects.length; pi++) {
          const pe = event.participantEffects[pi];
          for (let ei = 0; ei < pe.effects.length; ei++) {
            scan(
              'event', eId, eName,
              `participantEffects[${pi}].effects[${ei}].description`,
              pe.effects[ei].description,
            );
          }
        }
      }
    }
  }

  // =========================================================================
  // FK references (informational) - show the user all hard connections
  // =========================================================================
  if (relationships) {
    for (const rel of relationships) {
      if (rel.src !== entityId && rel.dst !== entityId) continue;
      const otherId = rel.src === entityId ? rel.dst : rel.src;
      const otherName = entityById.get(otherId)?.name || otherId;
      const direction = rel.src === entityId ? 'outgoing' : 'incoming';
      matches.push({
        id: nextMatchId(),
        sourceType: 'entity',
        sourceId: otherId,
        sourceName: otherName,
        field: `relationship.${rel.kind}`,
        matchType: 'id_slug',
        matchedText: entityId,
        position: 0,
        contextBefore: `${direction} ${rel.kind}:`,
        contextAfter: `→ ${otherName}${rel.status === 'historical' ? ' (historical)' : ''}`,
        tier: 'related',
      });
    }
  }

  for (const chronicle of chronicles) {
    if (chronicle.selectedEntityIds?.includes(entityId)) {
      matches.push({
        id: nextMatchId(),
        sourceType: 'chronicle',
        sourceId: chronicle.chronicleId,
        sourceName: chronicle.title,
        field: 'selectedEntityIds',
        matchType: 'id_slug',
        matchedText: entityId,
        position: 0,
        contextBefore: 'Cast member:',
        contextAfter: `(${chronicle.selectedEntityIds.length} entities in chronicle)`,
        tier: 'cast',
      });
    }
  }

  return { entityId, oldName, matches };
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
    result = result.slice(0, r.position) + r.replacement + result.slice(r.position + r.originalLength);
  }
  return result;
}

/**
 * Build concrete patches from scan results and user decisions.
 */
export function buildRenamePatches(
  scanResult: RenameScanResult,
  newName: string,
  decisions: MatchDecision[],
): RenamePatches {
  const decisionMap = new Map(decisions.map((d) => [d.matchId, d]));

  // Patch maps — accumulated directly during the match loop
  const entityPatchMap = new Map<string, Record<string, string>>();
  const chroniclePatchMap = new Map<string, Record<string, unknown>>();
  const eventPatchMap = new Map<string, Record<string, string>>();

  // Track metadata updates per chronicle
  const chronicleMetaUpdates = new Map<string, Partial<ChronicleRecord>>();

  // Track metadata updates per event (structured name fields)
  const eventMetaUpdates = new Map<string, Record<string, string>>();

  for (const match of scanResult.matches) {
    const decision = decisionMap.get(match.id);
    if (!decision || decision.action === 'reject') continue;

    const replacementText = decision.action === 'edit' ? (decision.editText ?? newName) : newName;

    if (match.matchType === 'metadata') {
      if (match.sourceType === 'event') {
        // Event metadata: structured name fields (subject.name, participant names, etc.)
        const meta = eventMetaUpdates.get(match.sourceId) || {};
        meta[match.field] = replacementText;
        eventMetaUpdates.set(match.sourceId, meta);
      } else {
        // Chronicle metadata: denormalized fields
        const meta = chronicleMetaUpdates.get(match.sourceId) || {};

        if (match.field.startsWith('roleAssignments[')) {
          const idxMatch = match.field.match(/\[(\d+)\]/);
          if (idxMatch) {
            const idx = parseInt(idxMatch[1], 10);
            if (!meta.roleAssignments) {
              meta._roleAssignmentUpdates = meta._roleAssignmentUpdates || [];
              (meta as any)._roleAssignmentUpdates.push({ index: idx, entityName: replacementText });
            }
          }
        } else if (match.field === 'lens.entityName') {
          (meta as any)._lensNameUpdate = replacementText;
        } else if (match.field.startsWith('generationContext.entityDirectives[')) {
          const idxMatch = match.field.match(/\[(\d+)\]/);
          if (idxMatch) {
            const idx = parseInt(idxMatch[1], 10);
            (meta as any)._directiveUpdates = (meta as any)._directiveUpdates || [];
            (meta as any)._directiveUpdates.push({ index: idx, entityName: replacementText });
          }
        }

        chronicleMetaUpdates.set(match.sourceId, meta);
      }
    } else {
      // Text field replacement — accumulate directly into per-type patch maps
      const replacement: FieldReplacement = {
        position: match.position,
        originalLength: match.matchedText.length,
        replacement: replacementText,
      };

      if (match.sourceType === 'entity') {
        const existing = entityPatchMap.get(match.sourceId) || {};
        const rKey = `__replacements_${match.field}`;
        const list: FieldReplacement[] = existing[rKey] ? JSON.parse(existing[rKey]) : [];
        list.push(replacement);
        existing[rKey] = JSON.stringify(list);
        entityPatchMap.set(match.sourceId, existing);
      } else if (match.sourceType === 'chronicle') {
        const existing = chroniclePatchMap.get(match.sourceId) || {};
        const rKey = `__replacements_${match.field}`;
        const list: FieldReplacement[] = (existing[rKey] as FieldReplacement[]) || [];
        list.push(replacement);
        existing[rKey] = list;
        chroniclePatchMap.set(match.sourceId, existing);
      } else if (match.sourceType === 'event') {
        const existing = eventPatchMap.get(match.sourceId) || {};
        const rKey = `__replacements_${match.field}`;
        const list: FieldReplacement[] = existing[rKey] ? JSON.parse(existing[rKey]) : [];
        list.push(replacement);
        existing[rKey] = JSON.stringify(list);
        eventPatchMap.set(match.sourceId, existing);
      }
    }
  }

  // Merge metadata updates into chronicle patches
  for (const [chronicleId, meta] of chronicleMetaUpdates) {
    const existing = chroniclePatchMap.get(chronicleId) || {};
    Object.assign(existing, meta);
    chroniclePatchMap.set(chronicleId, existing);
  }

  // Merge event metadata updates
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
  newName: string,
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
      if (!key.startsWith('__replacements_')) continue;
      const field = key.replace('__replacements_', '');
      const replacements: FieldReplacement[] = JSON.parse(value);

      if (field === 'summary' || field === 'description' || field === 'narrativeHint') {
        const originalText = (entity as any)[field];
        if (typeof originalText === 'string') {
          (updated as any)[field] = applyReplacements(originalText, replacements);
        }
      } else if (field.startsWith('enrichment.descriptionHistory[')) {
        // Parse index from: enrichment.descriptionHistory[N].description
        const idxMatch = field.match(/\[(\d+)\]/);
        if (idxMatch && entity.enrichment?.descriptionHistory) {
          const idx = parseInt(idxMatch[1], 10);
          // Shallow-copy enrichment chain on first write
          if (!updated.enrichment || updated.enrichment === entity.enrichment) {
            updated.enrichment = { ...entity.enrichment };
          }
          if (
            !updated.enrichment!.descriptionHistory ||
            updated.enrichment!.descriptionHistory === entity.enrichment.descriptionHistory
          ) {
            updated.enrichment!.descriptionHistory = [...entity.enrichment.descriptionHistory];
          }
          const entry = updated.enrichment!.descriptionHistory![idx];
          if (entry) {
            updated.enrichment!.descriptionHistory![idx] = {
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
  putChronicle: (record: ChronicleRecord) => Promise<void>,
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
        const updates: Array<{ index: number; entityName: string }> =
          (patch.fieldUpdates as any)._roleAssignmentUpdates;
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

      if ((patch.fieldUpdates as any)._directiveUpdates && chronicle.generationContext?.entityDirectives) {
        const updates: Array<{ index: number; entityName: string }> =
          (patch.fieldUpdates as any)._directiveUpdates;
        updated.generationContext = {
          ...chronicle.generationContext,
          entityDirectives: [...chronicle.generationContext.entityDirectives],
        };
        for (const u of updates) {
          if (updated.generationContext.entityDirectives![u.index]) {
            updated.generationContext.entityDirectives![u.index] = {
              ...updated.generationContext.entityDirectives![u.index],
              entityName: u.entityName,
            };
          }
        }
      }

      // Apply text field replacements
      for (const [key, value] of Object.entries(patch.fieldUpdates)) {
        if (!key.startsWith('__replacements_')) continue;
        const field = key.replace('__replacements_', '');
        const replacements = value as FieldReplacement[];

        if (field.startsWith('generationHistory.')) {
          // Handle generation history versions
          const versionId = field.replace('generationHistory.', '');
          if (updated.generationHistory) {
            updated.generationHistory = updated.generationHistory.map((v) => {
              if (v.versionId === versionId) {
                return { ...v, content: applyReplacements(v.content, replacements) };
              }
              return v;
            });
          }
        } else if (field === 'assembledContent' && typeof updated.assembledContent === 'string') {
          updated.assembledContent = applyReplacements(updated.assembledContent, replacements);
        } else if (field === 'finalContent' && typeof updated.finalContent === 'string') {
          updated.finalContent = applyReplacements(updated.finalContent, replacements);
        } else if (field === 'summary' && typeof updated.summary === 'string') {
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
  patches: EventPatch[],
): T[] {
  if (patches.length === 0) return events;

  const patchMap = new Map(patches.map((p) => [p.eventId, p]));

  return events.map((event) => {
    const patch = patchMap.get(event.id);
    if (!patch) return event;

    const updated: any = { ...event };

    for (const [key, value] of Object.entries(patch.changes)) {
      if (key.startsWith('__replacements_')) {
        // Text field replacements
        const field = key.replace('__replacements_', '');
        const replacements: FieldReplacement[] = JSON.parse(value);

        if (field === 'description' && typeof updated.description === 'string') {
          updated.description = applyReplacements(updated.description, replacements);
        } else if (field === 'action' && typeof updated.action === 'string') {
          updated.action = applyReplacements(updated.action, replacements);
        } else if (field.startsWith('participantEffects[')) {
          // Parse: participantEffects[N].effects[M].description
          const idxMatch = field.match(/participantEffects\[(\d+)\]\.effects\[(\d+)\]\.description/);
          if (idxMatch) {
            const pi = parseInt(idxMatch[1], 10);
            const ei = parseInt(idxMatch[2], 10);
            if (!updated.participantEffects || updated.participantEffects === event.participantEffects) {
              updated.participantEffects = [...event.participantEffects];
            }
            if (updated.participantEffects[pi]) {
              const pe = { ...updated.participantEffects[pi] };
              if (pe.effects === event.participantEffects[pi].effects) {
                pe.effects = [...event.participantEffects[pi].effects];
              }
              if (pe.effects[ei]) {
                pe.effects[ei] = { ...pe.effects[ei], description: applyReplacements(pe.effects[ei].description, replacements) };
              }
              updated.participantEffects[pi] = pe;
            }
          }
        }
      } else if (key === 'subject.name') {
        // Structured name field: subject.name
        updated.subject = { ...event.subject, name: value };
      } else if (key.startsWith('participantEffects[')) {
        // Structured name: participantEffects[N].entity.name or participantEffects[N].effects[M].relatedEntity.name
        if (!updated.participantEffects || updated.participantEffects === event.participantEffects) {
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

        const relatedMatch = key.match(/^participantEffects\[(\d+)\]\.effects\[(\d+)\]\.relatedEntity\.name$/);
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
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), newName);
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
  newName: string,
): { events: T[]; patchCount: number } {
  let patchCount = 0;

  const patched = events.map((event) => {
    // Quick check: is this entity involved at all?
    const isSubject = event.subject.id === entityId;
    const participantIdx = event.participantEffects.findIndex(
      (pe) => pe.entity.id === entityId,
    );
    // Also check if old name appears anywhere in the event text
    const hasTextMatch = event.description.toLowerCase().includes(oldName.toLowerCase())
      || event.action.toLowerCase().includes(oldName.toLowerCase());

    const hasRelatedRef = event.participantEffects.some((pe) =>
      pe.effects.some((eff) => eff.relatedEntity?.id === entityId),
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
    const patchedDesc = replaceAllCaseInsensitive(updated.description || event.description, oldName, newName);
    if (patchedDesc !== (updated.description || event.description)) {
      updated.description = patchedDesc;
      didChange = true;
    }

    const patchedAction = replaceAllCaseInsensitive(updated.action || event.action, oldName, newName);
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
