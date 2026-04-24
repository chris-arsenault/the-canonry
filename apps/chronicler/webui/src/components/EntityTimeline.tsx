/**
 * EntityTimeline - Expandable timeline of narrative events for an entity
 *
 * Displays events where the entity is a participant, with expand/collapse
 * to show entity-specific effects from participantEffects.
 */

import React, { useState, useMemo, useCallback } from "react";
import type { NarrativeEvent, EntityEffect } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";
import { useExpandSet } from "@the-canonry/shared-components";
import type { HardState } from "../types/world.ts";
import { linkifyText } from "../lib/entityLinking.ts";

type WeightTier = "high" | "mid-high" | "mid-low" | "low";

function getWeightTier(significance: number): WeightTier {
  if (significance > 0.75) return "high";
  if (significance > 0.5) return "mid-high";
  if (significance > 0.25) return "mid-low";
  return "low";
}

function getWeightClass(tier: WeightTier): string {
  switch (tier) {
    case "high": return "weight-high";
    case "mid-high": return "weight-mid-high";
    case "mid-low": return "weight-mid-low";
    case "low": return "weight-low";
  }
}

function getEffectStyle(type: EntityEffect["type"]): { icon: string; colorClass: string } {
  switch (type) {
    case "created": return { icon: "+", colorClass: "effect-created" };
    case "ended": return { icon: "×", colorClass: "effect-ended" };
    case "relationship_formed": return { icon: "↔", colorClass: "effect-relationship" };
    case "relationship_ended": return { icon: "↮", colorClass: "effect-ended" };
    case "tag_gained": return { icon: "●", colorClass: "effect-tag" };
    case "tag_lost": return { icon: "○", colorClass: "effect-ended" };
    case "field_changed": return { icon: "△", colorClass: "effect-field" };
    default: return { icon: "•", colorClass: "" };
  }
}

// Entity link style for linkifyText (kept as static object since it's passed to external function)
const entityLinkStyle = {
  color: "var(--color-accent)",
  cursor: "pointer",
  borderBottom: "1px dotted var(--color-accent)",
  textDecoration: "none",
};

interface EntityTimelineProps {
  events: NarrativeEvent[];
  entityId: string;
  entityIndex: Map<string, HardState>;
  onNavigate: (entityId: string) => void;
  onHoverEnter: Optional<(entityId: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
  loading: Optional<boolean>;
}

function isProminenceOnlyEvent(event: NarrativeEvent, entityId: string): boolean {
  const participant = event.participantEffects?.find((p) => p.entity.id === entityId);
  if (!participant || participant.effects.length === 0) return false;
  return participant.effects.every(
    (effect) => effect.type === "field_changed" && effect.field === "prominence"
  );
}

function filterRelevantEvents(
  events: NarrativeEvent[], entityId: string, showProminenceOnly: boolean
): NarrativeEvent[] {
  return events
    .filter((event) => {
      if (!event.participantEffects?.some((p) => p.entity.id === entityId)) return false;
      if (!showProminenceOnly && isProminenceOnlyEvent(event, entityId)) return false;
      return true;
    })
    .sort((a, b) => a.tick - b.tick);
}

function ProminenceFilterCheckbox({
  checked,
  onChange,
}: Readonly<{ checked: boolean; onChange: (v: boolean) => void }>) {
  return (
    <label className="filter-row">
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="checkbox"
      />
      <span className="checkbox-label">Show prominence-only events</span>
    </label>
  );
}

function EventEffectsList({
  effects,
  linkableEntities,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
}: Readonly<{
  effects: EntityEffect[];
  linkableEntities: Array<{ name: string; id: string }>;
  onNavigate: (entityId: string) => void;
  onHoverEnter: Optional<(id: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
}>) {
  if (effects.length === 0) {
    return <span className="no-effects">No specific effects recorded</span>;
  }
  return (
    <ul className="effects-list">
      {effects.map((effect, idx) => {
        const { icon, colorClass } = getEffectStyle(effect.type);
        return (
          <li key={idx} className="effect-item">
            <span className={`effect-icon ${colorClass}`}>{icon}</span>
            <span className="effect-description">
              {linkifyText(effect.description, linkableEntities, onNavigate, {
                linkStyle: entityLinkStyle, onHoverEnter, onHoverLeave,
              })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EventRow({
  event,
  isExpanded,
  effects,
  onToggle,
  getEraName,
  renderDescription,
  linkableEntities,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
}: Readonly<{
  event: NarrativeEvent;
  isExpanded: boolean;
  effects: EntityEffect[];
  onToggle: (id: string) => void;
  getEraName: (eraId: string) => string;
  renderDescription: (event: NarrativeEvent) => React.ReactNode;
  linkableEntities: Array<{ name: string; id: string }>;
  onNavigate: (entityId: string) => void;
  onHoverEnter: Optional<(id: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
}>) {
  const canExpand = effects.length > 0;
  return (
    <React.Fragment>
      <tr
        className={isExpanded ? "row-expanded" : "row"}
        onClick={() => canExpand && onToggle(event.id)}
      >
        <td className="td td-tick">{event.tick}</td>
        <td className="td td-era">{getEraName(event.era)}</td>
        <td className={`td td-event ${getWeightClass(getWeightTier(event.significance ?? 0.5))}`}>
          {renderDescription(event)}
        </td>
        <td className="td td-expand">
          {canExpand && (
            <span className={`expand-icon ${isExpanded ? "expand-icon-open" : ""}`}>▶</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="effects-row">
          <td colSpan={4} className="effects-cell">
            <EventEffectsList
              effects={effects} linkableEntities={linkableEntities}
              onNavigate={onNavigate} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default function EntityTimeline({
  events,
  entityId,
  entityIndex,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  loading = false,
}: Readonly<EntityTimelineProps>) {
  const { expanded: expandedIds, toggle: toggleExpand } = useExpandSet();
  const [showProminenceOnly, setShowProminenceOnly] = useState(false);

  const relevantEvents = useMemo(() => filterRelevantEvents(events, entityId, showProminenceOnly), [events, entityId, showProminenceOnly]);
  const getEntityEffects = useCallback((event: NarrativeEvent): EntityEffect[] => {
    return event.participantEffects?.find((p) => p.entity.id === entityId)?.effects ?? [];
  }, [entityId]);
  const getEraName = useCallback((eraId: string): string => entityIndex.get(eraId)?.name ?? eraId, [entityIndex]);
  const linkableEntities = useMemo(() => Array.from(entityIndex.values()).map((e) => ({ name: e.name, id: e.id })), [entityIndex]);
  // eslint-disable-next-line sonarjs/function-return-type -- returns React.ReactNode by design
  const renderDescription = useCallback((event: NarrativeEvent): React.ReactNode => {
    return linkifyText(event.description || "", linkableEntities, onNavigate, { linkStyle: entityLinkStyle, onHoverEnter, onHoverLeave });
  }, [linkableEntities, onNavigate, onHoverEnter, onHoverLeave]);

  if (relevantEvents.length === 0 && !showProminenceOnly) {
    return (
      <div className="et-container">
        <ProminenceFilterCheckbox checked={showProminenceOnly} onChange={setShowProminenceOnly} />
        <div className="et-empty-state">
          {loading ? "Loading narrative history..." : "No timeline events recorded for this entity."}
        </div>
      </div>
    );
  }

  return (
    <div className="et-container">
      <ProminenceFilterCheckbox checked={showProminenceOnly} onChange={setShowProminenceOnly} />
      <table className="table">
        <thead>
          <tr className="header-row">
            <th className="th-tick">Tick</th>
            <th className="th-era">Era</th>
            <th className="th">Event</th>
            <th className="th-expand"></th>
          </tr>
        </thead>
        <tbody>
          {relevantEvents.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              isExpanded={expandedIds.has(event.id)}
              effects={getEntityEffects(event)}
              onToggle={toggleExpand}
              getEraName={getEraName}
              renderDescription={renderDescription}
              linkableEntities={linkableEntities}
              onNavigate={onNavigate}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
