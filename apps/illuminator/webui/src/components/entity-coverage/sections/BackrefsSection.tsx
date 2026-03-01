/**
 * Section 1: Chronicle Backrefs per Entity
 *
 * Backref links from entity descriptions to source chronicles, relative to prominence.
 */

import React, { useState, useMemo } from "react";
import type { BackrefsSectionProps } from "../entityCoverageTypes";
import {
  prominenceLabel,
  expectedForProminence,
  getKindOptions,
  getCultureOptions,
  PROMINENCE_OPTIONS,
} from "../entityCoverageUtils";
import {
  SectionToolbar,
  FilterSelect,
  TableWrap,
  ProminenceDots,
  RatioIndicator,
} from "../entityCoverageShared";
import { useColumnSort, SortableTh, EmptyRow } from "../entityCoverageTableHelpers";
import type { PersistedEntity } from "../../../lib/db/illuminatorDb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackrefRow {
  entity: PersistedEntity;
  backrefCount: number;
  expected: number;
  ratio: number;
}

// ---------------------------------------------------------------------------
// BackrefsSection
// ---------------------------------------------------------------------------

export function BackrefsSection({
  entities,
  expanded,
}: BackrefsSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("ratio");
  const [kindFilter, setKindFilter] = useState("all");
  const [cultureFilter, setCultureFilter] = useState("all");
  const [prominenceFilter, setProminenceFilter] = useState("all");
  const [descOnly, setDescOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo((): BackrefRow[] => {
    let filtered = entities.filter((e) => e.kind !== "era");
    if (kindFilter !== "all") filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== "all") filtered = filtered.filter((e) => e.culture === cultureFilter);
    if (prominenceFilter !== "all")
      filtered = filtered.filter((e) => prominenceLabel(e.prominence) === prominenceFilter);
    if (descOnly) filtered = filtered.filter((e) => e.description);

    const computed: BackrefRow[] = filtered.map((e) => {
      const enrichment = (e as Record<string, unknown>).enrichment as
        | { chronicleBackrefs?: unknown[] }
        | undefined;
      const backrefCount = enrichment?.chronicleBackrefs?.length ?? 0;
      const exp = expectedForProminence(e.prominence);
      let ratio: number;
      if (exp > 0) ratio = backrefCount / exp;
      else if (backrefCount > 0) ratio = Infinity;
      else ratio = 0;
      return { entity: e, backrefCount, expected: exp, ratio };
    });

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case "name": cmp = a.entity.name.localeCompare(b.entity.name); break;
        case "kind": cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case "prominence":
          cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0);
          break;
        case "backrefs": cmp = a.backrefCount - b.backrefCount; break;
        case "ratio": cmp = a.ratio - b.ratio; break;
      }
      return sort.desc ? -cmp : cmp;
    });
    return computed;
  }, [entities, sort, kindFilter, cultureFilter, prominenceFilter, descOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.expected > 0 && r.ratio < 1).length,
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
          <input type="checkbox" checked={descOnly} onChange={(e) => setDescOnly(e.target.checked)} />
          Has description
        </label>
        <span className="ecp-auto-count">{rows.length} entities</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Entity</SortableTh>
            <SortableTh sortKey="kind" sort={sort} onSort={onSort}>Kind</SortableTh>
            <SortableTh sortKey="prominence" sort={sort} onSort={onSort}>Prom</SortableTh>
            <SortableTh sortKey="backrefs" sort={sort} onSort={onSort} right>Refs</SortableTh>
            <SortableTh sortKey="ratio" sort={sort} onSort={onSort} right>Ratio</SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5} text="No entities match filters" />}
          {rows.map((r) => (
            <tr key={r.entity.id}>
              <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>
                {r.entity.name}
              </td>
              <td className="ec-muted">{r.entity.kind}</td>
              <td><ProminenceDots value={r.entity.prominence} /></td>
              <td className="ec-right" title={`${r.backrefCount} backrefs`}>
                &#8644; {r.backrefCount}
              </td>
              <td className="ec-right">
                <RatioIndicator ratio={r.ratio} expected={r.expected} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
