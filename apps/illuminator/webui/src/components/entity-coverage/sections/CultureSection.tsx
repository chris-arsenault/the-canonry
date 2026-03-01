/**
 * Section 3: Cultural Representation
 *
 * Primary vs supporting role distribution by culture across chronicles.
 */

import React, { useState, useMemo } from "react";
import type { CultureSectionProps } from "../entityCoverageTypes";
import { getKindOptions } from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap, ProminenceDots } from "../entityCoverageShared";
import { useColumnSort, SortableTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CultureRow {
  culture: string;
  entityCount: number;
  primaryCount: number;
  supportingCount: number;
  totalRoles: number;
  primaryRatio: number;
  appearedCount: number;
  appearanceRate: number;
  avgProminence: number;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function primaryRatioClass(ratio: number): string {
  if (ratio < 0.2) return "ecp-color-red";
  if (ratio < 0.4) return "ecp-color-amber";
  return "ecp-color-green";
}

function appearanceRateClass(rate: number): string {
  if (rate < 0.3) return "ecp-color-red";
  if (rate < 0.6) return "ecp-color-amber";
  return "ecp-color-green";
}

// ---------------------------------------------------------------------------
// CultureSection
// ---------------------------------------------------------------------------

export function CultureSection({
  entities,
  cultureRoles,
  cultureEntities,
  entityUsage,
  expanded,
}: CultureSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("primaryRatio");
  const [kindFilter, setKindFilter] = useState("all");
  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);

  const rows = useMemo((): CultureRow[] => {
    const allCultures = new Set([...cultureRoles.keys(), ...cultureEntities.keys()]);
    return [...allCultures]
      .map((culture) => {
        const roles = cultureRoles.get(culture) ?? {
          primary: 0,
          supporting: 0,
          entityIds: new Set<string>(),
        };
        const entData = cultureEntities.get(culture) ?? {
          count: 0,
          totalProminence: 0,
          entityIds: new Set<string>(),
        };

        let entityCount = entData.count;
        let totalProminence = entData.totalProminence;
        let appearedCount = 0;
        const cultureEnts = entities.filter(
          (e) =>
            e.culture === culture &&
            e.kind !== "era" &&
            (kindFilter === "all" || e.kind === kindFilter),
        );
        if (kindFilter !== "all") {
          entityCount = cultureEnts.length;
          totalProminence = cultureEnts.reduce(
            (sum, e) => sum + (Number(e.prominence) || 0),
            0,
          );
        }
        for (const e of cultureEnts) {
          if (entityUsage.has(e.id)) appearedCount += 1;
        }

        const totalRoles = roles.primary + roles.supporting;
        return {
          culture,
          entityCount,
          primaryCount: roles.primary,
          supportingCount: roles.supporting,
          totalRoles,
          primaryRatio: totalRoles > 0 ? roles.primary / totalRoles : 0,
          appearedCount,
          appearanceRate: entityCount > 0 ? appearedCount / entityCount : 0,
          avgProminence: entityCount > 0 ? totalProminence / entityCount : 0,
        };
      })
      .filter((r) => r.entityCount > 0)
      .sort((a, b) => {
        let cmp = 0;
        switch (sort.col) {
          case "culture": cmp = a.culture.localeCompare(b.culture); break;
          case "entityCount": cmp = a.entityCount - b.entityCount; break;
          case "roles": cmp = a.totalRoles - b.totalRoles; break;
          case "primaryRatio": cmp = a.primaryRatio - b.primaryRatio; break;
          case "appearanceRate": cmp = a.appearanceRate - b.appearanceRate; break;
          case "prominence": cmp = a.avgProminence - b.avgProminence; break;
        }
        return sort.desc ? -cmp : cmp;
      });
  }, [entities, cultureRoles, cultureEntities, entityUsage, sort, kindFilter]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.entityCount >= 3 && r.appearanceRate < 0.3).length,
    [rows],
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <span className="ecp-auto-count">{rows.length} cultures</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="culture" sort={sort} onSort={onSort}>Culture</SortableTh>
            <SortableTh sortKey="entityCount" sort={sort} onSort={onSort} right>Ents</SortableTh>
            <SortableTh sortKey="roles" sort={sort} onSort={onSort}>Roles</SortableTh>
            <SortableTh sortKey="primaryRatio" sort={sort} onSort={onSort} right>% Pri</SortableTh>
            <SortableTh sortKey="appearanceRate" sort={sort} onSort={onSort} right>% Cov</SortableTh>
            <SortableTh sortKey="prominence" sort={sort} onSort={onSort}>Prom</SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6} text="No culture data available" />}
          {rows.map((r) => (
            <tr key={r.culture}>
              <td className="ec-name">{r.culture}</td>
              <td className="ec-right" title={`${r.entityCount} entities`}>
                &#9776; {r.entityCount}
              </td>
              <td>
                <span className="ecp-color-blue" title={`${r.primaryCount} primary roles`}>
                  &#9670;{r.primaryCount}
                </span>{" "}
                <span className="ecp-color-muted" title={`${r.supportingCount} supporting roles`}>
                  &#9675;{r.supportingCount}
                </span>
              </td>
              <td className="ec-right">
                {r.totalRoles > 0 ? (
                  <span
                    className={`ecp-font-bold ${primaryRatioClass(r.primaryRatio)}`}
                    title={`Primary ratio: ${(r.primaryRatio * 100).toFixed(0)}%`}
                  >
                    {(r.primaryRatio * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="ecp-color-muted">&mdash;</span>
                )}
              </td>
              <td className="ec-right">
                <span
                  className={appearanceRateClass(r.appearanceRate)}
                  title={`${r.appearedCount}/${r.entityCount} entities appeared in chronicles`}
                >
                  {(r.appearanceRate * 100).toFixed(0)}%
                </span>
              </td>
              <td><ProminenceDots value={r.avgProminence} /></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
