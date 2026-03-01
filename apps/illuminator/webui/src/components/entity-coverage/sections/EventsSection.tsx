/**
 * Section 4: Rare Event Coverage
 *
 * High-significance events not yet selected for any chronicle.
 * Two views: per-event table and kind-frequency aggregated table.
 */

import React, { useState, useMemo } from "react";
import type { PersistedNarrativeEvent } from "../../../lib/db/illuminatorDb";
import type { EventsSectionProps, FilterOption, SortState } from "../entityCoverageTypes";
import { getEraOptions, getEventKindOptions } from "../entityCoverageUtils";
import { SectionToolbar, FilterSelect, TableWrap, SignificanceStars, CoverageIndicator } from "../entityCoverageShared";
import { useColumnSort, SortableTh, StaticTh, EmptyRow } from "../entityCoverageTableHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNIFICANCE_OPTIONS: FilterOption[] = [
  { value: "0", label: "All significance" },
  { value: "0.5", label: ">= 0.5" },
  { value: "0.6", label: ">= 0.6" },
  { value: "0.7", label: ">= 0.7" },
  { value: "0.8", label: ">= 0.8" },
  { value: "0.9", label: ">= 0.9" },
];

const COVERAGE_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All events" },
  { value: "uncovered", label: "Uncovered only" },
  { value: "covered", label: "Covered only" },
];

const VIEW_MODE_OPTIONS: FilterOption[] = [
  { value: "events", label: "Per-event" },
  { value: "frequency", label: "Kind frequency" },
];

const GROUP_BY_OPTIONS: FilterOption[] = [
  { value: "action", label: "By action" },
  { value: "eventKind", label: "By event kind" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventRow {
  event: PersistedNarrativeEvent;
  participantCount: number;
  chronicleCount: number;
  isCovered: boolean;
  compositeImportance: number;
  headline: string;
}

interface FreqEntityInfo {
  name: string;
  kind: string;
  count: number;
}

interface FreqRow {
  key: string;
  count: number;
  coveredCount: number;
  totalSignificance: number;
  totalParticipants: number;
  eventKinds: Set<string>;
  eras: Set<string>;
  entities: Map<string, FreqEntityInfo>;
  avgSignificance: number;
  avgParticipants: number;
  coverageRate: number;
  eraCount: number;
  entityCount: number;
  entityList: FreqEntityInfo[];
  eventKindLabel: string;
}

// ---------------------------------------------------------------------------
// Per-event row builder
// ---------------------------------------------------------------------------

function buildEventRows(
  filteredEvents: PersistedNarrativeEvent[],
  eventCoverage: Map<string, number>,
  sort: SortState,
  coverageFilter: string,
): EventRow[] {
  const computed: EventRow[] = filteredEvents.map((event) => {
    const ev = event as Record<string, unknown>;
    const participantEffects = (ev.participantEffects ?? []) as unknown[];
    const participantCount = participantEffects.length;
    const chronicleCount = eventCoverage.get(event.id) || 0;
    const isCovered = chronicleCount > 0;
    const significance = ev.significance as number;
    const compositeImportance = significance * (1 + Math.log2(Math.max(participantCount, 1)));
    const subject = ev.subject as { name?: string } | undefined;
    const headline =
      (ev.description as string) ||
      `${subject?.name ?? "Unknown"}: ${(ev.action as string) ?? (ev.eventKind as string)}`;
    return { event, participantCount, chronicleCount, isCovered, compositeImportance, headline };
  });

  if (coverageFilter === "uncovered") return computed.filter((r) => !r.isCovered);
  if (coverageFilter === "covered") return computed.filter((r) => r.isCovered);

  computed.sort((a, b) => {
    let cmp = 0;
    switch (sort.col) {
      case "importance":
        if (a.isCovered !== b.isCovered) return a.isCovered ? 1 : -1;
        cmp = a.compositeImportance - b.compositeImportance;
        break;
      case "headline": cmp = a.headline.localeCompare(b.headline); break;
      case "significance":
        cmp = ((a.event as Record<string, unknown>).significance as number) -
              ((b.event as Record<string, unknown>).significance as number);
        break;
      case "participants": cmp = a.participantCount - b.participantCount; break;
      case "era":
        cmp = ((a.event as Record<string, unknown>).era as string ?? "").localeCompare(
          (b.event as Record<string, unknown>).era as string ?? "",
        );
        break;
      case "chronicles": cmp = a.chronicleCount - b.chronicleCount; break;
    }
    return sort.desc ? -cmp : cmp;
  });
  return computed;
}

// ---------------------------------------------------------------------------
// Frequency row builder
// ---------------------------------------------------------------------------

function buildFreqRows(
  filteredEvents: PersistedNarrativeEvent[],
  eventCoverage: Map<string, number>,
  groupBy: string,
  freqSort: SortState,
): FreqRow[] {
  const groups = new Map<string, {
    key: string;
    count: number;
    coveredCount: number;
    totalSignificance: number;
    totalParticipants: number;
    eventKinds: Set<string>;
    eras: Set<string>;
    entities: Map<string, FreqEntityInfo>;
  }>();

  for (const event of filteredEvents) {
    const ev = event as Record<string, unknown>;
    const rawAction = (ev.action as string) ?? (ev.eventKind as string) ?? "unknown";
    const baseAction =
      rawAction.indexOf(":") > 0 ? rawAction.slice(0, rawAction.indexOf(":")) : rawAction;
    const key = groupBy === "action" ? baseAction : (ev.eventKind as string) ?? "unknown";
    const existing = groups.get(key) ?? {
      key,
      count: 0,
      coveredCount: 0,
      totalSignificance: 0,
      totalParticipants: 0,
      eventKinds: new Set<string>(),
      eras: new Set<string>(),
      entities: new Map<string, FreqEntityInfo>(),
    };
    existing.count += 1;
    if ((eventCoverage.get(event.id) ?? 0) > 0) existing.coveredCount += 1;
    existing.totalSignificance += ev.significance as number;
    const participantEffects = (ev.participantEffects ?? []) as Array<{
      entity?: { id?: string; name?: string; kind?: string };
    }>;
    existing.totalParticipants += participantEffects.length;
    if (groupBy === "action") existing.eventKinds.add(ev.eventKind as string);
    if (ev.era) existing.eras.add(ev.era as string);

    const subject = ev.subject as { id?: string; name?: string; kind?: string } | undefined;
    if (subject?.id) {
      const ent = existing.entities.get(subject.id) ?? {
        name: subject.name ?? subject.id,
        kind: subject.kind ?? "",
        count: 0,
      };
      ent.count += 1;
      existing.entities.set(subject.id, ent);
    }
    for (const p of participantEffects) {
      if (p.entity?.id && p.entity.id !== subject?.id) {
        const ent = existing.entities.get(p.entity.id) ?? {
          name: p.entity.name ?? p.entity.id,
          kind: p.entity.kind ?? "",
          count: 0,
        };
        ent.count += 1;
        existing.entities.set(p.entity.id, ent);
      }
    }
    groups.set(key, existing);
  }

  const computed: FreqRow[] = [...groups.values()].map((g) => {
    const entityList = [...g.entities.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    return {
      ...g,
      avgSignificance: g.count > 0 ? g.totalSignificance / g.count : 0,
      avgParticipants: g.count > 0 ? g.totalParticipants / g.count : 0,
      coverageRate: g.count > 0 ? g.coveredCount / g.count : 0,
      eraCount: g.eras.size,
      entityCount: g.entities.size,
      entityList,
      eventKindLabel: [...g.eventKinds].join(", "),
    };
  });

  computed.sort((a, b) => {
    let cmp = 0;
    switch (freqSort.col) {
      case "key": cmp = a.key.localeCompare(b.key); break;
      case "count": cmp = a.count - b.count; break;
      case "covered": cmp = a.coveredCount - b.coveredCount; break;
      case "coverageRate": cmp = a.coverageRate - b.coverageRate; break;
      case "avgSig": cmp = a.avgSignificance - b.avgSignificance; break;
      case "avgPart": cmp = a.avgParticipants - b.avgParticipants; break;
      case "eras": cmp = a.eraCount - b.eraCount; break;
      case "entities": cmp = a.entityCount - b.entityCount; break;
    }
    return freqSort.desc ? -cmp : cmp;
  });
  return computed;
}

// ---------------------------------------------------------------------------
// Per-event table sub-component
// ---------------------------------------------------------------------------

interface EventTableProps {
  rows: EventRow[];
  sort: SortState;
  onSort: (col: string) => void;
}

function EventTable({ rows, sort, onSort }: EventTableProps) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <SortableTh sortKey="importance" sort={sort} onSort={onSort}> </SortableTh>
          <SortableTh sortKey="headline" sort={sort} onSort={onSort}>Event</SortableTh>
          <SortableTh sortKey="significance" sort={sort} onSort={onSort}>Sig</SortableTh>
          <SortableTh sortKey="participants" sort={sort} onSort={onSort} right>Ents</SortableTh>
          <SortableTh sortKey="era" sort={sort} onSort={onSort}>Era</SortableTh>
          <SortableTh sortKey="chronicles" sort={sort} onSort={onSort} right>&#9776;</SortableTh>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={6} text="No events match filters" />}
        {rows.map((r) => {
          const ev = r.event as Record<string, unknown>;
          return (
            <tr key={r.event.id}>
              <td className="ec-center"><CoverageIndicator covered={r.isCovered} /></td>
              <td className="ec-name" title={`${r.headline} (${r.event.id})`}>{r.headline}</td>
              <td><SignificanceStars value={ev.significance as number} /></td>
              <td className="ec-right" title={`${r.participantCount} participants`}>
                &#8853;{r.participantCount}
              </td>
              <td className="ec-muted" title={`Era: ${ev.era as string}`}>{ev.era as string}</td>
              <td className="ec-right" title={`In ${r.chronicleCount} chronicles`}>
                {r.chronicleCount}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

// ---------------------------------------------------------------------------
// Coverage rate class helper
// ---------------------------------------------------------------------------

function coverageRateClass(rate: number): string {
  if (rate === 0) return "ecp-color-red";
  if (rate < 0.5) return "ecp-color-amber";
  return "ecp-color-green";
}

// ---------------------------------------------------------------------------
// Frequency table sub-component
// ---------------------------------------------------------------------------

interface FreqTableProps {
  freqRows: FreqRow[];
  freqSort: SortState;
  onFreqSort: (col: string) => void;
  groupBy: string;
}

function FreqTable({ freqRows, freqSort, onFreqSort, groupBy }: FreqTableProps) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <SortableTh sortKey="key" sort={freqSort} onSort={onFreqSort}>
            {groupBy === "action" ? "Action" : "Event Kind"}
          </SortableTh>
          <SortableTh sortKey="count" sort={freqSort} onSort={onFreqSort} right>Count</SortableTh>
          <SortableTh sortKey="covered" sort={freqSort} onSort={onFreqSort} right>Covered</SortableTh>
          <SortableTh sortKey="coverageRate" sort={freqSort} onSort={onFreqSort} right>Cov%</SortableTh>
          <SortableTh sortKey="avgSig" sort={freqSort} onSort={onFreqSort} right>Avg Sig</SortableTh>
          <SortableTh sortKey="avgPart" sort={freqSort} onSort={onFreqSort} right>Avg Ents</SortableTh>
          <SortableTh sortKey="entities" sort={freqSort} onSort={onFreqSort} right>Ents</SortableTh>
          <SortableTh sortKey="eras" sort={freqSort} onSort={onFreqSort} right>Eras</SortableTh>
          {groupBy === "action" && <StaticTh>Kind</StaticTh>}
        </tr>
      </thead>
      <tbody>
        {freqRows.length === 0 && (
          <EmptyRow colSpan={groupBy === "action" ? 9 : 8} text="No events match filters" />
        )}
        {freqRows.map((r) => {
          const entityTooltip =
            r.entityList.length > 0
              ? r.entityList.map((e) => `${e.name} (${e.kind}) \u00D7${e.count}`).join("\n")
              : "No entities";
          return (
            <tr key={r.key}>
              <td className="ec-name" title={`${r.key}\n\nEntities involved:\n${entityTooltip}`}>
                {r.key}
              </td>
              <td className="ec-right">
                <span className={r.count <= 2 ? "ecp-rare-count" : undefined}>{r.count}</span>
              </td>
              <td className="ec-right">{r.coveredCount}</td>
              <td className="ec-right">
                <span className={coverageRateClass(r.coverageRate)}>
                  {(r.coverageRate * 100).toFixed(0)}%
                </span>
              </td>
              <td className="ec-right">{r.avgSignificance.toFixed(2)}</td>
              <td className="ec-right">{r.avgParticipants.toFixed(1)}</td>
              <td className="ec-right" title={entityTooltip}>{r.entityCount}</td>
              <td className="ec-right" title={`Appears in ${r.eraCount} eras`}>{r.eraCount}</td>
              {groupBy === "action" && <td className="ec-muted">{r.eventKindLabel}</td>}
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

// ---------------------------------------------------------------------------
// EventsSection
// ---------------------------------------------------------------------------

export function EventsSection({
  events,
  eventCoverage,
  expanded,
}: EventsSectionProps): React.ReactElement | number {
  const [sort, onSort] = useColumnSort("importance");
  const [freqSort, onFreqSort] = useColumnSort("count");
  const [coverageFilter, setCoverageFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [minSignificance, setMinSignificance] = useState("0.5");
  const [viewMode, setViewMode] = useState("events");
  const [groupBy, setGroupBy] = useState("action");

  const eraOptions = useMemo(() => getEraOptions(events), [events]);
  const eventKindOptions = useMemo(() => getEventKindOptions(events), [events]);

  const filteredEvents = useMemo(() => {
    const minSig = Number(minSignificance);
    let filtered = events.filter((e) => ((e as Record<string, unknown>).significance as number) >= minSig);
    if (eraFilter !== "all")
      filtered = filtered.filter((e) => (e as Record<string, unknown>).era === eraFilter);
    if (kindFilter !== "all")
      filtered = filtered.filter((e) => (e as Record<string, unknown>).eventKind === kindFilter);
    return filtered;
  }, [events, minSignificance, eraFilter, kindFilter]);

  const rows = useMemo(
    () => buildEventRows(filteredEvents, eventCoverage, sort, coverageFilter),
    [filteredEvents, eventCoverage, sort, coverageFilter],
  );

  const freqRows = useMemo(
    () => (viewMode === "frequency" ? buildFreqRows(filteredEvents, eventCoverage, groupBy, freqSort) : []),
    [filteredEvents, eventCoverage, viewMode, groupBy, freqSort],
  );

  const underutilCount = useMemo(() => {
    return filteredEvents.filter((event) => {
      const ev = event as Record<string, unknown>;
      const significance = ev.significance as number;
      const participantEffects = (ev.participantEffects ?? []) as unknown[];
      return (eventCoverage.get(event.id) ?? 0) <= 0 &&
        significance >= 0.7 &&
        participantEffects.length >= 3;
    }).length;
  }, [filteredEvents, eventCoverage]);

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={viewMode} onChange={setViewMode} options={VIEW_MODE_OPTIONS} label="View mode" />
        {viewMode === "frequency" && (
          <FilterSelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} label="Group by" />
        )}
        {viewMode === "events" && (
          <FilterSelect value={coverageFilter} onChange={setCoverageFilter} options={COVERAGE_STATUS_OPTIONS} label="Coverage" />
        )}
        <FilterSelect value={eraFilter} onChange={setEraFilter} options={eraOptions} label="Era" />
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={eventKindOptions} label="Event kind" />
        <FilterSelect value={minSignificance} onChange={setMinSignificance} options={SIGNIFICANCE_OPTIONS} label="Min significance" />
        <span className="ecp-auto-count">
          {viewMode === "events" ? `${rows.length} events` : `${freqRows.length} types`}
        </span>
      </SectionToolbar>

      {viewMode === "events" ? (
        <EventTable rows={rows} sort={sort} onSort={onSort} />
      ) : (
        <FreqTable freqRows={freqRows} freqSort={freqSort} onFreqSort={onFreqSort} groupBy={groupBy} />
      )}
    </div>
  );
}
