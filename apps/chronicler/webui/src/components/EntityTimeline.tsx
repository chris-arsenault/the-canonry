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
import styles from "./EntityTimeline.module.css";

type WeightTier = "high" | "mid-high" | "mid-low" | "low";

function getWeightTier(significance: number): WeightTier {
  if (significance > 0.75) return "high";
  if (significance > 0.5) return "mid-high";
  if (significance > 0.25) return "mid-low";
  return "low";
}

function getWeightClass(tier: WeightTier): string {
  switch (tier) {
    case "high": return styles.weightHigh;
    case "mid-high": return styles.weightMidHigh;
    case "mid-low": return styles.weightMidLow;
    case "low": return styles.weightLow;
  }
}

function getEffectStyle(type: EntityEffect["type"]): { icon: string; colorClass: string } {
  switch (type) {
    case "created": return { icon: "+", colorClass: styles.effectCreated };
    case "ended": return { icon: "×", colorClass: styles.effectEnded };
    case "relationship_formed": return { icon: "↔", colorClass: styles.effectRelationship };
    case "relationship_ended": return { icon: "↮", colorClass: styles.effectEnded };
    case "tag_gained": return { icon: "●", colorClass: styles.effectTag };
    case "tag_lost": return { icon: "○", colorClass: styles.effectEnded };
    case "field_changed": return { icon: "△", colorClass: styles.effectField };
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
    <label className={styles.filterRow}>
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.checkbox}
      />
      <span className={styles.checkboxLabel}>Show prominence-only events</span>
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
    return <span className={styles.noEffects}>No specific effects recorded</span>;
  }
  return (
    <ul className={styles.effectsList}>
      {effects.map((effect, idx) => {
        const { icon, colorClass } = getEffectStyle(effect.type);
        return (
          <li key={idx} className={styles.effectItem}>
            <span className={`${styles.effectIcon} ${colorClass}`}>{icon}</span>
            <span className={styles.effectDescription}>
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
        className={isExpanded ? styles.rowExpanded : styles.row}
        onClick={() => canExpand && onToggle(event.id)}
      >
        <td className={`${styles.td} ${styles.tdTick}`}>{event.tick}</td>
        <td className={`${styles.td} ${styles.tdEra}`}>{getEraName(event.era)}</td>
        <td className={`${styles.td} ${styles.tdEvent} ${getWeightClass(getWeightTier(event.significance ?? 0.5))}`}>
          {renderDescription(event)}
        </td>
        <td className={`${styles.td} ${styles.tdExpand}`}>
          {canExpand && (
            <span className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ""}`}>▶</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className={styles.effectsRow}>
          <td colSpan={4} className={styles.effectsCell}>
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
      <div className={styles.container}>
        <ProminenceFilterCheckbox checked={showProminenceOnly} onChange={setShowProminenceOnly} />
        <div className={styles.emptyState}>
          {loading ? "Loading narrative history..." : "No timeline events recorded for this entity."}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProminenceFilterCheckbox checked={showProminenceOnly} onChange={setShowProminenceOnly} />
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.thTick}>Tick</th>
            <th className={styles.thEra}>Era</th>
            <th className={styles.th}>Event</th>
            <th className={styles.thExpand}></th>
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
