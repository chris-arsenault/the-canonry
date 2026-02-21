/**
 * EntityCoveragePanel - Entity-level coverage analysis across chronicles
 *
 * 8 collapsible sections surfacing deterministic coverage gaps:
 * 0. Chronicle Suggestions (entity + era combos that cover uncovered events)
 * 1. Chronicle Backrefs per Entity
 * 2. Description History per Entity
 * 3. Cultural Representation
 * 4. Rare Event Coverage
 * 5. Untapped Story Potential
 * 6. Era Coverage Gaps
 * 7. Lore Integration Gaps
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useRelationships } from '../lib/db/relationshipSelectors';
import { useNarrativeEvents } from '../lib/db/narrativeEventSelectors';
import { getEntitiesForRun } from '../lib/db/entityRepository';
import { getChroniclesForSimulation } from '../lib/db/chronicleRepository';
import { computeAllStoryPotentials, scoreToRating } from '../lib/chronicle/storyPotential';

// ============================================================================
// Constants
// ============================================================================

const PROMINENCE_LABELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

function prominenceLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'unknown';
  const n = Number(value);
  if (n < 1) return 'forgotten';
  if (n < 2) return 'marginal';
  if (n < 3) return 'recognized';
  if (n < 4) return 'renowned';
  return 'mythic';
}

/** Expected backref / history count per prominence tier */
function expectedForProminence(value) {
  const label = prominenceLabel(value);
  switch (label) {
    case 'forgotten': return 0;
    case 'marginal': return 0;
    case 'recognized': return 1;
    case 'renowned': return 2;
    case 'mythic': return 3;
    default: return 0;
  }
}

const SECTION_IDS = [
  'suggestions',
  'backrefs',
  'history',
  'culture',
  'events',
  'potential',
  'eras',
  'integration',
];

const SECTION_LABELS = {
  suggestions: 'Chronicle Suggestions',
  backrefs: 'Chronicle Backrefs per Entity',
  history: 'Description History per Entity',
  culture: 'Cultural Representation',
  events: 'Rare Event Coverage',
  potential: 'Untapped Story Potential',
  eras: 'Era Coverage Gaps',
  integration: 'Lore Integration Gaps',
};

const SECTION_DESCRIPTIONS = {
  suggestions: 'Uncovered events by action type — expand to see involved entities, era, and significance',
  backrefs: 'Backref links from entity descriptions to source chronicles, relative to prominence',
  history: 'Description rewrites from lore backport vs. backref mentions — divergence signals shallow integration',
  culture: 'Primary vs supporting role distribution by culture across chronicles',
  events: 'High-significance events not yet selected for any chronicle',
  potential: 'Story potential score vs actual chronicle usage — find underused narrative anchors',
  eras: 'Chronicle distribution across eras — find underexplored time periods',
  integration: 'Pipeline completeness — description, backrefs, history, historian notes, image',
};

// ============================================================================
// Shared UI helpers
// ============================================================================

function ProminenceDots({ value }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  const dots = [];
  for (let i = 0; i < 5; i++) {
    dots.push(
      <span
        key={i}
        style={{
          display: 'inline-block',
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: i < n ? 'var(--text-secondary)' : 'rgba(148,163,184,0.25)',
          marginRight: '2px',
        }}
      />
    );
  }
  return (
    <span title={`Prominence: ${prominenceLabel(value)} (${Number(value).toFixed(1)})`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {dots}
    </span>
  );
}

function RatioIndicator({ ratio, expected }) {
  if (expected === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '10px' }} title="No backrefs expected at this prominence">—</span>;
  }
  const color = ratio < 0.5 ? '#ef4444' : ratio < 1.0 ? '#f59e0b' : '#22c55e';
  return (
    <span style={{ color, fontSize: '10px', fontWeight: 600 }} title={`Ratio: ${ratio.toFixed(2)} (${expected} expected)`}>
      {ratio.toFixed(1)}x
    </span>
  );
}

function SignificanceStars({ value }) {
  const stars = Math.max(1, Math.min(5, Math.round(value * 5)));
  return (
    <span title={`Significance: ${(value * 100).toFixed(0)}%`} style={{ fontSize: '10px', color: '#f59e0b', letterSpacing: '-1px' }}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  );
}

function CoverageIndicator({ covered }) {
  return covered
    ? <span style={{ color: '#22c55e', fontSize: '11px' }} title="Covered in at least one chronicle">●</span>
    : <span style={{ color: '#ef4444', fontSize: '11px' }} title="Not in any chronicle">○</span>;
}

function StatusDot({ active, label }) {
  return (
    <span
      title={label}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: active ? '#22c55e' : 'rgba(148,163,184,0.3)',
        border: active ? 'none' : '1px solid rgba(148,163,184,0.4)',
      }}
    />
  );
}

function SectionToolbar({ children }) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '8px 16px',
      borderBottom: '1px solid var(--border-color)',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        padding: '3px 6px',
        fontSize: '11px',
      }}
      title={label}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function SectionHeader({ sectionId, expanded, onToggle, label, description, underutilCount }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        padding: '10px 16px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
        {expanded ? '\u25BC' : '\u25B6'}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-color)', flexShrink: 0 }}>{label}</span>
      {underutilCount > 0 && (
        <span style={{ fontSize: '10px', color: '#f59e0b', flexShrink: 0 }}>
          {underutilCount} underutilized
        </span>
      )}
      {!expanded && description && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {description}
        </span>
      )}
    </div>
  );
}

function TableWrap({ children }) {
  return (
    <div className="entity-coverage-table">
      <table>{children}</table>
    </div>
  );
}

// ============================================================================
// Table helpers
// ============================================================================

function useColumnSort(defaultCol, defaultDesc = false) {
  const [sort, setSort] = useState({ col: defaultCol, desc: defaultDesc });
  const onSort = useCallback((col) => {
    setSort((prev) => ({
      col,
      desc: prev.col === col ? !prev.desc : false,
    }));
  }, []);
  return [sort, onSort];
}

function SortableTh({ children, sortKey, sort, onSort, right }) {
  const isActive = sort.col === sortKey;
  const cls = [isActive && 'ec-active', right && 'ec-right'].filter(Boolean).join(' ') || undefined;
  return (
    <th className={cls} onClick={() => onSort(sortKey)}>
      {children}{isActive ? (sort.desc ? ' \u25BE' : ' \u25B4') : ''}
    </th>
  );
}

function StaticTh({ children, right }) {
  const cls = ['ec-no-sort', right && 'ec-right'].filter(Boolean).join(' ');
  return <th className={cls}>{children}</th>;
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr className="ec-empty">
      <td colSpan={colSpan}>{text}</td>
    </tr>
  );
}

// ============================================================================
// Unique option extractors
// ============================================================================

function getKindOptions(entities) {
  const kinds = new Set();
  for (const e of entities) {
    if (e.kind && e.kind !== 'era') kinds.add(e.kind);
  }
  return [{ value: 'all', label: 'All kinds' }, ...[...kinds].sort().map((k) => ({ value: k, label: k }))];
}

function getCultureOptions(entities) {
  const cultures = new Set();
  for (const e of entities) {
    if (e.culture) cultures.add(e.culture);
  }
  return [{ value: 'all', label: 'All cultures' }, ...[...cultures].sort().map((c) => ({ value: c, label: c }))];
}

function getEraOptions(events) {
  const eras = new Set();
  for (const e of events) {
    if (e.era) eras.add(e.era);
  }
  return [{ value: 'all', label: 'All eras' }, ...[...eras].sort().map((e) => ({ value: e, label: e }))];
}

function getEventKindOptions(events) {
  const kinds = new Set();
  for (const e of events) {
    if (e.eventKind) kinds.add(e.eventKind);
  }
  return [{ value: 'all', label: 'All event kinds' }, ...[...kinds].sort().map((k) => ({ value: k, label: k }))];
}

const PROMINENCE_OPTIONS = [
  { value: 'all', label: 'All prominence' },
  ...PROMINENCE_LABELS.map((l) => ({ value: l, label: l })),
];

// ============================================================================
// Core analysis computation
// ============================================================================

function computeCoreAnalysis(entities, chronicles, events, relationships) {
  const nonEraEntities = entities.filter((e) => e.kind !== 'era');
  const activeChronicles = chronicles.filter((c) => c.status !== 'generating');

  // Entity usage map: entityId -> { total, primary, supporting, chronicleIds }
  const entityUsage = new Map();
  for (const chronicle of activeChronicles) {
    const primaryIds = new Set(
      (chronicle.roleAssignments || []).filter((r) => r.isPrimary).map((r) => r.entityId)
    );
    for (const entityId of (chronicle.selectedEntityIds || [])) {
      const existing = entityUsage.get(entityId) || { total: 0, primary: 0, supporting: 0, chronicleIds: [] };
      existing.total += 1;
      existing.chronicleIds.push(chronicle.chronicleId);
      if (primaryIds.has(entityId)) existing.primary += 1;
      else existing.supporting += 1;
      entityUsage.set(entityId, existing);
    }
  }

  // Event coverage map: eventId -> chronicleCount
  const eventCoverage = new Map();
  for (const chronicle of activeChronicles) {
    for (const eventId of (chronicle.selectedEventIds || [])) {
      eventCoverage.set(eventId, (eventCoverage.get(eventId) || 0) + 1);
    }
  }

  // Era chronicle map: eraId -> { total, completed, backported }
  const eraChronicles = new Map();
  for (const chronicle of activeChronicles) {
    const eraId = chronicle.temporalContext?.focalEra?.id;
    if (!eraId) continue;
    const existing = eraChronicles.get(eraId) || { total: 0, completed: 0, backported: 0 };
    existing.total += 1;
    if (chronicle.status === 'complete') existing.completed += 1;
    if (chronicle.entityBackportStatus && Object.keys(chronicle.entityBackportStatus).length > 0) existing.backported += 1;
    eraChronicles.set(eraId, existing);
  }

  // Era entity counts: eraId -> count
  const eraEntityCounts = new Map();
  for (const entity of nonEraEntities) {
    if (entity.eraId) {
      eraEntityCounts.set(entity.eraId, (eraEntityCounts.get(entity.eraId) || 0) + 1);
    }
  }

  // Era event counts: eraId -> count
  const eraEventCounts = new Map();
  for (const event of events) {
    if (event.era) {
      eraEventCounts.set(event.era, (eraEventCounts.get(event.era) || 0) + 1);
    }
  }

  // Culture stats from role assignments
  const cultureRoles = new Map(); // culture -> { primary, supporting, entityIds set }
  for (const chronicle of activeChronicles) {
    for (const role of (chronicle.roleAssignments || [])) {
      const entity = nonEraEntities.find((e) => e.id === role.entityId);
      if (!entity?.culture) continue;
      const c = entity.culture;
      const existing = cultureRoles.get(c) || { primary: 0, supporting: 0, entityIds: new Set() };
      if (role.isPrimary) existing.primary += 1;
      else existing.supporting += 1;
      existing.entityIds.add(role.entityId);
      cultureRoles.set(c, existing);
    }
  }

  // Culture entity counts and avg prominence
  const cultureEntities = new Map(); // culture -> { count, totalProminence, entityIds set }
  for (const entity of nonEraEntities) {
    if (!entity.culture) continue;
    const existing = cultureEntities.get(entity.culture) || { count: 0, totalProminence: 0, entityIds: new Set() };
    existing.count += 1;
    existing.totalProminence += Number(entity.prominence) || 0;
    existing.entityIds.add(entity.id);
    cultureEntities.set(entity.culture, existing);
  }

  // Backported chronicle counts per entity (count chronicles where this entity has been backported)
  const entityBackportedCount = new Map();
  for (const chronicle of activeChronicles) {
    const statusMap = chronicle.entityBackportStatus;
    if (!statusMap) continue;
    for (const entityId of (chronicle.selectedEntityIds || [])) {
      if (statusMap[entityId]) {
        entityBackportedCount.set(entityId, (entityBackportedCount.get(entityId) || 0) + 1);
      }
    }
  }

  return {
    nonEraEntities,
    activeChronicles,
    entityUsage,
    eventCoverage,
    eraChronicles,
    eraEntityCounts,
    eraEventCounts,
    cultureRoles,
    cultureEntities,
    entityBackportedCount,
  };
}

// ============================================================================
// Section 0: Chronicle Suggestions
// ============================================================================

const SUGGESTION_MIN_SIG_OPTIONS = [
  { value: '0', label: 'All significance' },
  { value: '0.3', label: '>= 0.3' },
  { value: '0.5', label: '>= 0.5' },
  { value: '0.7', label: '>= 0.7' },
];

const SUGGESTION_COVERAGE_OPTIONS = [
  { value: 'uncovered', label: 'Has uncovered' },
  { value: 'all', label: 'All actions' },
];

/** Strip entity-specific suffix from action: "kill_orca:The Sapphire League" -> "kill_orca" */
function baseAction(raw) {
  if (!raw) return 'unknown';
  const idx = raw.indexOf(':');
  return idx > 0 ? raw.slice(0, idx) : raw;
}

/** Check if an event is purely a prominence side-effect (only field_changed on prominence) */
function isProminenceOnly(event) {
  const effects = event.participantEffects;
  if (!effects || effects.length === 0) return false;
  for (const pe of effects) {
    for (const eff of pe.effects || []) {
      if (eff.type !== 'field_changed' || eff.field !== 'prominence') return false;
    }
  }
  return true;
}

/**
 * Compute group key for an event:
 * - creation_batch → template name from causedBy.actionType
 * - prominence-only side-effects → "prominence_change" (prevents inflating parent action)
 * - everything else → base action
 */
function eventGroupKey(event) {
  if (event.eventKind === 'creation_batch' && event.causedBy?.actionType) {
    return event.causedBy.actionType;
  }
  if (isProminenceOnly(event)) {
    return 'prominence_change';
  }
  return baseAction(event.action || event.eventKind) || 'unknown';
}

/**
 * Event-action-centric coverage suggestions. Groups events by action type,
 * shows covered/uncovered counts, and expands to show each uncovered event
 * instance with its full participant list, era, and significance.
 *
 * Workflow: find an action with uncovered events -> expand -> see which
 * entities are involved in each uncovered instance -> pick one as entry point
 * in the wizard.
 */
function SuggestionsSection({ events, entities, eventCoverage, entityUsage, expanded }) {
  const [minSignificance, setMinSignificance] = useState('0');
  const [coverageFilter, setCoverageFilter] = useState('uncovered');
  const [expandedAction, setExpandedAction] = useState(null);
  const [sort, onSort] = useColumnSort('uncovered', true);

  // Build entity lookup for names/kinds/prominence
  const entityMap = useMemo(() => {
    const m = new Map();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  // Era name lookup
  const eraNameMap = useMemo(() => {
    const m = new Map();
    for (const e of entities) {
      if (e.kind === 'era') m.set(e.id, e.name);
    }
    return m;
  }, [entities]);

  const actionGroups = useMemo(() => {
    const minSig = Number(minSignificance);

    // Group key logic:
    // - creation_batch: split by template (causedBy.actionType) so "spawn_settlement"
    //   and "spawn_faction" appear as separate rows instead of one blob
    // - prominence-only side-effects: grouped as "prominence_change" regardless of
    //   which system caused them, so they don't inflate the parent action's count
    // - everything else: group by base action (kill_orca, artifact_attracts, etc.)
    const groups = new Map();
    for (const event of events) {
      if (event.significance < minSig) continue;
      const key = eventGroupKey(event);
      const existing = groups.get(key) || {
        action: key,
        total: 0,
        covered: 0,
        uncovered: 0,
        totalSignificance: 0,
        uncoveredEvents: [],
        coveredEvents: [],
        eras: new Set(),
      };
      existing.total += 1;
      existing.totalSignificance += event.significance;
      const isCovered = (eventCoverage.get(event.id) || 0) > 0;
      if (isCovered) {
        existing.covered += 1;
        existing.coveredEvents.push(event);
      } else {
        existing.uncovered += 1;
        existing.uncoveredEvents.push(event);
      }
      if (event.era) existing.eras.add(event.era);
      groups.set(key, existing);
    }

    let result = [...groups.values()].map((g) => ({
      ...g,
      avgSignificance: g.total > 0 ? g.totalSignificance / g.total : 0,
      coverageRate: g.total > 0 ? g.covered / g.total : 0,
      eraCount: g.eras.size,
    }));

    if (coverageFilter === 'uncovered') result = result.filter((g) => g.uncovered > 0);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'action': cmp = a.action.localeCompare(b.action); break;
        case 'total': cmp = a.total - b.total; break;
        case 'covered': cmp = a.covered - b.covered; break;
        case 'uncovered': cmp = a.uncovered - b.uncovered; break;
        case 'coverageRate': cmp = a.coverageRate - b.coverageRate; break;
        case 'avgSig': cmp = a.avgSignificance - b.avgSignificance; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return result;
  }, [events, eventCoverage, minSignificance, coverageFilter, sort]);

  const totalUncoveredActions = useMemo(() => actionGroups.filter((g) => g.uncovered > 0).length, [actionGroups]);

  if (!expanded) return totalUncoveredActions;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={coverageFilter} onChange={setCoverageFilter} options={SUGGESTION_COVERAGE_OPTIONS} label="Coverage" />
        <FilterSelect value={minSignificance} onChange={setMinSignificance} options={SUGGESTION_MIN_SIG_OPTIONS} label="Min significance" />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
          {actionGroups.length} action types
        </span>
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
          {actionGroups.length === 0 && <EmptyRow colSpan={7} text="No event kinds match filters" />}
          {actionGroups.map((g) => {
            const isDetailExpanded = expandedAction === g.action;
            return (
              <React.Fragment key={g.action}>
                <tr
                  style={{ cursor: g.uncovered > 0 ? 'pointer' : 'default' }}
                  onClick={() => g.uncovered > 0 && setExpandedAction(isDetailExpanded ? null : g.action)}
                  title={g.uncovered > 0 ? 'Click to see uncovered events and their entities' : 'All events covered'}
                >
                  <td style={{ width: '16px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {g.uncovered > 0 ? (isDetailExpanded ? '\u25BC' : '\u25B6') : ''}
                  </td>
                  <td className="ec-name">{g.action}</td>
                  <td className="ec-right">{g.total}</td>
                  <td className="ec-right" style={{ color: '#22c55e' }}>{g.covered}</td>
                  <td className="ec-right">
                    {g.uncovered > 0 ? (
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>{g.uncovered}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>0</span>
                    )}
                  </td>
                  <td className="ec-right">
                    <span style={{ color: g.coverageRate === 1 ? '#22c55e' : g.coverageRate >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                      {(g.coverageRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="ec-right"><SignificanceStars value={g.avgSignificance} /></td>
                </tr>
                {isDetailExpanded && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
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

/**
 * Expansion detail for one action group. Shows each uncovered event instance
 * with its full participant list, era, and significance. Entities shown inline
 * with kind, prominence, and existing chronicle count.
 */
function SuggestionActionDetail({ group, entityMap, eraNameMap, entityUsage }) {
  const uncoveredEvents = useMemo(
    () => [...group.uncoveredEvents].sort((a, b) => b.significance - a.significance),
    [group.uncoveredEvents]
  );

  /** Resolve an entity ref to display info */
  function resolveEntity(id) {
    const ent = entityMap.get(id);
    return {
      id,
      name: ent?.name || id,
      kind: ent?.kind || '?',
      culture: ent?.culture || '',
      prominence: Number(ent?.prominence) || 0,
      chronicleAppearances: entityUsage.get(id)?.total || 0,
    };
  }

  return (
    <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
      <div style={{ padding: '8px 16px 8px 32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          {group.uncovered} uncovered event{group.uncovered !== 1 ? 's' : ''}
          {group.covered > 0 && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({group.covered} already covered)</span>
          )}
        </div>
        {uncoveredEvents.map((event) => {
          const headline = event.description || `${event.subject?.name || 'Unknown'}: ${event.action || event.eventKind}`;
          const eraName = eraNameMap.get(event.era) || event.era || '?';

          // Collect all involved entities (subject + participants), deduplicated
          const seen = new Set();
          const involved = [];
          if (event.subject?.id) {
            seen.add(event.subject.id);
            involved.push({ ...resolveEntity(event.subject.id), role: 'subject' });
          }
          for (const p of event.participantEffects || []) {
            if (p.entity?.id && !seen.has(p.entity.id)) {
              seen.add(p.entity.id);
              involved.push({ ...resolveEntity(p.entity.id), role: 'participant' });
            }
          }

          return (
            <div
              key={event.id}
              style={{
                marginBottom: '8px',
                padding: '6px 8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                background: 'var(--bg-primary)',
              }}
            >
              {/* Event headline row */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-color)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={headline}>
                  {headline}
                </span>
                <SignificanceStars value={event.significance} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }} title={`Era: ${eraName}`}>
                  {eraName}
                </span>
              </div>
              {/* Entity list */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                {involved.map((ent) => (
                  <span
                    key={ent.id}
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    title={[
                      `${ent.name} (${ent.kind})`,
                      ent.culture ? `Culture: ${ent.culture}` : null,
                      `Prominence: ${prominenceLabel(ent.prominence)}`,
                      `${ent.chronicleAppearances} chronicle appearance${ent.chronicleAppearances !== 1 ? 's' : ''}`,
                      ent.role === 'subject' ? 'Subject of event' : 'Participant',
                    ].filter(Boolean).join('\n')}
                  >
                    {ent.role === 'subject' ? (
                      <span style={{ color: '#60a5fa', fontSize: '9px' }}>◆</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>○</span>
                    )}
                    <span style={{ color: 'var(--text-color)' }}>{ent.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{ent.kind}</span>
                    <ProminenceDots value={ent.prominence} />
                    {ent.chronicleAppearances === 0 ? (
                      <span style={{ color: '#a855f7', fontSize: '9px' }}>new</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>☰{ent.chronicleAppearances}</span>
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

// ============================================================================
// Section 1: Chronicle Backrefs per Entity
// ============================================================================

function BackrefsSection({ entities, expanded }) {
  const [sort, onSort] = useColumnSort('ratio');
  const [kindFilter, setKindFilter] = useState('all');
  const [cultureFilter, setCultureFilter] = useState('all');
  const [prominenceFilter, setProminenceFilter] = useState('all');
  const [descOnly, setDescOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo(() => {
    let filtered = entities.filter((e) => e.kind !== 'era');
    if (kindFilter !== 'all') filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== 'all') filtered = filtered.filter((e) => e.culture === cultureFilter);
    if (prominenceFilter !== 'all') filtered = filtered.filter((e) => prominenceLabel(e.prominence) === prominenceFilter);
    if (descOnly) filtered = filtered.filter((e) => e.description);

    const computed = filtered.map((e) => {
      const backrefCount = e.enrichment?.chronicleBackrefs?.length ?? 0;
      const expected = expectedForProminence(e.prominence);
      const ratio = expected > 0 ? backrefCount / expected : (backrefCount > 0 ? Infinity : 0);
      return { entity: e, backrefCount, expected, ratio };
    });

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'name': cmp = a.entity.name.localeCompare(b.entity.name); break;
        case 'kind': cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case 'prominence': cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0); break;
        case 'backrefs': cmp = a.backrefCount - b.backrefCount; break;
        case 'ratio': cmp = a.ratio - b.ratio; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return computed;
  }, [entities, sort, kindFilter, cultureFilter, prominenceFilter, descOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.expected > 0 && r.ratio < 1).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={prominenceFilter} onChange={setProminenceFilter} options={PROMINENCE_OPTIONS} label="Prominence" />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={descOnly} onChange={(e) => setDescOnly(e.target.checked)} />
          Has description
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} entities</span>
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
              <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>{r.entity.name}</td>
              <td className="ec-muted">{r.entity.kind}</td>
              <td><ProminenceDots value={r.entity.prominence} /></td>
              <td className="ec-right" title={`${r.backrefCount} backrefs`}>⇄ {r.backrefCount}</td>
              <td className="ec-right"><RatioIndicator ratio={r.ratio} expected={r.expected} /></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ============================================================================
// Section 2: Description History per Entity
// ============================================================================

function HistorySection({ entities, expanded }) {
  const [sort, onSort] = useColumnSort('divergence', true);
  const [kindFilter, setKindFilter] = useState('all');
  const [cultureFilter, setCultureFilter] = useState('all');
  const [prominenceFilter, setProminenceFilter] = useState('all');
  const [divergentOnly, setDivergentOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo(() => {
    let filtered = entities.filter((e) => e.kind !== 'era');
    if (kindFilter !== 'all') filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== 'all') filtered = filtered.filter((e) => e.culture === cultureFilter);
    if (prominenceFilter !== 'all') filtered = filtered.filter((e) => prominenceLabel(e.prominence) === prominenceFilter);

    const computed = filtered.map((e) => {
      const historyCount = e.enrichment?.descriptionHistory?.length ?? 0;
      const backrefCount = e.enrichment?.chronicleBackrefs?.length ?? 0;
      const divergence = backrefCount - historyCount;
      const expected = expectedForProminence(e.prominence);
      const historyRatio = expected > 0 ? historyCount / expected : (historyCount > 0 ? Infinity : 0);
      const latestSource = e.enrichment?.descriptionHistory?.length
        ? e.enrichment.descriptionHistory[e.enrichment.descriptionHistory.length - 1].source
        : null;
      return { entity: e, historyCount, backrefCount, divergence, expected, historyRatio, latestSource };
    });

    if (divergentOnly) {
      return computed.filter((r) => r.backrefCount > 0 && r.historyCount === 0);
    }

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'name': cmp = a.entity.name.localeCompare(b.entity.name); break;
        case 'kind': cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case 'prominence': cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0); break;
        case 'history': cmp = a.historyCount - b.historyCount; break;
        case 'backrefs': cmp = a.backrefCount - b.backrefCount; break;
        case 'divergence': cmp = a.divergence - b.divergence; break;
        case 'source': cmp = (a.latestSource || '').localeCompare(b.latestSource || ''); break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return computed;
  }, [entities, sort, kindFilter, cultureFilter, prominenceFilter, divergentOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.backrefCount > 0 && r.historyCount === 0).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={prominenceFilter} onChange={setProminenceFilter} options={PROMINENCE_OPTIONS} label="Prominence" />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={divergentOnly} onChange={(e) => setDivergentOnly(e.target.checked)} />
          Backrefs but no history
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} entities</span>
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
              <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>{r.entity.name}</td>
              <td className="ec-muted">{r.entity.kind}</td>
              <td><ProminenceDots value={r.entity.prominence} /></td>
              <td className="ec-right" title={`${r.historyCount} description revisions`}>✎ {r.historyCount}</td>
              <td className="ec-right" title={`${r.backrefCount} backrefs`}>⇄ {r.backrefCount}</td>
              <td className="ec-right">
                {r.divergence > 0 ? (
                  <span style={{ color: '#f59e0b', fontWeight: 600 }} title={`${r.divergence} more backrefs than history revisions`}>
                    +{r.divergence}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              <td className="ec-muted" title={r.latestSource ? `Latest source: ${r.latestSource}` : 'No revisions'}>
                {r.latestSource || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ============================================================================
// Section 3: Cultural Representation
// ============================================================================

function CultureSection({ entities, cultureRoles, cultureEntities, entityUsage, expanded }) {
  const [sort, onSort] = useColumnSort('primaryRatio');
  const [kindFilter, setKindFilter] = useState('all');

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);

  const rows = useMemo(() => {
    // Collect all cultures
    const allCultures = new Set([...cultureRoles.keys(), ...cultureEntities.keys()]);

    return [...allCultures].map((culture) => {
      const roles = cultureRoles.get(culture) || { primary: 0, supporting: 0, entityIds: new Set() };
      const entData = cultureEntities.get(culture) || { count: 0, totalProminence: 0, entityIds: new Set() };

      // If filtering by kind, recount
      let entityCount = entData.count;
      let totalProminence = entData.totalProminence;
      let appearedCount = 0;

      const cultureEnts = entities.filter((e) => e.culture === culture && e.kind !== 'era' && (kindFilter === 'all' || e.kind === kindFilter));
      if (kindFilter !== 'all') {
        entityCount = cultureEnts.length;
        totalProminence = cultureEnts.reduce((sum, e) => sum + (Number(e.prominence) || 0), 0);
      }

      for (const e of cultureEnts) {
        if (entityUsage.has(e.id)) appearedCount += 1;
      }

      const totalRoles = roles.primary + roles.supporting;
      const primaryRatio = totalRoles > 0 ? roles.primary / totalRoles : 0;
      const appearanceRate = entityCount > 0 ? appearedCount / entityCount : 0;
      const avgProminence = entityCount > 0 ? totalProminence / entityCount : 0;

      return {
        culture,
        entityCount,
        primaryCount: roles.primary,
        supportingCount: roles.supporting,
        totalRoles,
        primaryRatio,
        appearedCount,
        appearanceRate,
        avgProminence,
      };
    }).filter((r) => r.entityCount > 0)
      .sort((a, b) => {
        let cmp = 0;
        switch (sort.col) {
          case 'culture': cmp = a.culture.localeCompare(b.culture); break;
          case 'entityCount': cmp = a.entityCount - b.entityCount; break;
          case 'roles': cmp = a.totalRoles - b.totalRoles; break;
          case 'primaryRatio': cmp = a.primaryRatio - b.primaryRatio; break;
          case 'appearanceRate': cmp = a.appearanceRate - b.appearanceRate; break;
          case 'prominence': cmp = a.avgProminence - b.avgProminence; break;
        }
        return sort.desc ? -cmp : cmp;
      });
  }, [entities, cultureRoles, cultureEntities, entityUsage, sort, kindFilter]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.entityCount >= 3 && r.appearanceRate < 0.3).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} cultures</span>
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
              <td className="ec-right" title={`${r.entityCount} entities`}>☰ {r.entityCount}</td>
              <td>
                <span style={{ color: '#60a5fa' }} title={`${r.primaryCount} primary roles`}>◆{r.primaryCount}</span>
                {' '}
                <span style={{ color: 'var(--text-muted)' }} title={`${r.supportingCount} supporting roles`}>○{r.supportingCount}</span>
              </td>
              <td className="ec-right">
                {r.totalRoles > 0 ? (
                  <span
                    style={{ fontWeight: 600, color: r.primaryRatio < 0.2 ? '#ef4444' : r.primaryRatio < 0.4 ? '#f59e0b' : '#22c55e' }}
                    title={`Primary ratio: ${(r.primaryRatio * 100).toFixed(0)}%`}
                  >
                    {(r.primaryRatio * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              <td className="ec-right">
                <span
                  style={{ color: r.appearanceRate < 0.3 ? '#ef4444' : r.appearanceRate < 0.6 ? '#f59e0b' : '#22c55e' }}
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

// ============================================================================
// Section 4: Rare Event Coverage
// ============================================================================

const SIGNIFICANCE_OPTIONS = [
  { value: '0', label: 'All significance' },
  { value: '0.5', label: '>= 0.5' },
  { value: '0.6', label: '>= 0.6' },
  { value: '0.7', label: '>= 0.7' },
  { value: '0.8', label: '>= 0.8' },
  { value: '0.9', label: '>= 0.9' },
];

const COVERAGE_STATUS_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'uncovered', label: 'Uncovered only' },
  { value: 'covered', label: 'Covered only' },
];

const VIEW_MODE_OPTIONS = [
  { value: 'events', label: 'Per-event' },
  { value: 'frequency', label: 'Kind frequency' },
];

const GROUP_BY_OPTIONS = [
  { value: 'action', label: 'By action' },
  { value: 'eventKind', label: 'By event kind' },
];

function EventsSection({ events, eventCoverage, expanded }) {
  const [sort, onSort] = useColumnSort('importance');
  const [freqSort, onFreqSort] = useColumnSort('count');
  const [coverageFilter, setCoverageFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [minSignificance, setMinSignificance] = useState('0.5');
  const [viewMode, setViewMode] = useState('events');
  const [groupBy, setGroupBy] = useState('action');

  const eraOptions = useMemo(() => getEraOptions(events), [events]);
  const eventKindOptions = useMemo(() => getEventKindOptions(events), [events]);

  // Shared filtered event set for both views
  const filteredEvents = useMemo(() => {
    const minSig = Number(minSignificance);
    let filtered = events.filter((e) => e.significance >= minSig);
    if (eraFilter !== 'all') filtered = filtered.filter((e) => e.era === eraFilter);
    if (kindFilter !== 'all') filtered = filtered.filter((e) => e.eventKind === kindFilter);
    return filtered;
  }, [events, minSignificance, eraFilter, kindFilter]);

  // Per-event rows (existing view)
  const rows = useMemo(() => {
    const computed = filteredEvents.map((event) => {
      const participantCount = event.participantEffects?.length ?? 0;
      const chronicleCount = eventCoverage.get(event.id) || 0;
      const isCovered = chronicleCount > 0;
      const compositeImportance = event.significance * (1 + Math.log2(Math.max(participantCount, 1)));
      const headline = event.description || `${event.subject?.name || 'Unknown'}: ${event.action || event.eventKind}`;
      return { event, participantCount, chronicleCount, isCovered, compositeImportance, headline };
    });

    if (coverageFilter === 'uncovered') return computed.filter((r) => !r.isCovered);
    if (coverageFilter === 'covered') return computed.filter((r) => r.isCovered);

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'importance': {
          if (a.isCovered !== b.isCovered) return a.isCovered ? 1 : -1;
          cmp = a.compositeImportance - b.compositeImportance;
          break;
        }
        case 'headline': cmp = a.headline.localeCompare(b.headline); break;
        case 'significance': cmp = a.event.significance - b.event.significance; break;
        case 'participants': cmp = a.participantCount - b.participantCount; break;
        case 'era': cmp = (a.event.era || '').localeCompare(b.event.era || ''); break;
        case 'chronicles': cmp = a.chronicleCount - b.chronicleCount; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return computed;
  }, [filteredEvents, eventCoverage, sort, coverageFilter]);

  // Frequency rows (new aggregated view)
  const freqRows = useMemo(() => {
    if (viewMode !== 'frequency') return [];
    const groups = new Map();
    for (const event of filteredEvents) {
      const rawAction = event.action || event.eventKind || 'unknown';
      // Strip entity-specific suffix: "artifact_attracts_restorer:The Crystalline Lineage" -> "artifact_attracts_restorer"
      const baseAction = rawAction.indexOf(':') > 0 ? rawAction.slice(0, rawAction.indexOf(':')) : rawAction;
      const key = groupBy === 'action' ? baseAction : (event.eventKind || 'unknown');
      const existing = groups.get(key) || {
        key,
        count: 0,
        coveredCount: 0,
        totalSignificance: 0,
        totalParticipants: 0,
        eventKinds: new Set(),
        eras: new Set(),
        entities: new Map(), // entityId -> { name, kind, count }
      };
      existing.count += 1;
      if (eventCoverage.get(event.id) > 0) existing.coveredCount += 1;
      existing.totalSignificance += event.significance;
      existing.totalParticipants += event.participantEffects?.length ?? 0;
      if (groupBy === 'action') existing.eventKinds.add(event.eventKind);
      if (event.era) existing.eras.add(event.era);
      // Track involved entities
      if (event.subject?.id) {
        const ent = existing.entities.get(event.subject.id) || { name: event.subject.name || event.subject.id, kind: event.subject.kind, count: 0 };
        ent.count += 1;
        existing.entities.set(event.subject.id, ent);
      }
      for (const p of event.participantEffects || []) {
        if (p.entity?.id && p.entity.id !== event.subject?.id) {
          const ent = existing.entities.get(p.entity.id) || { name: p.entity.name || p.entity.id, kind: p.entity.kind, count: 0 };
          ent.count += 1;
          existing.entities.set(p.entity.id, ent);
        }
      }
      groups.set(key, existing);
    }

    const computed = [...groups.values()].map((g) => {
      // Sort entities by appearance count desc, then name
      const entityList = [...g.entities.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return {
        ...g,
        avgSignificance: g.count > 0 ? g.totalSignificance / g.count : 0,
        avgParticipants: g.count > 0 ? g.totalParticipants / g.count : 0,
        coverageRate: g.count > 0 ? g.coveredCount / g.count : 0,
        eraCount: g.eras.size,
        entityCount: g.entities.size,
        entityList,
        eventKindLabel: [...g.eventKinds].join(', '),
      };
    });

    computed.sort((a, b) => {
      let cmp = 0;
      switch (freqSort.col) {
        case 'key': cmp = a.key.localeCompare(b.key); break;
        case 'count': cmp = a.count - b.count; break;
        case 'covered': cmp = a.coveredCount - b.coveredCount; break;
        case 'coverageRate': cmp = a.coverageRate - b.coverageRate; break;
        case 'avgSig': cmp = a.avgSignificance - b.avgSignificance; break;
        case 'avgPart': cmp = a.avgParticipants - b.avgParticipants; break;
        case 'eras': cmp = a.eraCount - b.eraCount; break;
        case 'entities': cmp = a.entityCount - b.entityCount; break;
      }
      return freqSort.desc ? -cmp : cmp;
    });

    return computed;
  }, [filteredEvents, eventCoverage, viewMode, groupBy, freqSort]);

  const underutilCount = useMemo(
    () => {
      const eventRows = filteredEvents.map((event) => ({
        isCovered: (eventCoverage.get(event.id) || 0) > 0,
        significance: event.significance,
        participantCount: event.participantEffects?.length ?? 0,
      }));
      return eventRows.filter((r) => !r.isCovered && r.significance >= 0.7 && r.participantCount >= 3).length;
    },
    [filteredEvents, eventCoverage]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={viewMode} onChange={setViewMode} options={VIEW_MODE_OPTIONS} label="View mode" />
        {viewMode === 'frequency' && (
          <FilterSelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} label="Group by" />
        )}
        {viewMode === 'events' && (
          <FilterSelect value={coverageFilter} onChange={setCoverageFilter} options={COVERAGE_STATUS_OPTIONS} label="Coverage" />
        )}
        <FilterSelect value={eraFilter} onChange={setEraFilter} options={eraOptions} label="Era" />
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={eventKindOptions} label="Event kind" />
        <FilterSelect value={minSignificance} onChange={setMinSignificance} options={SIGNIFICANCE_OPTIONS} label="Min significance" />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
          {viewMode === 'events' ? `${rows.length} events` : `${freqRows.length} types`}
        </span>
      </SectionToolbar>

      {viewMode === 'events' ? (
        <TableWrap>
          <thead>
            <tr>
              <SortableTh sortKey="importance" sort={sort} onSort={onSort}> </SortableTh>
              <SortableTh sortKey="headline" sort={sort} onSort={onSort}>Event</SortableTh>
              <SortableTh sortKey="significance" sort={sort} onSort={onSort}>Sig</SortableTh>
              <SortableTh sortKey="participants" sort={sort} onSort={onSort} right>Ents</SortableTh>
              <SortableTh sortKey="era" sort={sort} onSort={onSort}>Era</SortableTh>
              <SortableTh sortKey="chronicles" sort={sort} onSort={onSort} right>☰</SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={6} text="No events match filters" />}
            {rows.map((r) => (
              <tr key={r.event.id}>
                <td className="ec-center"><CoverageIndicator covered={r.isCovered} /></td>
                <td className="ec-name" title={`${r.headline} (${r.event.id})`}>{r.headline}</td>
                <td><SignificanceStars value={r.event.significance} /></td>
                <td className="ec-right" title={`${r.participantCount} participants`}>⊕{r.participantCount}</td>
                <td className="ec-muted" title={`Era: ${r.event.era}`}>{r.event.era}</td>
                <td className="ec-right" title={`In ${r.chronicleCount} chronicles`}>{r.chronicleCount}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <SortableTh sortKey="key" sort={freqSort} onSort={onFreqSort}>
                {groupBy === 'action' ? 'Action' : 'Event Kind'}
              </SortableTh>
              <SortableTh sortKey="count" sort={freqSort} onSort={onFreqSort} right>Count</SortableTh>
              <SortableTh sortKey="covered" sort={freqSort} onSort={onFreqSort} right>Covered</SortableTh>
              <SortableTh sortKey="coverageRate" sort={freqSort} onSort={onFreqSort} right>Cov%</SortableTh>
              <SortableTh sortKey="avgSig" sort={freqSort} onSort={onFreqSort} right>Avg Sig</SortableTh>
              <SortableTh sortKey="avgPart" sort={freqSort} onSort={onFreqSort} right>Avg Ents</SortableTh>
              <SortableTh sortKey="entities" sort={freqSort} onSort={onFreqSort} right>Ents</SortableTh>
              <SortableTh sortKey="eras" sort={freqSort} onSort={onFreqSort} right>Eras</SortableTh>
              {groupBy === 'action' && <StaticTh>Kind</StaticTh>}
            </tr>
          </thead>
          <tbody>
            {freqRows.length === 0 && <EmptyRow colSpan={groupBy === 'action' ? 9 : 8} text="No events match filters" />}
            {freqRows.map((r) => {
              const entityTooltip = r.entityList.length > 0
                ? r.entityList.map((e) => `${e.name} (${e.kind}) ×${e.count}`).join('\n')
                : 'No entities';
              return (
                <tr key={r.key}>
                  <td className="ec-name" title={`${r.key}\n\nEntities involved:\n${entityTooltip}`}>{r.key}</td>
                  <td className="ec-right">
                    <span style={{ fontWeight: r.count <= 2 ? 600 : 400, color: r.count <= 2 ? '#f59e0b' : undefined }}>
                      {r.count}
                    </span>
                  </td>
                  <td className="ec-right">{r.coveredCount}</td>
                  <td className="ec-right">
                    <span style={{ color: r.coverageRate === 0 ? '#ef4444' : r.coverageRate < 0.5 ? '#f59e0b' : '#22c55e' }}>
                      {(r.coverageRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="ec-right">{r.avgSignificance.toFixed(2)}</td>
                  <td className="ec-right">{r.avgParticipants.toFixed(1)}</td>
                  <td className="ec-right" title={entityTooltip}>{r.entityCount}</td>
                  <td className="ec-right" title={`Appears in ${r.eraCount} eras`}>{r.eraCount}</td>
                  {groupBy === 'action' && <td className="ec-muted">{r.eventKindLabel}</td>}
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}

// ============================================================================
// Section 5: Untapped Story Potential
// ============================================================================

const MIN_POTENTIAL_OPTIONS = [
  { value: '0', label: 'All potential' },
  { value: '0.3', label: '>= 0.3' },
  { value: '0.5', label: '>= 0.5' },
  { value: '0.7', label: '>= 0.7' },
];

function PotentialSection({ entities, narrativeEvents, relationships, entityUsage, expanded }) {
  const [sort, onSort] = useColumnSort('gap', true);
  const [kindFilter, setKindFilter] = useState('all');
  const [cultureFilter, setCultureFilter] = useState('all');
  const [minPotential, setMinPotential] = useState('0');
  const [zeroOnly, setZeroOnly] = useState(false);

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  // Convert PersistedEntity to EntityContext shape for storyPotential
  const entityContexts = useMemo(() => {
    return entities
      .filter((e) => e.kind !== 'era')
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        subtype: e.subtype,
        prominence: e.prominence, // numeric, works with normalizeProminence
        culture: e.culture,
        status: e.status,
        tags: e.tags || {},
        eraId: e.eraId,
        summary: e.summary,
        description: e.description,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
  }, [entities]);

  const eventContexts = useMemo(() => {
    return narrativeEvents.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      headline: e.description || e.action || '',
      description: e.description,
      subjectId: e.subject?.id,
      subjectName: e.subject?.name,
      participants: e.participantEffects?.map((p) => ({
        id: p.entity?.id,
        name: p.entity?.name,
        kind: p.entity?.kind,
      })),
    }));
  }, [narrativeEvents]);

  const relationshipContexts = useMemo(() => {
    return relationships.map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      strength: r.strength,
      sourceName: '',
      sourceKind: '',
      targetName: '',
      targetKind: '',
    }));
  }, [relationships]);

  const potentialMap = useMemo(() => {
    if (!expanded) return new Map();
    return computeAllStoryPotentials(entityContexts, relationshipContexts, eventContexts);
  }, [expanded, entityContexts, relationshipContexts, eventContexts]);

  // Normalize usage for gap computation
  const maxUsage = useMemo(() => {
    let max = 0;
    for (const [, usage] of entityUsage) {
      if (usage.total > max) max = usage.total;
    }
    return max;
  }, [entityUsage]);

  const rows = useMemo(() => {
    if (!expanded) return [];
    const minPot = Number(minPotential);

    let filtered = entities.filter((e) => e.kind !== 'era');
    if (kindFilter !== 'all') filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== 'all') filtered = filtered.filter((e) => e.culture === cultureFilter);

    const computed = filtered.map((e) => {
      const pot = potentialMap.get(e.id);
      const score = pot?.potential?.overallScore ?? 0;
      const usage = entityUsage.get(e.id) || { total: 0, primary: 0, supporting: 0 };
      const normalizedUsage = maxUsage > 0 ? usage.total / maxUsage : 0;
      const gap = score - normalizedUsage;
      return { entity: e, score, usage, gap, neverPrimary: usage.total > 0 && usage.primary === 0 };
    }).filter((r) => r.score >= minPot);

    if (zeroOnly) return computed.filter((r) => r.usage.total === 0);

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'name': cmp = a.entity.name.localeCompare(b.entity.name); break;
        case 'kind': cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case 'potential': cmp = a.score - b.score; break;
        case 'appearances': cmp = a.usage.total - b.usage.total; break;
        case 'gap': cmp = a.gap - b.gap; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return computed;
  }, [expanded, entities, potentialMap, entityUsage, maxUsage, sort, kindFilter, cultureFilter, minPotential, zeroOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.score >= 0.5 && r.usage.total === 0).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={minPotential} onChange={setMinPotential} options={MIN_POTENTIAL_OPTIONS} label="Min potential" />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={zeroOnly} onChange={(e) => setZeroOnly(e.target.checked)} />
          Zero appearances
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} entities</span>
      </SectionToolbar>
      <TableWrap>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={sort} onSort={onSort}>Entity</SortableTh>
            <SortableTh sortKey="kind" sort={sort} onSort={onSort}>Kind</SortableTh>
            <SortableTh sortKey="potential" sort={sort} onSort={onSort}>Potential</SortableTh>
            <SortableTh sortKey="appearances" sort={sort} onSort={onSort} right>☰</SortableTh>
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
                <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>{r.entity.name}</td>
                <td className="ec-muted">{r.entity.kind}</td>
                <td>
                  <span style={{ color: '#f59e0b', letterSpacing: '-1px' }} title={`Story potential: ${(r.score * 100).toFixed(0)}%`}>
                    {'●'.repeat(rating)}{'○'.repeat(5 - rating)}
                  </span>
                </td>
                <td className="ec-right" title={`${r.usage.total} chronicle appearances`}>{r.usage.total}</td>
                <td>
                  <span style={{ color: '#60a5fa' }} title={`${r.usage.primary} as primary`}>◆{r.usage.primary}</span>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }} title={`${r.usage.supporting} as supporting`}>○{r.usage.supporting}</span>
                  {r.neverPrimary && (
                    <span style={{ fontSize: '9px', color: '#a855f7', marginLeft: '4px' }} title="Never primary">!</span>
                  )}
                </td>
                <td className="ec-right">
                  {r.gap > 0.2 ? (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }} title={`Gap: ${(r.gap * 100).toFixed(0)}%`}>
                      ↑{(r.gap * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
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

// ============================================================================
// Section 6: Era Coverage Gaps
// ============================================================================

function ErasSection({ entities, events, eraChronicles, eraEntityCounts, eraEventCounts, expanded }) {
  const [sort, onSort] = useColumnSort('chronicles');
  const [uncoveredOnly, setUncoveredOnly] = useState(false);

  const rows = useMemo(() => {
    // Collect all era IDs from entities, events, and chronicles
    const allEraIds = new Set([
      ...eraChronicles.keys(),
      ...eraEntityCounts.keys(),
      ...eraEventCounts.keys(),
    ]);

    // Also get era entities for names
    const eraEntities = entities.filter((e) => e.kind === 'era');
    const eraNameMap = new Map(eraEntities.map((e) => [e.id, e.name]));

    let computed = [...allEraIds].map((eraId) => {
      const chronicles = eraChronicles.get(eraId) || { total: 0, completed: 0, backported: 0 };
      const entityCount = eraEntityCounts.get(eraId) || 0;
      const eventCount = eraEventCounts.get(eraId) || 0;
      const name = eraNameMap.get(eraId) || eraId;
      return { eraId, name, chronicleCount: chronicles.total, completedCount: chronicles.completed, backportedCount: chronicles.backported, entityCount, eventCount };
    });

    if (uncoveredOnly) computed = computed.filter((r) => r.chronicleCount === 0);

    computed.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'entities': cmp = a.entityCount - b.entityCount; break;
        case 'events': cmp = a.eventCount - b.eventCount; break;
        case 'chronicles': cmp = a.chronicleCount - b.chronicleCount; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return computed;
  }, [entities, eraChronicles, eraEntityCounts, eraEventCounts, sort, uncoveredOnly]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.chronicleCount === 0 && (r.entityCount > 0 || r.eventCount > 0)).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={uncoveredOnly} onChange={(e) => setUncoveredOnly(e.target.checked)} />
          Uncovered only
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} eras</span>
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
                <span style={{ color: r.chronicleCount === 0 ? '#ef4444' : '#22c55e' }} title={`${r.chronicleCount} chronicles`}>
                  ◇{r.chronicleCount}
                </span>
                {r.completedCount > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }} title={`${r.completedCount} completed`}>
                    ✓{r.completedCount}
                  </span>
                )}
                {r.backportedCount > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }} title={`${r.backportedCount} backported`}>
                    ⇄{r.backportedCount}
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

// ============================================================================
// Section 7: Lore Integration Gaps
// ============================================================================

const GAP_FILTER_OPTIONS = [
  { value: 'all', label: 'All gaps' },
  { value: 'no_description', label: 'Missing description' },
  { value: 'no_backrefs', label: 'Missing backrefs' },
  { value: 'no_history', label: 'Missing history' },
  { value: 'no_historian', label: 'Missing historian' },
  { value: 'no_image', label: 'Missing image' },
];

function IntegrationSection({ entities, entityBackportedCount, expanded }) {
  const [sort, onSort] = useColumnSort('gaps', true);
  const [kindFilter, setKindFilter] = useState('all');
  const [cultureFilter, setCultureFilter] = useState('all');
  const [gapFilter, setGapFilter] = useState('all');

  const kindOptions = useMemo(() => getKindOptions(entities), [entities]);
  const cultureOptions = useMemo(() => getCultureOptions(entities), [entities]);

  const rows = useMemo(() => {
    let filtered = entities.filter((e) => e.kind !== 'era');
    if (kindFilter !== 'all') filtered = filtered.filter((e) => e.kind === kindFilter);
    if (cultureFilter !== 'all') filtered = filtered.filter((e) => e.culture === cultureFilter);

    const computed = filtered.map((e) => {
      const hasDescription = Boolean(e.description);
      const hasBackrefs = (e.enrichment?.chronicleBackrefs?.length ?? 0) > 0;
      const historyCount = e.enrichment?.descriptionHistory?.length ?? 0;
      const hasHistorianNotes = (e.enrichment?.historianNotes?.length ?? 0) > 0;
      const historianNoteCount = e.enrichment?.historianNotes?.length ?? 0;
      const hasImage = Boolean(e.enrichment?.image?.imageId);
      const backportedCount = entityBackportedCount.get(e.id) || 0;

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
        backrefCount: e.enrichment?.chronicleBackrefs?.length ?? 0,
        historyCount,
        hasHistorianNotes,
        historianNoteCount,
        hasImage,
        backportedCount,
        gapScore,
      };
    });

    let result = computed;
    switch (gapFilter) {
      case 'no_description': result = result.filter((r) => !r.hasDescription); break;
      case 'no_backrefs': result = result.filter((r) => !r.hasBackrefs); break;
      case 'no_history': result = result.filter((r) => r.historyCount === 0); break;
      case 'no_historian': result = result.filter((r) => !r.hasHistorianNotes); break;
      case 'no_image': result = result.filter((r) => !r.hasImage); break;
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sort.col) {
        case 'name': cmp = a.entity.name.localeCompare(b.entity.name); break;
        case 'kind': cmp = a.entity.kind.localeCompare(b.entity.kind); break;
        case 'prominence': cmp = (Number(a.entity.prominence) || 0) - (Number(b.entity.prominence) || 0); break;
        case 'gaps': cmp = a.gapScore - b.gapScore; break;
      }
      return sort.desc ? -cmp : cmp;
    });

    return result;
  }, [entities, entityBackportedCount, sort, kindFilter, cultureFilter, gapFilter]);

  const underutilCount = useMemo(
    () => rows.filter((r) => r.gapScore >= 3 && (Number(r.entity.prominence) || 0) >= 2).length,
    [rows]
  );

  if (!expanded) return underutilCount;

  return (
    <div>
      <SectionToolbar>
        <FilterSelect value={kindFilter} onChange={setKindFilter} options={kindOptions} label="Entity kind" />
        <FilterSelect value={cultureFilter} onChange={setCultureFilter} options={cultureOptions} label="Culture" />
        <FilterSelect value={gapFilter} onChange={setGapFilter} options={GAP_FILTER_OPTIONS} label="Gap type" />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{rows.length} entities</span>
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
              <td className="ec-name" title={`${r.entity.name} (${r.entity.id})`}>{r.entity.name}</td>
              <td className="ec-muted">{r.entity.kind}</td>
              <td><ProminenceDots value={r.entity.prominence} /></td>
              <td>
                <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <StatusDot active={r.hasDescription} label={r.hasDescription ? 'Has description' : 'Missing description'} />
                  <StatusDot active={r.hasBackrefs} label={r.hasBackrefs ? `${r.backrefCount} backrefs` : 'No backrefs'} />
                  <StatusDot active={r.historyCount > 0} label={r.historyCount > 0 ? `${r.historyCount} revisions` : 'No description history'} />
                  <StatusDot active={r.hasHistorianNotes} label={r.hasHistorianNotes ? `${r.historianNoteCount} notes` : 'No historian notes'} />
                  <StatusDot active={r.hasImage} label={r.hasImage ? 'Has image' : 'Missing image'} />
                </span>
              </td>
              <td className="ec-right" style={{ color: r.gapScore >= 3 ? '#ef4444' : r.gapScore >= 2 ? '#f59e0b' : 'var(--text-muted)' }}>
                {r.gapScore}/5
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

/**
 * Main component.
 *
 * Coverage analysis needs full PersistedEntity data (enrichment.chronicleBackrefs,
 * descriptionHistory, historianNotes, description text, tags, etc.) — fields that
 * are NOT on the lightweight EntityNavItem projections.
 *
 * To avoid loading ~9MB of entity data on every tab visit, this panel does NOT
 * auto-calculate. The user clicks "Calculate Statistics" which loads full entities
 * and chronicles from Dexie on demand, computes the analysis, and renders sections.
 * Events and relationships are subscribed from their stores (they're always in memory
 * since those stores use the simple full-data pattern — see narrativeEventStore.ts).
 */
export default function EntityCoveragePanel({ simulationRunId }) {
  // Events and relationships are always in memory (simple store pattern, no nav/detail split)
  const narrativeEvents = useNarrativeEvents();
  const relationships = useRelationships();

  // Full entity + chronicle data loaded on demand when user clicks "Calculate"
  const [analysisData, setAnalysisData] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set());

  // Reset when simulation run changes
  useEffect(() => {
    setAnalysisData(null);
  }, [simulationRunId]);

  const handleCalculate = useCallback(async () => {
    if (!simulationRunId) return;
    setCalculating(true);
    try {
      const [fullEntities, chronicles] = await Promise.all([
        getEntitiesForRun(simulationRunId),
        getChroniclesForSimulation(simulationRunId),
      ]);
      const safeEvents = narrativeEvents || [];
      const safeRelationships = relationships || [];
      const analysis = computeCoreAnalysis(fullEntities, chronicles, safeEvents, safeRelationships);
      setAnalysisData({ fullEntities, chronicles, analysis, events: safeEvents, relationships: safeRelationships });
    } catch (err) {
      console.error('[EntityCoverage] Failed to calculate:', err);
    } finally {
      setCalculating(false);
    }
  }, [simulationRunId, narrativeEvents, relationships]);

  const toggleSection = useCallback((sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  if (!simulationRunId) return null;

  // Before calculation — show button
  if (!analysisData) {
    return (
      <div style={{ marginTop: '16px' }}>
        <div className="illuminator-card">
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Entity Coverage Analysis</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 12px' }}>
              Analyzes coverage gaps across entities, chronicles, events, and relationships.
              Loads full entity data on demand.
            </p>
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              {calculating ? 'Calculating...' : 'Calculate Statistics'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { fullEntities, analysis, events: safeEvents, relationships: safeRelationships } = analysisData;

  // Compute underutil counts for collapsed section headers
  const sectionUnderutilCounts = {};
  for (const sectionId of SECTION_IDS) {
    if (!expandedSections.has(sectionId)) {
      switch (sectionId) {
        case 'suggestions':
          sectionUnderutilCounts[sectionId] = (() => {
            const groupsWithUncovered = new Set();
            for (const e of safeEvents) {
              if (!(analysis.eventCoverage.get(e.id) > 0)) {
                groupsWithUncovered.add(eventGroupKey(e));
              }
            }
            return groupsWithUncovered.size;
          })();
          break;
        case 'backrefs':
          sectionUnderutilCounts[sectionId] = fullEntities.filter((e) => {
            if (e.kind === 'era') return false;
            const expected = expectedForProminence(e.prominence);
            if (expected === 0) return false;
            const count = e.enrichment?.chronicleBackrefs?.length ?? 0;
            return count / expected < 1;
          }).length;
          break;
        case 'history':
          sectionUnderutilCounts[sectionId] = fullEntities.filter((e) => {
            if (e.kind === 'era') return false;
            return (e.enrichment?.chronicleBackrefs?.length ?? 0) > 0 && (e.enrichment?.descriptionHistory?.length ?? 0) === 0;
          }).length;
          break;
        case 'culture':
          sectionUnderutilCounts[sectionId] = [...(analysis.cultureEntities?.entries() || [])].filter(([, data]) => {
            if (data.count < 3) return false;
            let appeared = 0;
            for (const id of data.entityIds) {
              if (analysis.entityUsage.has(id)) appeared++;
            }
            return appeared / data.count < 0.3;
          }).length;
          break;
        case 'events':
          sectionUnderutilCounts[sectionId] = safeEvents.filter((e) => {
            return e.significance >= 0.7 && (e.participantEffects?.length ?? 0) >= 3 && !(analysis.eventCoverage.get(e.id) > 0);
          }).length;
          break;
        case 'potential':
          sectionUnderutilCounts[sectionId] = null; // expensive, skip for collapsed
          break;
        case 'eras': {
          const allEraIds = new Set([...analysis.eraChronicles.keys(), ...analysis.eraEntityCounts.keys(), ...analysis.eraEventCounts.keys()]);
          sectionUnderutilCounts[sectionId] = [...allEraIds].filter((eraId) => {
            return !(analysis.eraChronicles.get(eraId)?.total > 0) && ((analysis.eraEntityCounts.get(eraId) || 0) > 0 || (analysis.eraEventCounts.get(eraId) || 0) > 0);
          }).length;
          break;
        }
        case 'integration':
          sectionUnderutilCounts[sectionId] = fullEntities.filter((e) => {
            if (e.kind === 'era') return false;
            if ((Number(e.prominence) || 0) < 2) return false;
            let gaps = 0;
            if (!e.description) gaps++;
            if (!(e.enrichment?.chronicleBackrefs?.length > 0)) gaps++;
            if (!(e.enrichment?.descriptionHistory?.length > 0)) gaps++;
            if (!(e.enrichment?.historianNotes?.length > 0)) gaps++;
            if (!e.enrichment?.image?.imageId) gaps++;
            return gaps >= 3;
          }).length;
          break;
      }
    }
  }

  const sectionProps = {
    suggestions: { Component: SuggestionsSection, props: { events: safeEvents, entities: fullEntities, eventCoverage: analysis.eventCoverage, entityUsage: analysis.entityUsage } },
    backrefs: { Component: BackrefsSection, props: { entities: fullEntities } },
    history: { Component: HistorySection, props: { entities: fullEntities } },
    culture: { Component: CultureSection, props: { entities: fullEntities, cultureRoles: analysis.cultureRoles, cultureEntities: analysis.cultureEntities, entityUsage: analysis.entityUsage } },
    events: { Component: EventsSection, props: { events: safeEvents, eventCoverage: analysis.eventCoverage } },
    potential: { Component: PotentialSection, props: { entities: fullEntities, narrativeEvents: safeEvents, relationships: safeRelationships, entityUsage: analysis.entityUsage } },
    eras: { Component: ErasSection, props: { entities: fullEntities, events: safeEvents, eraChronicles: analysis.eraChronicles, eraEntityCounts: analysis.eraEntityCounts, eraEventCounts: analysis.eraEventCounts } },
    integration: { Component: IntegrationSection, props: { entities: fullEntities, entityBackportedCount: analysis.entityBackportedCount } },
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="illuminator-card" style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Entity Coverage Analysis</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {analysis.nonEraEntities.length} entities, {analysis.activeChronicles.length} chronicles, {safeEvents.length} events
          </span>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '4px 10px', fontSize: '11px', marginLeft: 'auto' }}
            title="Reload data from database and recalculate all statistics"
          >
            {calculating ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>
      </div>

      <div className="ec-grid">
        {SECTION_IDS.map((sectionId) => {
          const isExpanded = expandedSections.has(sectionId);
          const underutil = sectionUnderutilCounts[sectionId];
          const { Component, props } = sectionProps[sectionId];

          return (
            <div key={sectionId} className="illuminator-card ec-grid-cell">
              <SectionHeader
                sectionId={sectionId}
                expanded={isExpanded}
                onToggle={() => toggleSection(sectionId)}
                label={SECTION_LABELS[sectionId]}
                description={SECTION_DESCRIPTIONS[sectionId]}
                underutilCount={underutil}
              />
              {isExpanded && <Component {...props} expanded={true} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
