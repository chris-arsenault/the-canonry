/**
 * Section 5: Untapped Story Potential
 *
 * Story potential score vs actual chronicle usage — find underused narrative anchors.
 */

import React, { useState, useMemo } from "react";
import type { PotentialSectionProps, FilterOption } from "../entityCoverageTypes";
import { getKindOptions, getCultureOptions } from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap } from "../entityCoverageShared";
import { useColumnSort, SortableTh, StaticTh, EmptyRow } from "../entityCoverageTableHelpers";
import { computeAllStoryPotentials, scoreToRating } from "../../../lib/chronicle/storyPotential";
import type { PersistedEntity } from "../../../lib/db/illuminatorDb";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_POTENTIAL_OPTIONS: FilterOption[] = [
  { value: "0", label: "All potential" },
  { value: "0.3", label: ">= 0.3" },
  { value: "0.5", label: ">= 0.5" },
  { value: "0.7", label: ">= 0.7" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PotentialRow {
  entity: PersistedEntity;
  score: number;
  usage: { total: number; primary: number; supporting: number };
  gap: number;
  neverPrimary: boolean;
}

// ---------------------------------------------------------------------------
// PotentialSection
// ---------------------------------------------------------------------------

export function PotentialSection({
  entities,
  narrativeEvents,
  relationships,
  entityUsage,
  expanded,
}: PotentialSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("gap", true);
  const [kindFilter, setKindFilter] = useState("all");
  const [cultureFilter, setCultureFilter] = useState("all");
  const [minPotential, setMinPotential] = useState("0");
  const [zeroOnly, setZeroOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const entityContexts = useMemo(() => {
    return entities
      .filter((e) => e.kind !== "era")
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        subtype: (e as Record<string, unknown>).subtype as string | undefined,
        prominence: e.prominence,
        culture: e.culture,
        status: e.status,
        tags: (e as Record<string, unknown>).tags as Record<string, string> ?? {},
        eraId: (e as Record<string, unknown>).eraId as string | undefined,
        summary: (e as Record<string, unknown>).summary as string | undefined,
        description: e.description,
        createdAt: (e as Record<string, unknown>).createdAt as number,
        updatedAt: (e as Record<string, unknown>).updatedAt as number,
      }));
  }, [entities]);

  const eventContexts = useMemo(() => {
    return narrativeEvents.map((e) => {
      const ev = e as Record<string, unknown>;
      const participantEffects = (ev.participantEffects ?? []) as Array<{
        entity?: { id?: string; name?: string; kind?: string };
      }>;
      const subject = ev.subject as { id?: string; name?: string } | undefined;
      return {
        id: e.id,
        tick: ev.tick as number,
        era: ev.era as string,
        eventKind: ev.eventKind as string,
        significance: ev.significance as number,
        headline: (ev.description as string) ?? (ev.action as string) ?? "",
        description: ev.description as string | undefined,
        subjectId: subject?.id,
        subjectName: subject?.name,
        participants: participantEffects.map((p) => ({
          id: p.entity?.id,
          name: p.entity?.name,
          kind: p.entity?.kind,
        })),
      };
    });
  }, [narrativeEvents]);

  const relationshipContexts = useMemo(() => {
    return relationships.map((r) => ({
      src: (r as Record<string, unknown>).src as string,
      dst: (r as Record<string, unknown>).dst as string,
      kind: r.kind,
      strength: (r as Record<string, unknown>).strength as number | undefined,
      sourceName: "",
      sourceKind: "",
      targetName: "",
      targetKind: "",
    }));
  }, [relationships]);

  const potentialMap = useMemo(() => {
    if (!expanded) return new Map<string, { potential: { overallScore: number } }>();
    return computeAllStoryPotentials(entityContexts, relationshipContexts, eventContexts);
  }, [expanded, entityContexts, relationshipContexts, eventContexts]);

  const maxUsage = useMemo(() => {
    let max = 0;
    for (const [, usage] of entityUsage) {
      if (usage.total > max) max = usage.total;
    }
    return max;
  }, [entityUsage]);

  const rows = useMemo((): PotentialRow[] => {
    if (!expanded) return [];
    const minPot = Number(minPotential);
    let filtered = entities.filter((e) => e.kind !== "era");
    if (kindFilter !== "all") filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== "all") filtered = filtered.filter((e) => e.culture === cultureFilter);

    const computed: PotentialRow[] = filtered
      .map((e) => {
        const pot = potentialMap.get(e.id) as { potential?: { overallScore?: number } } | undefined;
        const score = pot?.potential?.overallScore ?? 0;
        const usage = entityUsage.get(e.id) ?? { total: 0, primary: 0, supporting: 0 };
        const normalizedUsage = maxUsage > 0 ? usage.total / maxUsage : 0;
        const gap = score - normalizedUsage;
        return {
          entity: e,
          score,
          usage,
          gap,
          neverPrimary: usage.total > 0 && usage.primary === 0,
        };
      })
      .filter((r) => r.score >= minPot);

    if (zeroOnly) return computed.filter((r) => r.usage.total === 0);

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case "name": cmp = a.entity.name.localeCompare(b.entity.name); break;
        case "kind": cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case "potential": cmp = a.score - b.score; break;
        case "appearances": cmp = a.usage.total - b.usage.total; break;
        case "gap": cmp = a.gap - b.gap; break;
      }
      return sort.desc ? -cmp : cmp;
    });
    return computed;
  }, [expanded, entities, potentialMap, entityUsage, maxUsage, sort, kindFilter, cultureFilter, minPotential, zeroOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.score >= 0.5 && r.usage.total === 0).length,
    [rows],
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={minPotential} onChange={setMinPotential} options={MIN_POTENTIAL_OPTIONS} label="Min potential" />
        <label className="ecp-checkbox-label">
          <input type="checkbox" checked={zeroOnly} onChange={(e) => setZeroOnly(e.target.checked)} />
          Zero appearances
        </label>
        <span className="ecp-auto-count">{rows.length} entities</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Entity</SortableTh>
            <SortableTh sortKey="kind" sort={sort} onSort={onSort}>Kind</SortableTh>
            <SortableTh sortKey="potential" sort={sort} onSort={onSort}>Potential</SortableTh>
            <SortableTh sortKey="appearances" sort={sort} onSort={onSort} right>&#9776;</SortableTh>
            <StaticTh>Roles</StaticTh>
            <SortableTh sortKey="gap" sort={sort} onSort={onSort} right>Gap</SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6} text="No entities match filters" />}
          {rows.map((r) => {
            const rating = scoreToRating(r.score);
            return (
              <tr key={r.entity.id}>
                <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>
                  {r.entity.name}
                </td>
                <td className="ec-muted">{r.entity.kind}</td>
                <td>
                  <span className="ecp-potential-stars" title={`Story potential: ${(r.score * 100).toFixed(0)}%`}>
                    {"\u25CF".repeat(rating)}
                    {"\u25CB".repeat(5 - rating)}
                  </span>
                </td>
                <td className="ec-right" title={`${r.usage.total} chronicle appearances`}>
                  {r.usage.total}
                </td>
                <td>
                  <span className="ecp-color-blue" title={`${r.usage.primary} as primary`}>
                    &#9670;{r.usage.primary}
                  </span>{" "}
                  <span className="ecp-color-muted" title={`${r.usage.supporting} as supporting`}>
                    &#9675;{r.usage.supporting}
                  </span>
                  {r.neverPrimary && (
                    <span className="ecp-never-primary" title="Never primary">!</span>
                  )}
                </td>
                <td className="ec-right">
                  {r.gap > 0.2 ? (
                    <span className="ecp-divergence-warning" title={`Gap: ${(r.gap * 100).toFixed(0)}%`}>
                      &uarr;{(r.gap * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="ecp-color-muted">&mdash;</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
