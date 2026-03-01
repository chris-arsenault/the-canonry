/**
 * Section 0: Chronicle Suggestions
 *
 * Event-action-centric coverage suggestions. Groups events by action type,
 * shows covered/uncovered counts, and expands to show each uncovered event
 * instance with its full participant list, era, and significance.
 */

import React, { useState, useMemo, useCallback } from "react";
import { useExpandSingle } from "@the-canonry/shared-components";
import type { PersistedEntity, PersistedNarrativeEvent } from "../../../lib/db/illuminatorDb";
import type { SuggestionsSectionProps, EntityUsageEntry, FilterOption } from "../entityCoverageTypes";
import { eventGroupKey, prominenceLabel } from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap, SignificanceStars, ProminenceDots } from "../entityCoverageShared";
import { useColumnSort, SortableTh, StaticTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTION_MIN_SIG_OPTIONS: FilterOption[] = [
  { value: "0", label: "All significance" },
  { value: "0.3", label: ">= 0.3" },
  { value: "0.5", label: ">= 0.5" },
  { value: "0.7", label: ">= 0.7" },
];

const SUGGESTION_COVERAGE_OPTIONS: FilterOption[] = [
  { value: "uncovered", label: "Has uncovered" },
  { value: "all", label: "All actions" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionGroup {
  action: string;
  total: number;
  covered: number;
  uncovered: number;
  totalSignificance: number;
  uncoveredEvents: PersistedNarrativeEvent[];
  coveredEvents: PersistedNarrativeEvent[];
  eras: Set<string>;
  avgSignificance: number;
  coverageRate: number;
  eraCount: number;
}

interface ResolvedEntity {
  id: string;
  name: string;
  kind: string;
  culture: string;
  prominence: number;
  chronicleAppearances: number;
  role: "subject" | "participant";
}

// ---------------------------------------------------------------------------
// SuggestionActionDetail
// ---------------------------------------------------------------------------

interface SuggestionActionDetailProps {
  group: ActionGroup;
  entityMap: Map<string, PersistedEntity>;
  eraNameMap: Map<string, string>;
  entityUsage: Map<string, EntityUsageEntry>;
}

function SuggestionActionDetail({
  group,
  entityMap,
  eraNameMap,
  entityUsage,
}: SuggestionActionDetailProps) {
  const uncoveredEvents = useMemo(
    () =>
      [...group.uncoveredEvents].sort(
        (a, b) => (b as Record<string, unknown>).significance as number - ((a as Record<string, unknown>).significance as number),
      ),
    [group.uncoveredEvents],
  );

  const resolveEntity = useCallback(
    (id: string): Omit<ResolvedEntity, "role"> => {
      const ent = entityMap.get(id);
      return {
        id,
        name: ent?.name ?? id,
        kind: ent?.kind ?? "?",
        culture: ent?.culture ?? "",
        prominence: Number(ent?.prominence) || 0,
        chronicleAppearances: entityUsage.get(id)?.total ?? 0,
      };
    },
    [entityMap, entityUsage],
  );

  return (
    <div className="ecp-detail-wrap">
      <div className="ecp-detail-inner">
        <div className="ecp-detail-heading">
          {group.uncovered} uncovered event{group.uncovered !== 1 ? "s" : ""}
          {group.covered > 0 && (
            <span className="ecp-detail-covered-note">
              {" "}({group.covered} already covered)
            </span>
          )}
        </div>
        {uncoveredEvents.map((event) => {
          const ev = event as Record<string, unknown>;
          const subject = ev.subject as { id?: string; name?: string } | undefined;
          const headline =
            (ev.description as string) ||
            `${subject?.name ?? "Unknown"}: ${(ev.action as string) ?? (ev.eventKind as string)}`;
          const eraName = eraNameMap.get(ev.era as string) ?? (ev.era as string) ?? "?";
          const participantEffects = (ev.participantEffects ?? []) as Array<{
            entity?: { id?: string; name?: string; kind?: string };
          }>;

          const seen = new Set<string>();
          const involved: ResolvedEntity[] = [];
          if (subject?.id) {
            seen.add(subject.id);
            involved.push({ ...resolveEntity(subject.id), role: "subject" });
          }
          for (const p of participantEffects) {
            if (p.entity?.id && !seen.has(p.entity.id)) {
              seen.add(p.entity.id);
              involved.push({ ...resolveEntity(p.entity.id), role: "participant" });
            }
          }

          return (
            <div key={event.id} className="ecp-event-card">
              <div className="ecp-event-headline-row">
                <span className="ecp-event-headline" title={headline}>
                  {headline}
                </span>
                <SignificanceStars value={ev.significance as number} />
                <span className="ecp-event-era" title={`Era: ${eraName}`}>
                  {eraName}
                </span>
              </div>
              <div className="ecp-entity-list">
                {involved.map((ent) => (
                  <span
                    key={ent.id}
                    className="ecp-entity-chip"
                    title={[
                      `${ent.name} (${ent.kind})`,
                      ent.culture ? `Culture: ${ent.culture}` : null,
                      `Prominence: ${prominenceLabel(ent.prominence)}`,
                      `${ent.chronicleAppearances} chronicle appearance${ent.chronicleAppearances !== 1 ? "s" : ""}`,
                      ent.role === "subject" ? "Subject of event" : "Participant",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  >
                    {ent.role === "subject" ? (
                      <span className="ecp-entity-icon-subject">&#9670;</span>
                    ) : (
                      <span className="ecp-entity-icon-participant">&#9675;</span>
                    )}
                    <span className="ecp-entity-name">{ent.name}</span>
                    <span className="ecp-entity-kind">{ent.kind}</span>
                    <ProminenceDots value={ent.prominence} />
                    {ent.chronicleAppearances === 0 ? (
                      <span className="ecp-entity-new">new</span>
                    ) : (
                      <span className="ecp-entity-appearances">
                        &#9776;{ent.chronicleAppearances}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage rate color helper
// ---------------------------------------------------------------------------

function coverageRateClass(rate: number): string {
  if (rate === 1) return "ecp-color-green";
  if (rate >= 0.5) return "ecp-color-amber";
  return "ecp-color-red";
}

// ---------------------------------------------------------------------------
// SuggestionsSection
// ---------------------------------------------------------------------------

export function SuggestionsSection({
  events,
  entities,
  eventCoverage,
  entityUsage,
  expanded,
}: SuggestionsSectionProps): React.ReactElement | number {
  const [minSignificance, setMinSignificance] = useState("0");
  const [coverageFilter, setCoverageFilter] = useState("uncovered");
  const { expandedId: expandedAction, toggle: toggleAction } = useExpandSingle();
  const [sort, onSort] = useColumnSort("uncovered", true);

  const entityMap = useMemo(() => {
    const m = new Map<string, PersistedEntity>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  const eraNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entities) {
      if (e.kind === "era") m.set(e.id, e.name);
    }
    return m;
  }, [entities]);

  const actionGroups = useMemo(() => {
    const minSig = Number(minSignificance);
    const groups = new Map<string, {
      action: string;
      total: number;
      covered: number;
      uncovered: number;
      totalSignificance: number;
      uncoveredEvents: PersistedNarrativeEvent[];
      coveredEvents: PersistedNarrativeEvent[];
      eras: Set<string>;
    }>();

    for (const event of events) {
      const ev = event as Record<string, unknown>;
      if ((ev.significance as number) < minSig) continue;
      const key = eventGroupKey(event);
      const existing = groups.get(key) ?? {
        action: key,
        total: 0,
        covered: 0,
        uncovered: 0,
        totalSignificance: 0,
        uncoveredEvents: [],
        coveredEvents: [],
        eras: new Set<string>(),
      };
      existing.total += 1;
      existing.totalSignificance += ev.significance as number;
      const isCovered = (eventCoverage.get(event.id) ?? 0) > 0;
      if (isCovered) {
        existing.covered += 1;
        existing.coveredEvents.push(event);
      } else {
        existing.uncovered += 1;
        existing.uncoveredEvents.push(event);
      }
      if (ev.era) existing.eras.add(ev.era as string);
      groups.set(key, existing);
    }

    let result: ActionGroup[] = [...groups.values()].map((g) => ({
      ...g,
      avgSignificance: g.total > 0 ? g.totalSignificance / g.total : 0,
      coverageRate: g.total > 0 ? g.covered / g.total : 0,
      eraCount: g.eras.size,
    }));

    if (coverageFilter === "uncovered") result = result.filter((g) => g.uncovered > 0);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case "action": cmp = a.action.localeCompare(b.action); break;
        case "total": cmp = a.total - b.total; break;
        case "covered": cmp = a.covered - b.covered; break;
        case "uncovered": cmp = a.uncovered - b.uncovered; break;
        case "coverageRate": cmp = a.coverageRate - b.coverageRate; break;
        case "avgSig": cmp = a.avgSignificance - b.avgSignificance; break;
      }
      return sort.desc ? -cmp : cmp;
    });
    return result;
  }, [events, eventCoverage, minSignificance, coverageFilter, sort]);

  const totalUncoveredActions = useMemo(
    () => actionGroups.filter((g) => g.uncovered > 0).length,
    [actionGroups],
  );

  if (!expanded) return totalUncoveredActions;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect
          value={coverageFilter}
          onChange={setCoverageFilter}
          options={SUGGESTION_COVERAGE_OPTIONS}
          label="Coverage"
        />
        <FilterSelect
          value={minSignificance}
          onChange={setMinSignificance}
          options={SUGGESTION_MIN_SIG_OPTIONS}
          label="Min significance"
        />
        <span className="ecp-auto-count">{actionGroups.length} action types</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <StaticTh> </StaticTh>
            <SortableTh sortKey="action" sort={sort} onSort={onSort}>Event Kind</SortableTh>
            <SortableTh sortKey="total" sort={sort} onSort={onSort} right>Total</SortableTh>
            <SortableTh sortKey="covered" sort={sort} onSort={onSort} right>Cov</SortableTh>
            <SortableTh sortKey="uncovered" sort={sort} onSort={onSort} right>Uncov</SortableTh>
            <SortableTh sortKey="coverageRate" sort={sort} onSort={onSort} right>Cov%</SortableTh>
            <SortableTh sortKey="avgSig" sort={sort} onSort={onSort} right>Avg Sig</SortableTh>
          </tr>
        </thead>
        <tbody>
          {actionGroups.length === 0 && (
            <EmptyRow colSpan={7} text="No event kinds match filters" />
          )}
          {actionGroups.map((g) => {
            const isDetailExpanded = expandedAction === g.action;
            return (
              <React.Fragment key={g.action}>
                <tr
                  className={g.uncovered > 0 ? "ecp-row-clickable" : ""}
                  onClick={() => g.uncovered > 0 && toggleAction(g.action)}
                  title={
                    g.uncovered > 0
                      ? "Click to see uncovered events and their entities"
                      : "All events covered"
                  }
                >
                  <td className="ecp-expand-td">
                    {g.uncovered > 0 && (isDetailExpanded ? "\u25BC" : "\u25B6")}
                  </td>
                  <td className="ec-name">{g.action}</td>
                  <td className="ec-right">{g.total}</td>
                  <td className="ec-right ecp-color-green">{g.covered}</td>
                  <td className="ec-right">
                    {g.uncovered > 0 ? (
                      <span className="ecp-font-bold ecp-color-red">{g.uncovered}</span>
                    ) : (
                      <span className="ecp-color-muted">0</span>
                    )}
                  </td>
                  <td className="ec-right">
                    <span className={coverageRateClass(g.coverageRate)}>
                      {(g.coverageRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="ec-right">
                    <SignificanceStars value={g.avgSignificance} />
                  </td>
                </tr>
                {isDetailExpanded && (
                  <tr>
                    <td colSpan={7} className="ecp-expand-detail-td">
                      <SuggestionActionDetail
                        group={g}
                        entityMap={entityMap}
                        eraNameMap={eraNameMap}
                        entityUsage={entityUsage}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
