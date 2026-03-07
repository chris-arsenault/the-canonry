/**
 * useVersionState - Shared version deduplication, selection, and comparison state
 *
 * Used by both ChronicleWorkspace (assembly_ready / complete) and
 * ChronicleReviewPanel's ValidationReadyView (validation_ready).
 */

import { useMemo, useState, useCallback } from "react";
import type { ChronicleGenerationVersion } from "../../lib/chronicleTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedVersion {
  id: string;
  content: string;
  wordCount: number;
  shortLabel: string;
  label: string;
}

export interface VersionState {
  versions: ResolvedVersion[];
  activeVersionId: string | undefined;
  selectedVersionId: string | undefined;
  setSelectedVersionId: (id: string) => void;
  compareToVersionId: string;
  setCompareToVersionId: (id: string) => void;
  selectedVersion: ResolvedVersion | undefined;
  compareToVersion: ResolvedVersion | undefined;
  versionLabelMap: Map<string, string>;
  versionContentMap: Map<string, string>;
  handleDeleteVersion: (versionId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStepLabel(step?: string): string | null {
  if (!step) return null;
  const labels: Record<string, string> = {
    generate: "initial",
    regenerate: "regenerate",
    creative: "creative",
    combine: "combine",
    copy_edit: "copy-edit",
  };
  return labels[step] || step;
}

export function deduplicateVersions(history: ChronicleGenerationVersion[]): ResolvedVersion[] {
  const sorted = [...history].sort((a, b) => a.generatedAt - b.generatedAt);
  const seen = new Set<string>();
  const unique: ChronicleGenerationVersion[] = [];
  for (const version of sorted) {
    if (seen.has(version.versionId)) continue;
    seen.add(version.versionId);
    unique.push(version);
  }
  return unique.map((version, index) => {
    const samplingLabel = version.sampling ?? "unspecified";
    const step = buildStepLabel(version.step);
    const stepDisplay = step || `sampling ${samplingLabel}`;
    return {
      id: version.versionId,
      content: version.content,
      wordCount: version.wordCount,
      shortLabel: `V${index + 1}`,
      label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 ${stepDisplay}`,
    };
  });
}

export function buildFormatTargetIndicator(
  targetVersionId: string | undefined,
  activeVersionId: string | undefined,
  versionLabelMap: Map<string, string>
): string | null {
  if (!targetVersionId) return null;
  const targetLabel = versionLabelMap.get(targetVersionId) || "Unknown";
  const activeLabel = versionLabelMap.get(activeVersionId || "") || "Unknown";
  if (targetVersionId === activeVersionId) return null;
  return `Targets ${targetLabel} \u2022 Active ${activeLabel}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVersionState(
  generationHistory: ChronicleGenerationVersion[] | undefined,
  recordActiveVersionId: string | undefined,
  chronicleId: string,
  onDeleteVersion?: (versionId: string) => void,
): VersionState {
  const versions = useMemo(
    () => deduplicateVersions(generationHistory || []),
    [generationHistory]
  );

  const activeVersionId = recordActiveVersionId || versions[versions.length - 1]?.id;

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState("");
  const [prevVersionKey, setPrevVersionKey] = useState(`${activeVersionId}|${chronicleId}`);

  // Reset selections during render when active version or chronicle changes
  const versionKey = `${activeVersionId}|${chronicleId}`;
  if (versionKey !== prevVersionKey) {
    setPrevVersionKey(versionKey);
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId("");
  }

  // Keep selections valid during render when version list changes
  if (versions.length > 0) {
    const hasSelected = versions.some((v) => v.id === selectedVersionId);
    if (!hasSelected) {
      const hasActive = versions.some((v) => v.id === activeVersionId);
      const next = hasActive ? activeVersionId : versions[versions.length - 1].id;
      setSelectedVersionId(next);
      if (compareToVersionId && compareToVersionId === next) setCompareToVersionId("");
    } else if (compareToVersionId) {
      const hasCompare = versions.some((v) => v.id === compareToVersionId);
      if (!hasCompare || compareToVersionId === selectedVersionId) setCompareToVersionId("");
    }
  }

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );

  const compareToVersion = useMemo(
    () => (compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : undefined),
    [versions, compareToVersionId]
  );

  const versionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  const versionContentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  const handleDeleteVersion = useCallback(
    (versionId: string) => {
      if (!versionId || versions.length === 0) return;

      const index = versions.findIndex((v) => v.id === versionId);
      let nextSelected = selectedVersionId;
      if (index !== -1) {
        nextSelected = versions[index + 1]?.id ?? versions[index - 1]?.id ?? selectedVersionId;
      }
      if (nextSelected === versionId) {
        const hasActive = versions.some((v) => v.id === activeVersionId);
        nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      }

      if (nextSelected && nextSelected !== selectedVersionId) {
        setSelectedVersionId(nextSelected);
      }
      if (compareToVersionId === versionId || compareToVersionId === nextSelected) {
        setCompareToVersionId("");
      }

      onDeleteVersion?.(versionId);
    },
    [versions, selectedVersionId, activeVersionId, compareToVersionId, onDeleteVersion],
  );

  return {
    versions,
    activeVersionId,
    selectedVersionId,
    setSelectedVersionId,
    compareToVersionId,
    setCompareToVersionId,
    selectedVersion,
    compareToVersion,
    versionLabelMap,
    versionContentMap,
    handleDeleteVersion,
  };
}
