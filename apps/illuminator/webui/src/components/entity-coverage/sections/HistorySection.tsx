/**
 * Section 2: Description History per Entity
 *
 * Description rewrites from lore backport vs. backref mentions.
 * Divergence signals shallow integration.
 */

import React, { useState, useMemo } from "react";
import type { HistorySectionProps } from "../entityCoverageTypes";
import type { PersistedEntity } from "../../../lib/db/illuminatorDb";
import {
  prominenceLabel,
  expectedForProminence,
  getKindOptions,
  getCultureOptions,
  PROMINENCE_OPTIONS,
} from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap, ProminenceDots } from "../entityCoverageShared";
import { useColumnSort, SortableTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryRow {
  entity: PersistedEntity;
  historyCount: number;
  backrefCount: number;
  divergence: number;
  expected: number;
  historyRatio: number;
  latestSource: string | null;
}

interface EnrichmentShape {
  chronicleBackrefs?: unknown[];
  descriptionHistory?: Array<{ source?: string }>;
}

// ---------------------------------------------------------------------------
// Row computation (extracted to reduce component complexity)
// ---------------------------------------------------------------------------

function computeHistoryRows(
  entities: PersistedEntity[],
  kindFilter: string,
  cultureFilter: string,
  prominenceFilter: string,
): HistoryRow[] {
  let filtered = entities.filter((e) => e.kind !== "era");
  if (kindFilter !== "all") filtered = filtered.filter((e) => e.kind === kindFilter);
  if (cultureFilter !== "all") filtered = filtered.filter((e) => e.culture === cultureFilter);
  if (prominenceFilter !== "all")
    filtered = filtered.filter((e) => prominenceLabel(e.prominence) === prominenceFilter);

  return filtered.map((e) => {
    const enrichment = (e as Record<string, unknown>).enrichment as EnrichmentShape | undefined;
    const historyCount = enrichment?.descriptionHistory?.length ?? 0;
    const backrefCount = enrichment?.chronicleBackrefs?.length ?? 0;
    const divergence = backrefCount - historyCount;
    const expected = expectedForProminence(e.prominence);
    let historyRatio: number;
    if (expected > 0) historyRatio = historyCount / expected;
    else if (historyCount > 0) historyRatio = Infinity;
    else historyRatio = 0;

    const history = enrichment?.descriptionHistory;
    const latestSource = history?.length
      ? (history[history.length - 1].source ?? null)
      : null;

    return { entity: e, historyCount, backrefCount, divergence, expected, historyRatio, latestSource };
  });
}

function sortHistoryRows(rows: HistoryRow[], col: string, desc: boolean): HistoryRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "name": cmp = a.entity.name.localeCompare(b.entity.name); break;
      case "kind": cmp = a.entity.kind.localeCompare(b.entity.kind); break;
      case "prominence":
        cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0);
        break;
      case "history": cmp = a.historyCount - b.historyCount; break;
      case "backrefs": cmp = a.backrefCount - b.backrefCount; break;
      case "divergence": cmp = a.divergence - b.divergence; break;
      case "source": cmp = (a.latestSource ?? "").localeCompare(b.latestSource ?? ""); break;
    }
    return desc ? -cmp : cmp;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// HistorySection
// ---------------------------------------------------------------------------

export function HistorySection({
  entities,
  expanded,
}: HistorySectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("divergence", true);
  const [kindFilter, setKindFilter] = useState("all");
  const [cultureFilter, setCultureFilter] = useState("all");
  const [prominenceFilter, setProminenceFilter] = useState("all");
  const [divergentOnly, setDivergentOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo((): HistoryRow[] => {
    const computed = computeHistoryRows(entities, kindFilter, cultureFilter, prominenceFilter);
    if (divergentOnly) {
      return computed.filter((r) => r.backrefCount > 0 && r.historyCount === 0);
    }
    return sortHistoryRows(computed, sort.col, sort.desc);
  }, [entities, sort, kindFilter, cultureFilter, prominenceFilter, divergentOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.backrefCount > 0 && r.historyCount === 0).length,
    [rows],
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={prominenceFilter} onChange={setProminenceFilter} options={PROMINENCE_OPTIONS} label="Prominence" />
        <label className="ecp-checkbox-label">
          <input type="checkbox" checked={divergentOnly} onChange={(e) => setDivergentOnly(e.target.checked)} />
          Backrefs but no history
        </label>
        <span className="ecp-auto-count">{rows.length} entities</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Entity</SortableTh>
            <SortableTh sortKey="kind" sort={sort} onSort={onSort}>Kind</SortableTh>
            <SortableTh sortKey="prominence" sort={sort} onSort={onSort}>Prom</SortableTh>
            <SortableTh sortKey="history" sort={sort} onSort={onSort} right>Hist</SortableTh>
            <SortableTh sortKey="backrefs" sort={sort} onSort={onSort} right>Refs</SortableTh>
            <SortableTh sortKey="divergence" sort={sort} onSort={onSort} right>Div</SortableTh>
            <SortableTh sortKey="source" sort={sort} onSort={onSort}>Source</SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7} text="No entities match filters" />}
          {rows.map((r) => (
            <tr key={r.entity.id}>
              <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>
                {r.entity.name}
              </td>
              <td className="ec-muted">{r.entity.kind}</td>
              <td><ProminenceDots value={r.entity.prominence} /></td>
              <td className="ec-right" title={`${r.historyCount} description revisions`}>
                &#9998; {r.historyCount}
              </td>
              <td className="ec-right" title={`${r.backrefCount} backrefs`}>
                &#8644; {r.backrefCount}
              </td>
              <td className="ec-right">
                {r.divergence > 0 ? (
                  <span className="ecp-divergence-warning" title={`${r.divergence} more backrefs than history revisions`}>
                    +{r.divergence}
                  </span>
                ) : (
                  <span className="ecp-color-muted">&mdash;</span>
                )}
              </td>
              <td className="ec-muted" title={r.latestSource ? `Latest source: ${r.latestSource}` : "No revisions"}>
                {r.latestSource ?? "&mdash;"}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
