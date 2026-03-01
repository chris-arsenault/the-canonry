/**
 * Section 6: Era Coverage Gaps
 *
 * Chronicle distribution across eras — find underexplored time periods.
 */

import React, { useState, useMemo } from "react";
import type { ErasSectionProps } from "../entityCoverageTypes";
import { SectionToolbar, TableWrap } from "../entityCoverageShared";
import { useColumnSort, SortableTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EraRow {
  eraId: string;
  name: string;
  chronicleCount: number;
  completedCount: number;
  backportedCount: number;
  entityCount: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// ErasSection
// ---------------------------------------------------------------------------

export function ErasSection({
  entities,
  events: _events,
  eraChronicles,
  eraEntityCounts,
  eraEventCounts,
  expanded,
}: ErasSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("chronicles");
  const [uncoveredOnly, setUncoveredOnly] = useState(false);

  const rows = useMemo((): EraRow[] => {
    const allEraIds = new Set([
      ...eraChronicles.keys(),
      ...eraEntityCounts.keys(),
      ...eraEventCounts.keys(),
    ]);
    const eraEntities = entities.filter((e) => e.kind === "era");
    const eraNameMap = new Map(eraEntities.map((e) => [e.id, e.name]));

    let computed: EraRow[] = [...allEraIds].map((eraId) => {
      const chronicles = eraChronicles.get(eraId) ?? { total: 0, completed: 0, backported: 0 };
      return {
        eraId,
        name: eraNameMap.get(eraId) ?? eraId,
        chronicleCount: chronicles.total,
        completedCount: chronicles.completed,
        backportedCount: chronicles.backported,
        entityCount: eraEntityCounts.get(eraId) ?? 0,
        eventCount: eraEventCounts.get(eraId) ?? 0,
      };
    });

    if (uncoveredOnly) computed = computed.filter((r) => r.chronicleCount === 0);

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "entities": cmp = a.entityCount - b.entityCount; break;
        case "events": cmp = a.eventCount - b.eventCount; break;
        case "chronicles": cmp = a.chronicleCount - b.chronicleCount; break;
      }
      return sort.desc ? -cmp : cmp;
    });
    return computed;
  }, [entities, eraChronicles, eraEntityCounts, eraEventCounts, sort, uncoveredOnly]);

  const underutilCount = useMemo(
    () =>
      rows.filter(
        (r) => r.chronicleCount === 0 && (r.entityCount > 0 || r.eventCount > 0),
      ).length,
    [rows],
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <label className="ecp-checkbox-label">
          <input
            type="checkbox"
            checked={uncoveredOnly}
            onChange={(e) => setUncoveredOnly(e.target.checked)}
          />
          Uncovered only
        </label>
        <span className="ecp-auto-count">{rows.length} eras</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Era</SortableTh>
            <SortableTh sortKey="entities" sort={sort} onSort={onSort} right>Ents</SortableTh>
            <SortableTh sortKey="events" sort={sort} onSort={onSort} right>Evts</SortableTh>
            <SortableTh sortKey="chronicles" sort={sort} onSort={onSort}>Chronicles</SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={4} text="No era data available" />}
          {rows.map((r) => (
            <tr key={r.eraId}>
              <td className="ec-name" title={r.eraId}>{r.name}</td>
              <td className="ec-right" title={`${r.entityCount} entities`}>{r.entityCount}</td>
              <td className="ec-right" title={`${r.eventCount} events`}>{r.eventCount}</td>
              <td>
                <span
                  className={r.chronicleCount === 0 ? "ecp-color-red" : "ecp-color-green"}
                  title={`${r.chronicleCount} chronicles`}
                >
                  &#9671;{r.chronicleCount}
                </span>
                {r.completedCount > 0 && (
                  <span className="ecp-era-completed" title={`${r.completedCount} completed`}>
                    &#10003;{r.completedCount}
                  </span>
                )}
                {r.backportedCount > 0 && (
                  <span className="ecp-era-completed" title={`${r.backportedCount} backported`}>
                    &#8644;{r.backportedCount}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
