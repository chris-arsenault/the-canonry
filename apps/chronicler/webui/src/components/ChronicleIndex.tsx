/**
 * ChronicleIndex - list view for accepted chronicles
 */

import React, { useMemo, useState } from "react";
import type { WikiPage } from "../types/world.ts";
import styles from "./ChronicleIndex.module.css";

interface ChronicleIndexProps {
  chronicles: WikiPage[];
  /** Era narrative pages to show at the top of their era groups */
  eraNarrativePages?: WikiPage[];
  filter:
    | { kind: "all" }
    | { kind: "format"; format: "story" | "document" }
    | { kind: "type"; typeId: string }
    | { kind: "era"; eraId: string; format?: "story" | "document" };
  onNavigate: (pageId: string) => void;
}

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "era_asc", label: "Era (earliest)" },
  { value: "era_desc", label: "Era (latest)" },
];

function formatChronicleSubtype(typeId: string): string {
  return typeId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type ChronicleFilter = ChronicleIndexProps['filter'];

function buildChronicleHeading(filter: ChronicleFilter, eraName: string | null): string {
  if (filter.kind === "format") {
    return filter.format === "story" ? "Stories" : "Documents";
  }
  if (filter.kind === "type") {
    return `${formatChronicleSubtype(filter.typeId)} Chronicles`;
  }
  if (filter.kind === "era") {
    if (filter.format === "story") return `Stories: ${eraName}`;
    if (filter.format === "document") return `Documents: ${eraName}`;
    return `Chronicles: ${eraName}`;
  }
  return "Chronicles";
}

function buildChronicleDescription(filter: ChronicleFilter, eraName: string | null): string {
  if (filter.kind === "all") return "Accepted chronicles from Illuminator.";
  if (filter.kind === "format") {
    const formatLabel = filter.format === "story" ? "stories" : "documents";
    return `Accepted ${formatLabel} from Illuminator.`;
  }
  if (filter.kind === "era") {
    if (filter.format) {
      const label = filter.format === "story" ? "Stories" : "Documents";
      return `${label} set during the ${eraName}.`;
    }
    return `Chronicles set during the ${eraName}.`;
  }
  return `Accepted chronicles of type ${formatChronicleSubtype(filter.typeId)}.`;
}

type EraInfo = { order: number; label: string; hasEra: boolean };

function getChronicleEraInfo(page: WikiPage): EraInfo {
  const focalEra = page.chronicle?.temporalContext?.focalEra;
  if (!focalEra) return { order: Number.POSITIVE_INFINITY, label: "Unknown Era", hasEra: false };
  const label = focalEra.name || "Unknown Era";
  if (typeof focalEra.order === "number") return { order: focalEra.order, label, hasEra: true };
  if (typeof focalEra.startTick === "number") return { order: focalEra.startTick, label, hasEra: true };
  return { order: Number.POSITIVE_INFINITY, label, hasEra: true };
}

function filterChroniclesWithFilter(chronicles: WikiPage[], filter: ChronicleFilter): WikiPage[] {
  return chronicles.filter((page) => page.chronicle).filter((page) => {
    if (filter.kind === "all") return true;
    if (filter.kind === "format") return page.chronicle?.format === filter.format;
    if (filter.kind === "type") return page.chronicle?.narrativeStyleId === filter.typeId;
    if (filter.kind === "era") {
      if (page.chronicle?.temporalContext?.focalEra?.id !== filter.eraId) return false;
      if (filter.format && page.chronicle?.format !== filter.format) return false;
      return true;
    }
    return true;
  });
}

function compareChroniclesBySortMode(a: WikiPage, b: WikiPage, sortMode: string): number {
  if (sortMode === "updated_desc") return (b.lastUpdated || 0) - (a.lastUpdated || 0);
  const eraA = getChronicleEraInfo(a);
  const eraB = getChronicleEraInfo(b);
  if (eraA.hasEra !== eraB.hasEra) return eraA.hasEra ? -1 : 1;
  if (eraA.order !== eraB.order) return sortMode === "era_asc" ? eraA.order - eraB.order : eraB.order - eraA.order;
  return sortMode === "era_asc" ? eraA.label.localeCompare(eraB.label) : eraB.label.localeCompare(eraA.label);
}

type EraGroup = { label: string; order: number; hasEra: boolean; items: WikiPage[] };

function buildSortedEraGroups(sorted: WikiPage[], sortMode: string): EraGroup[] {
  const groups = new Map<string, EraGroup>();
  for (const page of sorted) {
    const info = getChronicleEraInfo(page);
    if (!groups.has(info.label)) {
      groups.set(info.label, { label: info.label, order: info.order, hasEra: info.hasEra, items: [] });
    }
    groups.get(info.label)!.items.push(page);
  }
  const entries = Array.from(groups.values());
  if (sortMode === "era_asc" || sortMode === "era_desc") {
    entries.sort((a, b) => {
      if (a.hasEra !== b.hasEra) return a.hasEra ? -1 : 1;
      if (a.order !== b.order) return sortMode === "era_asc" ? a.order - b.order : b.order - a.order;
      return a.label.localeCompare(b.label);
    });
  }
  return entries;
}

export default function ChronicleIndex({
  chronicles,
  eraNarrativePages = [],
  filter,
  onNavigate,
}: Readonly<ChronicleIndexProps>) {
  const [sortMode, setSortMode] = useState("era_asc");

  const filtered = useMemo(
    () => filterChroniclesWithFilter(chronicles, filter),
    [chronicles, filter]
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareChroniclesBySortMode(a, b, sortMode)),
    [filtered, sortMode]
  );

  // Build era narrative lookup by era name (label used in groups)
  const eraNarrativeByEraName = useMemo(() => {
    const map = new Map<string, WikiPage>();
    for (const page of eraNarrativePages) {
      if (page.eraNarrative) map.set(page.title, page);
    }
    return map;
  }, [eraNarrativePages]);

  const groupedByEra = useMemo(
    () => buildSortedEraGroups(sorted, sortMode),
    [sorted, sortMode]
  );

  // Get era name for era-based filters
  const eraName = useMemo(() => {
    if (filter.kind !== "era") return null;
    const chronicle = chronicles.find(
      (c) => c.chronicle?.temporalContext?.focalEra?.id === filter.eraId
    );
    return chronicle?.chronicle?.temporalContext?.focalEra?.name || "Unknown Era";
  }, [chronicles, filter]);

  const heading = buildChronicleHeading(filter, eraName);
  const description = buildChronicleDescription(filter, eraName);

  if (sorted.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.empty}>No chronicles found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{heading}</h1>
      <div className={styles.descriptionRow}>
        <p className={styles.description}>{description}</p>
        <div className={styles.controls}>
          <div className={styles.sortControl}>
            <span className={styles.sortLabel}>Sort</span>
            <select
              className={styles.sortSelect}
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.list}>
        {groupedByEra.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupHeader}>{group.label}</div>
            <div className={styles.groupItems}>
              {/* Era narrative at the top of the group */}
              {eraNarrativeByEraName.has(group.label) &&
                (() => {
                  const narrativePage = eraNarrativeByEraName.get(group.label)!;
                  const thesis = narrativePage.content?.summary || "";
                  return (
                    <button
                      key={narrativePage.id}
                      className={styles.item}
                      onClick={() => onNavigate(narrativePage.id)}
                    >
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{narrativePage.title}</span>
                        <div className={styles.badgeGroup}>
                          <span className={styles.badge}>Era Narrative</span>
                          <span className={styles.badgeSecondary}>synthetic</span>
                        </div>
                      </div>
                      {thesis && <div className={styles.itemSummary}>{thesis}</div>}
                    </button>
                  );
                })()}
              {group.items.map((page) => {
                const eraLabel = page.chronicle?.temporalContext?.focalEra?.name || "Unknown Era";
                const isMultiEra = page.chronicle?.temporalContext?.isMultiEra;
                const formatLabel = page.chronicle?.format === "document" ? "Document" : "Story";
                const subtypeLabel = page.chronicle?.narrativeStyleId
                  ? formatChronicleSubtype(page.chronicle.narrativeStyleId)
                  : null;
                const primaryEntities = (page.chronicle?.roleAssignments || [])
                  .filter((role) => role.isPrimary)
                  .map((role) => role.entityName)
                  .filter(Boolean);
                const primaryLabel = primaryEntities.length > 0 ? primaryEntities.join(", ") : null;
                const summary = page.content?.summary || "";

                return (
                  <button key={page.id} className={styles.item} onClick={() => onNavigate(page.id)}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemTitle}>{page.title}</span>
                      <div className={styles.badgeGroup}>
                        <span className={styles.badge}>{formatLabel}</span>
                        {subtypeLabel && (
                          <span className={styles.badgeSecondary}>{subtypeLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemMeta}>
                      <span>Era: {eraLabel}</span>
                      {isMultiEra && <span>Multi-era</span>}
                      {primaryLabel && <span>Primary: {primaryLabel}</span>}
                    </div>
                    {summary && <div className={styles.itemSummary}>{summary}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
