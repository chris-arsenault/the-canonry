/**
 * Historian context builders — standalone async functions extracted from IlluminatorRemote.
 *
 * These build the rich context objects needed by useHistorianEdition and useHistorianReview.
 * All data is read imperatively from Zustand stores — no props needed.
 *
 * Consumed by:
 * - useHistorianActions hook (single-entity flows)
 * - useBulkHistorian hook (batch flows, via bulkHistorianDeps)
 */

import { useEntityStore } from "./db/entityStore";
import { useRelationshipStore } from "./db/relationshipStore";
import { useIndexStore } from "./db/indexStore";
import { useIlluminatorConfigStore } from "./db/illuminatorConfigStore";
import {
  prominenceLabelFromScale,
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
} from "@canonry/world-schema";
import { isHistorianConfigured, isNoteActive } from "./historianTypes";
import type { HistorianEditionConfig } from "../hooks/useHistorianEdition";
import type { HistorianReviewConfig } from "../hooks/useHistorianReview";
import {
  getChronicle,
  getChroniclesForSimulation,
  computeCorpusFactStrength,
  computeAnnotationReinforcementCounts,
} from "./db/chronicleRepository";
import type { ReinforcementCounts } from "./db/chronicleRepository";
import type { FactCoverageReport } from "./chronicleTypes";
import * as entityRepo from "./db/entityRepository";
import type { EntityNavItem } from "./db/entityNav";

// ============================================================================
// Prominence scale helper
// ============================================================================

const FALLBACK_SCALE = buildProminenceScale([], {
  distribution: DEFAULT_PROMINENCE_DISTRIBUTION,
});

function getProminenceScale() {
  return useIndexStore.getState().indexes?.prominenceScale ?? FALLBACK_SCALE;
}

// ============================================================================
// Shared helpers
// ============================================================================

interface RelationshipSummary {
  kind: string;
  targetName: string;
  targetKind: string;
}

interface NeighborSummary {
  name: string;
  kind: string;
  summary: string;
}

/**
 * Build relationship summaries and neighbor summaries for an entity.
 * Uses nav items for name/kind resolution (lightweight), loads full entities
 * only for the top 5 neighbors that need description access.
 */
async function buildRelationshipsAndNeighbors(
  entityId: string,
  entityNavMap: Map<string, EntityNavItem>
): Promise<{ relationships: RelationshipSummary[]; neighborSummaries: NeighborSummary[] }> {
  const byEntity = useRelationshipStore.getState().byEntity;
  const rels = (byEntity.get(entityId) || []).slice(0, 12).map((rel) => {
    const targetId = rel.src === entityId ? rel.dst : rel.src;
    const target = entityNavMap.get(targetId);
    return {
      kind: rel.kind,
      targetName: target?.name || targetId,
      targetKind: target?.kind || "unknown",
    };
  });

  const neighborIds = (byEntity.get(entityId) || [])
    .slice(0, 5)
    .map((rel) => (rel.src === entityId ? rel.dst : rel.src));
  const neighborFull = await useEntityStore.getState().loadEntities(neighborIds);
  const neighborMap = new Map(neighborFull.map((e) => [e.id, e]));
  const neighborSummaries = neighborIds
    .map((nId) => {
      const target = neighborMap.get(nId);
      if (!target) return null;
      return {
        name: target.name,
        kind: target.kind,
        summary: target.summary || target.description?.slice(0, 200) || "",
      };
    })
    .filter((s): s is NeighborSummary => s !== null);

  return { relationships: rels, neighborSummaries };
}

/**
 * Collect related entity IDs for voice-continuity note sampling.
 */
function getRelatedEntityIds(entityId: string): string[] {
  const byEntity = useRelationshipStore.getState().byEntity;
  const relatedEntityIds = new Set<string>([entityId]);
  for (const rel of byEntity.get(entityId) || []) {
    const targetId = rel.src === entityId ? rel.dst : rel.src;
    if (targetId) relatedEntityIds.add(targetId);
  }
  return Array.from(relatedEntityIds);
}

// ============================================================================
// Previous notes sampling (voice continuity)
// ============================================================================

const HISTORIAN_SAMPLING = {
  maxTotal: 15,
  maxPerTarget: 3,
  relatedRatio: 0.3,
};

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    // eslint-disable-next-line sonarjs/pseudo-random -- non-security shuffle for processing order
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function takeRandomSample<T>(items: T[], count: number): T[] {
  if (!items.length || count <= 0) return [];
  if (items.length <= count) return [...items];
  const copy = [...items];
  shuffleInPlace(copy);
  return copy.slice(0, count);
}

interface NoteEntry {
  noteKey: string;
  targetKey: string;
  targetType: string;
  targetId: string;
  targetName: string;
  anchorPhrase: string;
  text: string;
  type: string;
}

interface PreviousNoteSummary {
  targetName: string;
  anchorPhrase: string;
  text: string;
  type: string;
}

export async function collectPreviousNotes(
  options: {
    relatedEntityIds?: string[];
    relatedChronicleIds?: string[];
    maxOverride?: number;
  } = {}
): Promise<PreviousNoteSummary[]> {
  const { maxPerTarget, relatedRatio } = HISTORIAN_SAMPLING;
  const maxTotal = options.maxOverride ?? HISTORIAN_SAMPLING.maxTotal;
  if (maxTotal <= 0) return [];
  const relatedEntityIds = new Set(options.relatedEntityIds || []);
  const relatedChronicleIds = new Set(options.relatedChronicleIds || []);
  const { simulationRunId } = useEntityStore.getState();

  const byTarget = new Map<string, NoteEntry[]>();

  const addNotesForTarget = (
    targetKey: string,
    targetMeta: { type: string; id: string; name: string },
    notes: Array<{ noteId?: string; anchorPhrase: string; text: string; type: string }>
  ) => {
    if (!notes.length) return;
    const mapped: NoteEntry[] = notes.map((note, index) => ({
      noteKey: note.noteId || `${targetKey}:${index}`,
      targetKey,
      targetType: targetMeta.type,
      targetId: targetMeta.id,
      targetName: targetMeta.name,
      anchorPhrase: note.anchorPhrase,
      text: note.text,
      type: note.type,
    }));
    byTarget.set(targetKey, mapped);
  };

  // Entity notes
  if (simulationRunId) {
    const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
    for (const entity of allEntities) {
      const notes = (entity.enrichment?.historianNotes || []).filter(isNoteActive);
      addNotesForTarget(
        `entity:${entity.id}`,
        {
          type: "entity",
          id: entity.id,
          name: entity.name,
        },
        notes
      );
    }
  }

  // Chronicle notes
  if (simulationRunId) {
    const chronicleRecords = await getChroniclesForSimulation(simulationRunId);
    for (const chronicle of chronicleRecords) {
      const notes = (chronicle.historianNotes || []).filter(isNoteActive);
      addNotesForTarget(
        `chronicle:${chronicle.chronicleId}`,
        {
          type: "chronicle",
          id: chronicle.chronicleId,
          name: chronicle.title || chronicle.chronicleId,
        },
        notes
      );
    }
  }

  // Cap each target
  const cappedNotes: NoteEntry[] = [];
  for (const notes of byTarget.values()) {
    const selected =
      notes.length > maxPerTarget ? takeRandomSample(notes, maxPerTarget) : notes.slice();
    cappedNotes.push(...selected);
  }

  if (cappedNotes.length === 0) return [];

  const total = Math.min(maxTotal, cappedNotes.length);
  const relatedNotes = cappedNotes.filter((note) => {
    if (note.targetType === "entity") return relatedEntityIds.has(note.targetId);
    if (note.targetType === "chronicle") return relatedChronicleIds.has(note.targetId);
    return false;
  });

  const relatedQuota = Math.min(relatedNotes.length, Math.round(total * relatedRatio));
  const relatedSample = takeRandomSample(relatedNotes, relatedQuota);
  const relatedKeys = new Set(relatedSample.map((note) => note.noteKey));
  const remainingPool = cappedNotes.filter((note) => !relatedKeys.has(note.noteKey));
  const remainingSample = takeRandomSample(remainingPool, total - relatedSample.length);

  const finalSample = [...relatedSample, ...remainingSample];
  shuffleInPlace(finalSample);

  return finalSample.map((note) => ({
    targetName: note.targetName,
    anchorPhrase: note.anchorPhrase,
    text: note.text,
    type: note.type,
  }));
}

// ============================================================================
// Context builders
// ============================================================================

/**
 * Build the full context for a historian edition (description rewrite) session.
 * Returns null if preconditions aren't met (missing config, entity, etc.).
 */
export async function buildHistorianEditionContext(
  entityId: string,
  tone?: string,
  reEdition?: boolean
): Promise<HistorianEditionConfig | null> {
  const { projectId, simulationRunId, worldContext, historianConfig } =
    useIlluminatorConfigStore.getState();
  if (!projectId || !simulationRunId || !entityId) return null;
  if (!isHistorianConfigured(historianConfig)) return null;

  const entity = await useEntityStore.getState().loadEntity(entityId);
  if (!entity?.description) return null;

  // If prior historian editions exist (active or legacy), use the pre-historian baseline
  // as the input description instead of entity.description (which may be an inflated historian
  // output). The first historian-edition or legacy-copy-edit entry is always the pre-historian
  // text that was replaced by the first edition. Filter edition entries from the archive so
  // the LLM works from the original source material, not prior historian rewrites.
  const editionSources = new Set(["historian-edition", "legacy-copy-edit"]);
  let description = entity.description;
  let filteredHistory = entity.enrichment?.descriptionHistory || [];
  const firstEdition = filteredHistory.find((h: { source?: string }) =>
    editionSources.has(h.source || "")
  );
  if (firstEdition) {
    description = firstEdition.description;
    filteredHistory = filteredHistory.filter(
      (h: { source?: string }) => !editionSources.has(h.source || "")
    );
  } else if (reEdition) {
    return null; // re-edition requested but no prior edition exists
  }

  const entityNavMap = useEntityStore.getState().navItems;
  const prominenceScale = getProminenceScale();

  const { relationships, neighborSummaries } = await buildRelationshipsAndNeighbors(
    entity.id,
    entityNavMap
  );

  // Gather chronicle summaries from backrefs
  const chronicleSummaries: Array<{
    chronicleId: string;
    title: string;
    format: string;
    summary: string;
  }> = [];
  const backrefs = entity.enrichment?.chronicleBackrefs || [];
  for (const ref of backrefs) {
    if (!ref.chronicleId) continue;
    try {
      const chronicle = await getChronicle(ref.chronicleId);
      if (chronicle && chronicle.title) {
        chronicleSummaries.push({
          chronicleId: chronicle.chronicleId,
          title: chronicle.title,
          format: chronicle.format || "",
          summary: chronicle.summary || chronicle.finalContent?.slice(0, 500) || "",
        });
      }
    } catch {
      // Skip if chronicle not found
    }
  }

  const previousNotes = await collectPreviousNotes({
    relatedEntityIds: getRelatedEntityIds(entity.id),
  });

  return {
    projectId,
    simulationRunId,
    entityId: entity.id,
    entityName: entity.name,
    entityKind: entity.kind,
    entitySubtype: entity.subtype || "",
    entityCulture: entity.culture || "",
    entityProminence: prominenceLabelFromScale(entity.prominence, prominenceScale),
    description,
    summary: entity.summary || "",
    descriptionHistory: filteredHistory,
    chronicleSummaries,
    relationships,
    neighborSummaries,
    canonFacts: (worldContext.canonFactsWithMetadata || []).map((f: { text: string }) => f.text),
    worldDynamics: (worldContext.worldDynamics || []).map((d: { text: string }) => d.text),
    previousNotes,
    historianConfig,
    tone: (tone || "scholarly") as HistorianEditionConfig["tone"],
  };
}

/**
 * Build the full context for a historian review (annotation) session on an entity.
 * Returns null if preconditions aren't met.
 */
export async function buildHistorianReviewContext(
  entityId: string,
  tone?: string,
  voiceDigestCache?: CorpusVoiceDigestCache,
  maxNotesOverride?: number
): Promise<HistorianReviewConfig | null> {
  const { projectId, simulationRunId, worldContext, historianConfig } =
    useIlluminatorConfigStore.getState();
  if (!projectId || !simulationRunId || !entityId) return null;
  if (!isHistorianConfigured(historianConfig)) return null;

  const entity = await useEntityStore.getState().loadEntity(entityId);
  if (!entity?.description) return null;

  const entityNavMap = useEntityStore.getState().navItems;
  const prominenceScale = getProminenceScale();

  const { relationships, neighborSummaries } = await buildRelationshipsAndNeighbors(
    entity.id,
    entityNavMap
  );

  // Build corpus voice digest (cached across batch runs)
  const voiceDigest = await buildCorpusVoiceDigest(voiceDigestCache);

  const contextJson = JSON.stringify({
    entityId: entity.id,
    entityName: entity.name,
    entityKind: entity.kind,
    entitySubtype: entity.subtype || "",
    entityCulture: entity.culture || "",
    entityProminence: prominenceLabelFromScale(entity.prominence, prominenceScale),
    summary: entity.summary || "",
    relationships,
    neighborSummaries,
    canonFacts: (worldContext.canonFactsWithMetadata || []).map((f: { text: string }) => f.text),
    worldDynamics: (worldContext.worldDynamics || []).map((d: { text: string }) => d.text),
    voiceDigest: voiceDigest.totalNotes > 0 ? voiceDigest : undefined,
  });

  const previousNotes = await collectPreviousNotes({
    relatedEntityIds: getRelatedEntityIds(entity.id),
    maxOverride: maxNotesOverride,
  });

  return {
    projectId,
    simulationRunId,
    targetType: "entity",
    targetId: entity.id,
    targetName: entity.name,
    sourceText: entity.description,
    contextJson,
    previousNotesJson: JSON.stringify(previousNotes),
    historianConfig,
    tone: (tone || "weary") as HistorianReviewConfig["tone"],
  };
}

/**
 * Build the full context for a historian review (annotation) session on a chronicle.
 * Returns null if preconditions aren't met.
 *
 * Extracted from IlluminatorRemote's handleChronicleHistorianReview for reuse by
 * both single-chronicle and bulk annotation flows.
 */
export type ReinforcementCache = { runId: string | null; data: ReinforcementCounts | null };

async function resolveCachedValue<T>(
  cache: { runId: string | null; [key: string]: unknown } | undefined,
  runId: string,
  cacheKey: string,
  compute: () => Promise<T>
): Promise<T> {
  if (cache && cache.runId === runId && cache[cacheKey] != null) {
    return cache[cacheKey] as T;
  }
  const value = await compute();
  if (cache) {
    cache.runId = runId;
    cache[cacheKey] = value;
  }
  return value;
}

async function resolveFactCoverageGuidance(
  factCoverageReport: ChronicleRecord["factCoverageReport"],
  simulationRunId: string,
  worldContext: { canonFactsWithMetadata?: Array<{ id: string; type?: string; disabled?: boolean }> },
  corpusStrengthCache?: { runId: string | null; strength: Map<string, number> | null },
  reinforcementCache?: ReinforcementCache
) {
  const corpusStrength = await resolveCachedValue(
    corpusStrengthCache, simulationRunId, "strength",
    () => computeCorpusFactStrength(simulationRunId)
  );
  const reinforcement = await resolveCachedValue(
    reinforcementCache, simulationRunId, "data",
    () => computeAnnotationReinforcementCounts(simulationRunId)
  );

  const constraintFactIds = new Set(
    (worldContext.canonFactsWithMetadata || [])
      .filter((f) => f.type === "generation_constraint" || f.disabled)
      .map((f) => f.id)
  );

  return buildFactCoverageGuidance(factCoverageReport, corpusStrength, constraintFactIds, reinforcement);
}

export async function buildChronicleReviewContext(
  chronicleId: string,
  tone?: string,
  corpusStrengthCache?: { runId: string | null; strength: Map<string, number> | null },
  voiceDigestCache?: CorpusVoiceDigestCache,
  reinforcementCache?: ReinforcementCache,
  maxNotesOverride?: number
): Promise<HistorianReviewConfig | null> {
  const { projectId, simulationRunId, worldContext, historianConfig } =
    useIlluminatorConfigStore.getState();
  if (!projectId || !simulationRunId || !chronicleId) return null;
  if (!isHistorianConfigured(historianConfig)) return null;

  const chronicle = await getChronicle(chronicleId);
  if (!chronicle) return null;
  if (chronicle.status !== "complete" || !chronicle.finalContent) return null;

  const content = chronicle.finalContent;

  // Build cast summaries
  const castEntityIds = (chronicle.roleAssignments || [])
    .map((ra: { entityId: string }) => ra.entityId)
    .filter(Boolean);
  const castFull = await useEntityStore.getState().loadEntities(castEntityIds);
  const castMap = new Map(castFull.map((e: { id: string }) => [e.id, e]));

  const castSummaries = (chronicle.roleAssignments || [])
    .slice(0, 10)
    .map((ra: { entityId: string }) => {
      const entity = castMap.get(ra.entityId);
      if (!entity) return null;
      return {
        name: entity.name,
        kind: entity.kind,
        summary: entity.summary || entity.description?.slice(0, 200) || "",
      };
    })
    .filter(Boolean);

  const cast = (chronicle.roleAssignments || []).map((ra: { entityId: string; role: string }) => {
    const entity = castMap.get(ra.entityId);
    return {
      entityName: entity?.name || ra.entityId,
      role: ra.role,
      kind: entity?.kind || "unknown",
    };
  });

  const factCoverageGuidance = chronicle.factCoverageReport?.entries?.length
    ? await resolveFactCoverageGuidance(
        chronicle.factCoverageReport, simulationRunId, worldContext,
        corpusStrengthCache, reinforcementCache
      )
    : undefined;

  // Build corpus voice digest (cached across batch runs)
  const voiceDigest = await buildCorpusVoiceDigest(voiceDigestCache);

  const contextJson = JSON.stringify({
    chronicleId: chronicle.chronicleId,
    title: chronicle.title || "Untitled",
    format: chronicle.format,
    narrativeStyleId: chronicle.narrativeStyleId || "",
    cast,
    castSummaries,
    canonFacts: (worldContext.canonFactsWithMetadata || []).map((f: { text: string }) => f.text),
    worldDynamics: (worldContext.worldDynamics || []).map((d: { text: string }) => d.text),
    factCoverageGuidance,
    voiceDigest: voiceDigest.totalNotes > 0 ? voiceDigest : undefined,
    temporalNarrative: chronicle.perspectiveSynthesis?.temporalNarrative || undefined,
    focalEra: chronicle.temporalContext?.focalEra
      ? {
          name: chronicle.temporalContext.focalEra.name,
          description: chronicle.temporalContext.focalEra.description,
        }
      : undefined,
    temporalCheckReport: chronicle.temporalCheckReport || undefined,
  });

  const relatedEntityIds = new Set(
    (chronicle.roleAssignments || []).map((ra: { entityId: string }) => ra.entityId).filter(Boolean)
  );
  const previousNotes = await collectPreviousNotes({
    relatedEntityIds: Array.from(relatedEntityIds),
    maxOverride: maxNotesOverride,
  });

  return {
    projectId,
    simulationRunId,
    targetType: "chronicle",
    targetId: chronicleId,
    targetName: chronicle.title || "Untitled Chronicle",
    sourceText: content,
    contextJson,
    previousNotesJson: JSON.stringify(previousNotes),
    historianConfig,
    tone: (tone || chronicle.assignedTone || "weary") as HistorianReviewConfig["tone"],
  };
}

// ============================================================================
// Corpus Voice Digest (annotation quality tracking)
// ============================================================================

export interface CorpusVoiceDigest {
  /** Superlative claims made across the corpus, e.g. '"the most honest line" — on "The Holding of the Berg"' */
  superlativeClaims: string[];
  /** 4-word note openings that appear 3+ times across the corpus */
  overusedOpenings: string[];
  /** Word-count histogram: short (≤35w), medium (36–70w), long (71+w) */
  lengthHistogram: { short: number; medium: number; long: number; total: number };
  /** Total tangent-type notes in the corpus */
  tangentCount: number;
  /** Total notes in the corpus */
  totalNotes: number;
  /** Number of distinct targets (entities + chronicles) that have annotations */
  targetCount: number;
}

export type CorpusVoiceDigestCache = {
  runId: string | null;
  digest: CorpusVoiceDigest | null;
};

const SUPERLATIVE_RE =
  /\bthe (most|only|finest|best|worst|first|last|greatest|single) [^.,;:!?()\[\]"—\n]+/gi;

/**
 * Build a corpus-wide voice digest from all existing historian annotations.
 * Tracks superlative claims, overused openings, length distribution, and tangent count.
 * Follows the same cache pattern as corpusStrengthCache for batch flows.
 */
async function collectCorpusNotes(
  simulationRunId: string
): Promise<Array<{ text: string; type: string; targetName: string }>> {
  const allTexts: Array<{ text: string; type: string; targetName: string }> = [];

  const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
  for (const entity of allEntities) {
    for (const note of (entity.enrichment?.historianNotes || []).filter(isNoteActive)) {
      allTexts.push({ text: note.text, type: note.type, targetName: entity.name });
    }
  }

  const chronicleRecords = await getChroniclesForSimulation(simulationRunId);
  for (const chronicle of chronicleRecords) {
    for (const note of (chronicle.historianNotes || []).filter(isNoteActive)) {
      allTexts.push({
        text: note.text, type: note.type,
        targetName: chronicle.title || chronicle.chronicleId,
      });
    }
  }

  return allTexts;
}

function extractSuperlativeClaims(
  allTexts: Array<{ text: string; targetName: string }>
): string[] {
  const byPattern = new Map<string, string[]>();
  for (const { text, targetName } of allTexts) {
    const matches = text.match(SUPERLATIVE_RE);
    if (!matches) continue;
    for (const rawMatch of matches) {
      const normalized = rawMatch.trim().toLowerCase();
      const targets = byPattern.get(normalized) || [];
      targets.push(targetName);
      byPattern.set(normalized, targets);
    }
  }

  const claims: string[] = [];
  for (const [phrase, targets] of byPattern) {
    const unique = [...new Set(targets)];
    if (unique.length >= 2) {
      const overflowSuffix = unique.length > 4 ? ` (+${unique.length - 4} more)` : "";
      claims.push(
        `[repeated] "${phrase}" — used on: ${unique.slice(0, 4).join(", ")}${overflowSuffix}`
      );
    } else {
      claims.push(`"${phrase}" — on "${unique[0]}"`);
    }
  }
  return claims;
}

function findOverusedOpenings(allTexts: Array<{ text: string }>): string[] {
  const openingCounts = new Map<string, number>();
  for (const { text } of allTexts) {
    const words = text.trim().split(/\s+/).slice(0, 4);
    if (words.length < 4) continue;
    const opening = words.join(" ").toLowerCase().replace(/[.,;:!?]$/g, "");
    openingCounts.set(opening, (openingCounts.get(opening) || 0) + 1);
  }
  return [...openingCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([opening, count]) => `"${opening}..." (x${count})`);
}

function computeLengthHistogram(allTexts: Array<{ text: string }>): { short: number; medium: number; long: number; total: number } {
  let short = 0, medium = 0, long = 0;
  for (const { text } of allTexts) {
    const wc = text.trim().split(/\s+/).length;
    if (wc <= 35) short++;
    else if (wc <= 70) medium++;
    else long++;
  }
  return { short, medium, long, total: allTexts.length };
}

export async function buildCorpusVoiceDigest(
  cache?: CorpusVoiceDigestCache
): Promise<CorpusVoiceDigest> {
  const { simulationRunId } = useEntityStore.getState();

  if (cache && cache.runId === simulationRunId && cache.digest) {
    return cache.digest;
  }

  const allTexts = simulationRunId ? await collectCorpusNotes(simulationRunId) : [];

  const digest: CorpusVoiceDigest = {
    superlativeClaims: extractSuperlativeClaims(allTexts),
    overusedOpenings: findOverusedOpenings(allTexts),
    lengthHistogram: computeLengthHistogram(allTexts),
    tangentCount: allTexts.filter((n) => n.type === "tangent").length,
    totalNotes: allTexts.length,
    targetCount: new Set(allTexts.map((n) => n.targetName)).size,
  };

  if (cache) {
    cache.runId = simulationRunId || null;
    cache.digest = digest;
  }

  return digest;
}

// ============================================================================
// Fact Coverage Guidance
// ============================================================================

export interface FactGuidanceTarget {
  factId: string;
  factText: string;
  action: "surface" | "connect";
  /** Evidence quote from coverage report (surface targets only) */
  evidence?: string;
  /** Corpus-wide strength percentage */
  corpusStrength: number;
}

/**
 * Build a prioritized list of facts the historian should pay attention to.
 * Returns null if no guidance is needed (all facts are well-represented).
 *
 * "surface" targets: facts rated "mentioned" — material exists, historian should draw attention
 * "connect" targets: facts rated "missing" — historian should find natural openings for tangent
 *
 * Dynamic dampening: facts that have already been reinforced more than their fair share
 * (relative to total annotations with guidance and total eligible facts) get their score
 * reduced proportionally, preventing any single fact from dominating annotation guidance.
 */
export function buildFactCoverageGuidance(
  report: FactCoverageReport,
  corpusStrength: Map<string, number>,
  excludeFactIds?: Set<string>,
  reinforcement?: ReinforcementCounts
): FactGuidanceTarget[] | null {
  const eligible = report.entries
    .filter((e) => e.rating !== "integral" && e.rating !== "prevalent")
    .filter((e) => !excludeFactIds || !excludeFactIds.has(e.factId));

  // Fair share: if each annotation picks 2 targets from F eligible facts across T annotations,
  // each fact's expected reinforcement count is 2T / F.
  const eligibleFactCount = eligible.length;
  const fairShare =
    reinforcement && eligibleFactCount > 0 && reinforcement.totalAnnotationsWithGuidance > 0
      ? (2 * reinforcement.totalAnnotationsWithGuidance) / eligibleFactCount
      : 0;

  const scored = eligible
    .map((e) => {
      let score = 0;
      if (e.rating === "mentioned") score += 3;
      if (e.rating === "missing") score += 1;
      const strength = corpusStrength.get(e.factId) ?? 50;
      if (strength < 25) score += 3;
      else if (strength < 50) score += 1;
      if (e.wasFaceted) score += 1;

      // Dynamic dampening: penalize facts that have consumed more than their fair share
      if (reinforcement && fairShare > 0) {
        const count = reinforcement.counts.get(e.factId) ?? 0;
        const ratio = count / fairShare;
        if (ratio > 1) {
          score -= Math.floor((ratio - 1) * 3);
        }
      }

      return { entry: e, score, strength };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (scored.length === 0) return null;

  return scored.map((s) => ({
    factId: s.entry.factId,
    factText: s.entry.factText,
    action: s.entry.rating === "mentioned" ? ("surface" as const) : ("connect" as const),
    evidence: s.entry.rating === "mentioned" ? s.entry.evidence : undefined,
    corpusStrength: s.strength,
  }));
}
