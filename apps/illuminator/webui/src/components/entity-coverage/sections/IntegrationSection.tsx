/**
 * Section 7: Lore Integration Gaps
 *
 * Pipeline completeness — description, backrefs, history, historian notes, image.
 */

import React, { useState, useMemo } from "react";
import type { IntegrationSectionProps, FilterOption } from "../entityCoverageTypes";
import type { PersistedEntity } from "../../../lib/db/illuminatorDb";
import { getKindOptions, getCultureOptions } from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap, ProminenceDots, StatusDot } from "../entityCoverageShared";
import { useColumnSort, SortableTh, StaticTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAP_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All gaps" },
  { value: "no_description", label: "Missing description" },
  { value: "no_backrefs", label: "Missing backrefs" },
  { value: "no_history", label: "Missing history" },
  { value: "no_historian", label: "Missing historian" },
  { value: "no_image", label: "Missing image" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichmentShape {
  chronicleBackrefs?: unknown[];
  descriptionHistory?: unknown[];
  historianNotes?: unknown[];
  image?: { imageId?: string };
}

interface IntegrationRow {
  entity: PersistedEntity;
  hasDescription: boolean;
  hasBackrefs: boolean;
  backrefCount: number;
  historyCount: number;
  hasHistorianNotes: boolean;
  historianNoteCount: number;
  hasImage: boolean;
  backportedCount: number;
  gapScore: number;
}

// ---------------------------------------------------------------------------
// Row computation (extracted to reduce component complexity)
// ---------------------------------------------------------------------------

function computeIntegrationRows(
  entities: PersistedEntity[],
  entityBackportedCount: Map<string, number>,
  kindFilter: string,
  cultureFilter: string,
): IntegrationRow[] {
  let filtered = entities.filter((e) => e.kind !== "era");
  if (kindFilter !== "all") filtered = filtered.filter((e) => e.kind === kindFilter);
  if (cultureFilter !== "all") filtered = filtered.filter((e) => e.culture === cultureFilter);

  return filtered.map((e) => {
    const enrichment = (e as Record<string, unknown>).enrichment as EnrichmentShape | undefined;
    const hasDescription = Boolean(e.description);
    const hasBackrefs = (enrichment?.chronicleBackrefs?.length ?? 0) > 0;
    const historyCount = enrichment?.descriptionHistory?.length ?? 0;
    const hasHistorianNotes = (enrichment?.historianNotes?.length ?? 0) > 0;
    const historianNoteCount = enrichment?.historianNotes?.length ?? 0;
    const hasImage = Boolean(enrichment?.image?.imageId);
    const backportedCount = entityBackportedCount.get(e.id) ?? 0;

    let gapScore = 0;
    if (!hasDescription) gapScore += 1;
    if (!hasBackrefs) gapScore += 1;
    if (historyCount === 0) gapScore += 1;
    if (!hasHistorianNotes) gapScore += 1;
    if (!hasImage) gapScore += 1;

    return {
      entity: e,
      hasDescription,
      hasBackrefs,
      backrefCount: enrichment?.chronicleBackrefs?.length ?? 0,
      historyCount,
      hasHistorianNotes,
      historianNoteCount,
      hasImage,
      backportedCount,
      gapScore,
    };
  });
}

function applyGapFilter(rows: IntegrationRow[], gapFilter: string): IntegrationRow[] {
  switch (gapFilter) {
    case "no_description": return rows.filter((r) => !r.hasDescription);
    case "no_backrefs": return rows.filter((r) => !r.hasBackrefs);
    case "no_history": return rows.filter((r) => r.historyCount === 0);
    case "no_historian": return rows.filter((r) => !r.hasHistorianNotes);
    case "no_image": return rows.filter((r) => !r.hasImage);
    default: return rows;
  }
}

function gapScoreClass(score: number): string {
  if (score >= 3) return "ecp-color-red";
  if (score >= 2) return "ecp-color-amber";
  return "ecp-color-muted";
}

// ---------------------------------------------------------------------------
// IntegrationSection
// ---------------------------------------------------------------------------

export function IntegrationSection({
  entities,
  entityBackportedCount,
  expanded,
}: IntegrationSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("gaps", true);
  const [kindFilter, setKindFilter] = useState("all");
  const [cultureFilter, setCultureFilter] = useState("all");
  const [gapFilter, setGapFilter] = useState("all");

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo((): IntegrationRow[] => {
    const computed = computeIntegrationRows(entities, entityBackportedCount, kindFilter, cultureFilter);
    const filtered = applyGapFilter(computed, gapFilter);

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case "name": cmp = a.entity.name.localeCompare(b.entity.name); break;
        case "kind": cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case "prominence":
          cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0);
          break;
        case "gaps": cmp = a.gapScore - b.gapScore; break;
      }
      return sort.desc ? -cmp : cmp;
    });
    return filtered;
  }, [entities, entityBackportedCount, sort, kindFilter, cultureFilter, gapFilter]);

  const underutilCount = useMemo(
    () =>
      rows.filter(
        (r) => r.gapScore >= 3 && (Number(r.entity.prominence) || 0) >= 2,
      ).length,
    [rows],
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={gapFilter} onChange={setGapFilter} options={GAP_FILTER_OPTIONS} label="Gap type" />
        <span className="ecp-auto-count">{rows.length} entities</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Entity</SortableTh>
            <SortableTh sortKey="kind" sort={sort} onSort={onSort}>Kind</SortableTh>
            <SortableTh sortKey="prominence" sort={sort} onSort={onSort}>Prom</SortableTh>
            <StaticTh>Desc / Ref / Hist / Hstr / Img</StaticTh>
            <SortableTh sortKey="gaps" sort={sort} onSort={onSort} right>Gaps</SortableTh>
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
              <td>
                <span className="ecp-status-dot-row">
                  <StatusDot
                    active={r.hasDescription}
                    label={r.hasDescription ? "Has description" : "Missing description"}
                  />
                  <StatusDot
                    active={r.hasBackrefs}
                    label={r.hasBackrefs ? `${r.backrefCount} backrefs` : "No backrefs"}
                  />
                  <StatusDot
                    active={r.historyCount > 0}
                    label={r.historyCount > 0 ? `${r.historyCount} revisions` : "No description history"}
                  />
                  <StatusDot
                    active={r.hasHistorianNotes}
                    label={r.hasHistorianNotes ? `${r.historianNoteCount} notes` : "No historian notes"}
                  />
                  <StatusDot
                    active={r.hasImage}
                    label={r.hasImage ? "Has image" : "Missing image"}
                  />
                </span>
              </td>
              <td className={`ec-right ${gapScoreClass(r.gapScore)}`}>
                {r.gapScore}/5
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
