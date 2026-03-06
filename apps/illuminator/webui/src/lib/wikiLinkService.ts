/**
 * Wiki link service
 *
 * Generates backrefs using Aho-Corasick over normalized entity slugs.
 * See apps/illuminator/WIKI.md for algorithm details.
 */

export interface WikiLinkEntity {
  id: string;
  name: string;
}

export interface WikiLinkMatch {
  entityId: string;
  name: string;
  start: number;
  end: number;
}

export interface SlugCollision {
  slug: string;
  entityIds: string[];
}

export interface WikiLinkResult {
  content: string;
  links: WikiLinkMatch[];
  collisions: SlugCollision[];
}

interface Pattern {
  slug: string;
  entityId: string;
  name: string;
}

interface Node {
  next: Record<string, number>;
  fail: number;
  outputs: number[];
}

interface Automaton {
  nodes: Node[];
  patterns: Pattern[];
  collisions: SlugCollision[];
}

interface NormalizedText {
  normalized: string;
  indexMap: number[];
}

const linkerCache = new Map<string, Automaton>();

function buildCacheKey(entities: WikiLinkEntity[]): string {
  return entities
    .map((entity) => `${entity.id}:${entity.name}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function isAsciiAlphaNumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 48 && code <= 57) // 0-9
  );
}

function isApostrophe(char: string): boolean {
  return char === "'" || char === "\u2019" || char === "\u2018";
}

/**
 * Detect possessive 's at position i (apostrophe followed by 's' then
 * a non-alphanumeric char or end of string). When true, the caller
 * should skip both the apostrophe and the 's' so that e.g.
 * "Micseleia's Dagger" normalizes to "micseleia-dagger" instead of
 * "micseleia-s-dagger".
 */
function isPossessiveSuffix(text: string, i: number): boolean {
  if (!isApostrophe(text[i])) return false;
  if (i + 1 >= text.length) return false;
  if (text[i + 1].toLowerCase() !== "s") return false;
  if (i + 2 >= text.length) return true;
  return !isAsciiAlphaNumeric(text[i + 2].toLowerCase());
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
    } else if (isPossessiveSuffix(text, i)) {
      // Skip apostrophe + 's' — don't emit a separator
      i += 1;
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

function collectSlugMappings(entities: WikiLinkEntity[]): {
  slugToIds: Map<string, string[]>;
  slugToName: Map<string, string>;
} {
  const slugToIds = new Map<string, string[]>();
  const slugToName = new Map<string, string>();

  for (const entity of entities) {
    const slug = normalizeSlug(entity.name);
    if (!slug) continue;
    const existing = slugToIds.get(slug);
    if (existing) {
      existing.push(entity.id);
    } else {
      slugToIds.set(slug, [entity.id]);
    }
    if (!slugToName.has(slug)) {
      slugToName.set(slug, entity.name);
    }
  }

  return { slugToIds, slugToName };
}

function partitionSlugMappings(
  slugToIds: Map<string, string[]>,
  slugToName: Map<string, string>
): { patterns: Pattern[]; collisions: SlugCollision[] } {
  const collisions: SlugCollision[] = [];
  const patterns: Pattern[] = [];

  for (const [slug, ids] of slugToIds.entries()) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 1) {
      patterns.push({ slug, entityId: uniqueIds[0], name: slugToName.get(slug) || slug });
    } else {
      collisions.push({ slug, entityIds: uniqueIds });
    }
  }

  return { patterns, collisions };
}

function insertPatterns(patterns: Pattern[], nodes: Node[]): void {
  patterns.forEach((pattern, index) => {
    let nodeIndex = 0;
    for (const char of pattern.slug) {
      const nextIndex = nodes[nodeIndex].next[char];
      if (nextIndex === undefined) {
        nodes.push({ next: {}, fail: 0, outputs: [] });
        const createdIndex = nodes.length - 1;
        nodes[nodeIndex].next[char] = createdIndex;
        nodeIndex = createdIndex;
      } else {
        nodeIndex = nextIndex;
      }
    }
    nodes[nodeIndex].outputs.push(index);
  });
}

function buildFailLinks(nodes: Node[]): void {
  const queue: number[] = [];
  for (const char of Object.keys(nodes[0].next)) {
    const nextIndex = nodes[0].next[char];
    nodes[nextIndex].fail = 0;
    queue.push(nextIndex);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const node = nodes[current];

    for (const [char, nextIndex] of Object.entries(node.next)) {
      queue.push(nextIndex);

      let fallback = node.fail;
      while (fallback !== 0 && nodes[fallback].next[char] === undefined) {
        fallback = nodes[fallback].fail;
      }

      const fallbackNext = nodes[fallback].next[char];
      nodes[nextIndex].fail = fallbackNext !== undefined ? fallbackNext : 0;
      nodes[nextIndex].outputs = nodes[nextIndex].outputs.concat(
        nodes[nodes[nextIndex].fail].outputs
      );
    }
  }
}

function buildAutomaton(entities: WikiLinkEntity[]): Automaton {
  const { slugToIds, slugToName } = collectSlugMappings(entities);
  const { patterns, collisions } = partitionSlugMappings(slugToIds, slugToName);

  const nodes: Node[] = [{ next: {}, fail: 0, outputs: [] }];
  insertPatterns(patterns, nodes);
  buildFailLinks(nodes);

  return { nodes, patterns, collisions };
}

function getAutomaton(entities: WikiLinkEntity[]): Automaton {
  const key = buildCacheKey(entities);
  const cached = linkerCache.get(key);
  if (cached) return cached;
  const automaton = buildAutomaton(entities);
  linkerCache.set(key, automaton);
  return automaton;
}

function isBoundaryMatch(normalized: string, start: number, end: number): boolean {
  const before = start === 0 ? "-" : normalized[start - 1];
  const after = end === normalized.length ? "-" : normalized[end];
  const beforeOk = start === 0 || before === "-";
  const afterOk = end === normalized.length || after === "-";
  return beforeOk && afterOk;
}

/**
 * Scan normalized text for all pattern matches. Returns one match per entity
 * (earliest occurrence, preferring longer matches at the same position).
 * No overlap filtering — callers that need non-overlapping results should
 * use filterOverlaps().
 */
function advanceState(state: number, char: string, nodes: Node[]): number {
  let s = state;
  while (s !== 0 && nodes[s].next[char] === undefined) {
    s = nodes[s].fail;
  }
  const nextState = nodes[s].next[char];
  return nextState !== undefined ? nextState : s;
}

function isBetterMatch(rawStart: number, rawEnd: number, existing: WikiLinkMatch | undefined): boolean {
  if (!existing) return true;
  if (rawStart < existing.start) return true;
  return rawStart === existing.start && rawEnd > existing.end;
}

function recordOutputMatches(
  outputs: number[],
  i: number,
  normalized: string,
  indexMap: number[],
  automaton: Automaton,
  matchesByEntity: Map<string, WikiLinkMatch>
): void {
  for (const patternIndex of outputs) {
    const pattern = automaton.patterns[patternIndex];
    const matchEnd = i + 1;
    const matchStart = matchEnd - pattern.slug.length;
    if (matchStart < 0) continue;
    if (!isBoundaryMatch(normalized, matchStart, matchEnd)) continue;

    const rawStart = indexMap[matchStart];
    const rawEnd = indexMap[matchEnd - 1] + 1;

    if (isBetterMatch(rawStart, rawEnd, matchesByEntity.get(pattern.entityId))) {
      matchesByEntity.set(pattern.entityId, {
        entityId: pattern.entityId,
        name: pattern.name,
        start: rawStart,
        end: rawEnd,
      });
    }
  }
}

function scanEntityMatches(
  normalized: string,
  indexMap: number[],
  automaton: Automaton
): Map<string, WikiLinkMatch> {
  const matchesByEntity = new Map<string, WikiLinkMatch>();
  if (!normalized) return matchesByEntity;

  let state = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    state = advanceState(state, normalized[i], automaton.nodes);

    const outputs = automaton.nodes[state].outputs;
    if (outputs.length === 0) continue;

    recordOutputMatches(outputs, i, normalized, indexMap, automaton, matchesByEntity);
  }

  return matchesByEntity;
}

/**
 * Filter matches to remove overlapping spans. Keeps earlier matches;
 * later matches whose start falls within a kept match are dropped.
 */
function filterOverlaps(matches: WikiLinkMatch[]): WikiLinkMatch[] {
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const filtered: WikiLinkMatch[] = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start < lastEnd) continue;
    filtered.push(match);
    lastEnd = match.end;
  }

  return filtered;
}

/**
 * Find entity mentions in text using Aho-Corasick matching.
 * Returns one match per entity (first occurrence), no overlap filtering.
 * Use this for detection (e.g. tertiary cast) where we need to know
 * which entities are mentioned regardless of overlapping spans.
 */
export function findEntityMentions(content: string, entities: WikiLinkEntity[]): WikiLinkMatch[] {
  if (!content || entities.length === 0) return [];
  const automaton = getAutomaton(entities);
  const { normalized, indexMap } = normalizeForMatch(content);
  const matchesByEntity = scanEntityMatches(normalized, indexMap, automaton);
  return Array.from(matchesByEntity.values());
}

export function applyWikiLinks(content: string, entities: WikiLinkEntity[]): WikiLinkResult {
  if (!content || entities.length === 0) {
    return { content, links: [], collisions: [] };
  }

  const automaton = getAutomaton(entities);
  const { normalized, indexMap } = normalizeForMatch(content);
  const matchesByEntity = scanEntityMatches(normalized, indexMap, automaton);
  const matches = filterOverlaps(Array.from(matchesByEntity.values()));

  if (matches.length === 0) {
    return { content, links: [], collisions: automaton.collisions };
  }

  let cursor = 0;
  const output: string[] = [];

  for (const match of matches) {
    if (match.start > cursor) {
      output.push(content.slice(cursor, match.start));
    }
    const rawSegment = content.slice(match.start, match.end);
    output.push(`[[${rawSegment}]]`);
    cursor = match.end;
  }

  if (cursor < content.length) {
    output.push(content.slice(cursor));
  }

  return {
    content: output.join(""),
    links: matches,
    collisions: automaton.collisions,
  };
}
