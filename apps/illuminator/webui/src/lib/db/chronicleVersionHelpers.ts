/**
 * Chronicle Version Helpers — pure functions for version management.
 *
 * These helpers manage generation history deduplication, version ID resolution,
 * content synchronisation between assembled content and version history,
 * and legacy field migration.
 */

import type {
  ChronicleRecord,
  ChronicleGenerationVersion,
} from "../chronicleTypes";

// ============================================================================
// Word counting
// ============================================================================

export function countWords(text: string | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// Version ID helpers
// ============================================================================

function normalizeVersionId(versionId: string | undefined): string | undefined {
  if (!versionId) return versionId;
  if (versionId.startsWith("current_")) {
    return `version_${versionId.slice("current_".length)}`;
  }
  return versionId;
}

function parseVersionTimestamp(versionId: string | undefined): number | null {
  if (!versionId) return null;
  if (!versionId.startsWith("version_")) return null;
  const suffix = versionId.slice("version_".length);
  const raw = suffix.split("_")[0];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveVersionId(
  versions: ChronicleGenerationVersion[],
  versionId: string | undefined
): string | undefined {
  if (!versionId) return undefined;
  const normalized = normalizeVersionId(versionId);
  if (!normalized) return normalized;
  if (versions.some((v) => v.versionId === normalized)) return normalized;

  const ts = parseVersionTimestamp(normalized);
  if (ts === null) return normalized;
  const match = versions.find((v) => v.generatedAt === ts);
  return match?.versionId || normalized;
}

export function getLatestVersion(
  versions: ChronicleGenerationVersion[]
): ChronicleGenerationVersion | undefined {
  if (versions.length === 0) return undefined;
  return versions.reduce(
    (latest, version) => (version.generatedAt > latest.generatedAt ? version : latest),
    versions[0]
  );
}

function getVersionIdForTimestamp(
  versions: ChronicleGenerationVersion[],
  generatedAt: number
): string | undefined {
  return versions.find((v) => v.generatedAt === generatedAt)?.versionId;
}

export function createUniqueVersionId(existingIds: Set<string>, generatedAt: number): string {
  const base = `version_${generatedAt}`;
  if (!existingIds.has(base)) return base;
  let counter = 1;
  while (existingIds.has(`${base}_${counter}`)) {
    counter += 1;
  }
  return `${base}_${counter}`;
}

// ============================================================================
// Version deduplication
// ============================================================================

function versionContentScore(v: ChronicleGenerationVersion): number {
  return (v.content?.length || 0) + (v.step ? 1 : 0);
}

function shouldReplaceVersion(
  existing: ChronicleGenerationVersion,
  candidate: ChronicleGenerationVersion
): boolean {
  if (candidate.generatedAt > existing.generatedAt) return true;
  if (candidate.generatedAt === existing.generatedAt) {
    return versionContentScore(candidate) > versionContentScore(existing);
  }
  return false;
}

function dedupeVersions(versions: ChronicleGenerationVersion[]): {
  versions: ChronicleGenerationVersion[];
  changed: boolean;
} {
  let changed = false;
  const byId = new Map<string, ChronicleGenerationVersion>();

  for (const version of versions) {
    const existing = byId.get(version.versionId);
    if (!existing) {
      byId.set(version.versionId, version);
    } else {
      changed = true;
      if (shouldReplaceVersion(existing, version)) {
        byId.set(version.versionId, version);
      }
    }
  }

  const deduped = Array.from(byId.values()).sort((a, b) => a.generatedAt - b.generatedAt);
  if (deduped.length !== versions.length) {
    changed = true;
  }
  return { versions: deduped, changed };
}

// ============================================================================
// Version ID field resolution
// ============================================================================

type VersionIdField = "activeVersionId" | "acceptedVersionId" | "summaryTargetVersionId" | "imageRefsTargetVersionId";

const VERSION_ID_FIELDS: readonly VersionIdField[] = [
  "activeVersionId", "acceptedVersionId", "summaryTargetVersionId", "imageRefsTargetVersionId",
] as const;

function resolveVersionIdFields(
  versions: ChronicleGenerationVersion[],
  record: ChronicleRecord
): boolean {
  let changed = false;
  for (const field of VERSION_ID_FIELDS) {
    const resolved = resolveVersionId(versions, record[field]);
    if (resolved !== record[field]) {
      record[field] = resolved;
      changed = true;
    }
  }
  return changed;
}

// ============================================================================
// Assembled content <-> version sync
// ============================================================================

const PROMPT_NOT_STORED = "(prompt not stored - chronicle generated before prompt storage was implemented)";

function buildVersionFromRecord(
  record: ChronicleRecord,
  versionId: string,
  generatedAt: number
): ChronicleGenerationVersion {
  return {
    versionId,
    generatedAt,
    content: record.assembledContent || "",
    wordCount: countWords(record.assembledContent),
    model: record.model || "unknown",
    sampling: record.generationSampling,
    systemPrompt: record.generationSystemPrompt || PROMPT_NOT_STORED,
    userPrompt: record.generationUserPrompt || PROMPT_NOT_STORED,
    step: record.generationStep,
  };
}

function mergeVersionFromRecord(
  existing: ChronicleGenerationVersion,
  record: ChronicleRecord,
  generatedAt: number
): ChronicleGenerationVersion {
  return {
    ...existing,
    generatedAt,
    content: record.assembledContent || "",
    wordCount: countWords(record.assembledContent),
    model: record.model || existing.model,
    sampling: record.generationSampling ?? existing.sampling,
    systemPrompt: record.generationSystemPrompt || existing.systemPrompt || PROMPT_NOT_STORED,
    userPrompt: record.generationUserPrompt || existing.userPrompt || PROMPT_NOT_STORED,
    step: record.generationStep ?? existing.step,
  };
}

function hasVersionFieldChanged(
  a: ChronicleGenerationVersion,
  b: ChronicleGenerationVersion
): boolean {
  return (
    a.generatedAt !== b.generatedAt ||
    a.content !== b.content ||
    a.wordCount !== b.wordCount ||
    a.model !== b.model ||
    a.sampling !== b.sampling ||
    a.systemPrompt !== b.systemPrompt ||
    a.userPrompt !== b.userPrompt ||
    a.step !== b.step
  );
}

function syncAssembledToVersions(
  record: ChronicleRecord,
  versions: ChronicleGenerationVersion[]
): boolean {
  const generatedAt = record.assembledAt ?? record.createdAt;
  const existingId = getVersionIdForTimestamp(versions, generatedAt);
  const currentVersionId =
    existingId || createUniqueVersionId(new Set(versions.map((v) => v.versionId)), generatedAt);
  const existingIndex = versions.findIndex((v) => v.versionId === currentVersionId);

  if (existingIndex === -1) {
    versions.push(buildVersionFromRecord(record, currentVersionId, generatedAt));
    return true;
  }

  const existing = versions[existingIndex];
  const next = mergeVersionFromRecord(existing, record, generatedAt);

  if (hasVersionFieldChanged(next, existing)) {
    versions[existingIndex] = next;
    return true;
  }
  return false;
}

function syncVersionsToAssembled(record: ChronicleRecord, versions: ChronicleGenerationVersion[]): boolean {
  const latest = getLatestVersion(versions);
  if (!latest) return false;
  record.assembledContent = latest.content;
  record.assembledAt = latest.generatedAt;
  record.generationSampling = latest.sampling;
  record.generationStep = latest.step;
  record.model = latest.model || record.model;
  record.generationSystemPrompt = latest.systemPrompt;
  record.generationUserPrompt = latest.userPrompt;
  return true;
}

// ============================================================================
// Orphaned version ref fix-up
// ============================================================================

type OptionalVersionIdField = "acceptedVersionId" | "summaryTargetVersionId" | "imageRefsTargetVersionId";

const OPTIONAL_VERSION_ID_FIELDS: readonly OptionalVersionIdField[] = [
  "acceptedVersionId", "summaryTargetVersionId", "imageRefsTargetVersionId",
] as const;

function fixOrphanedVersionRefs(
  record: ChronicleRecord,
  versions: ChronicleGenerationVersion[]
): boolean {
  if (versions.length === 0) return false;
  let changed = false;
  const latest = getLatestVersion(versions);
  const versionIds = new Set(versions.map((v) => v.versionId));

  if (!record.activeVersionId || !versionIds.has(record.activeVersionId)) {
    record.activeVersionId = latest?.versionId;
    changed = true;
  }
  for (const field of OPTIONAL_VERSION_ID_FIELDS) {
    const value = record[field];
    if (value && !versionIds.has(value)) {
      record[field] = record.activeVersionId;
      changed = true;
    }
  }
  return changed;
}

// ============================================================================
// Legacy migration
// ============================================================================

/** Migration: loreBackported boolean -> entityBackportStatus map */
function migrateLoreBackported(record: ChronicleRecord): boolean {
  const legacy = record as Record<string, unknown>;
  if (legacy["loreBackported"] && !record.entityBackportStatus) {
    record.entityBackportStatus = {};
    delete legacy["loreBackported"];
    return true;
  }
  return false;
}

function syncContentBetweenVersions(
  record: ChronicleRecord,
  versions: ChronicleGenerationVersion[]
): boolean {
  if (record.assembledContent) {
    return syncAssembledToVersions(record, versions);
  }
  if (versions.length > 0) {
    return syncVersionsToAssembled(record, versions);
  }
  return false;
}

// ============================================================================
// Main entry point
// ============================================================================

export function ensureChronicleVersions(record: ChronicleRecord): boolean {
  let changed = false;
  const deduped = dedupeVersions(record.generationHistory || []);
  let versions = deduped.versions;
  if (deduped.changed) changed = true;

  if (resolveVersionIdFields(versions, record)) changed = true;
  if (syncContentBetweenVersions(record, versions)) changed = true;
  if (fixOrphanedVersionRefs(record, versions)) changed = true;

  const finalDeduped = dedupeVersions(versions);
  versions = finalDeduped.versions;
  if (finalDeduped.changed) changed = true;

  if (!record.generationHistory || versions.length !== record.generationHistory.length || changed) {
    record.generationHistory = versions;
    changed = true;
  }

  if (migrateLoreBackported(record)) changed = true;

  return changed;
}

export function restoreRecordFromVersion(record: ChronicleRecord, version: ChronicleGenerationVersion): void {
  record.assembledContent = version.content;
  record.assembledAt = version.generatedAt;
  record.model = version.model || record.model;
  record.generationSystemPrompt = version.systemPrompt;
  record.generationUserPrompt = version.userPrompt;
  record.generationSampling = version.sampling;
  record.generationStep = version.step;
}

export function cascadeVersionIdRefs(record: ChronicleRecord, deletedVersionId: string): void {
  if (record.activeVersionId === deletedVersionId) {
    record.activeVersionId = getLatestVersion(record.generationHistory || [])?.versionId;
  }
  if (record.summaryTargetVersionId === deletedVersionId) {
    record.summaryTargetVersionId = record.activeVersionId;
  }
  if (record.imageRefsTargetVersionId === deletedVersionId) {
    record.imageRefsTargetVersionId = record.activeVersionId;
  }
}

export function resolveAcceptTarget(
  record: ChronicleRecord,
  options?: { finalContent?: string; acceptedVersionId?: string }
): { versionId: string | undefined; content: string | undefined } {
  const versions = record.generationHistory || [];
  const latestId = getLatestVersion(versions)?.versionId;
  const versionId = options?.acceptedVersionId || record.activeVersionId || latestId || record.acceptedVersionId;
  const activeVersion = versions.find((v) => v.versionId === versionId);
  const content = options?.finalContent ?? activeVersion?.content ?? record.assembledContent;
  return { versionId, content };
}
