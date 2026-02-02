/**
 * EntityTimeline - Expandable timeline of narrative events for an entity
 *
 * Displays events where the entity is a participant, with expand/collapse
 * to show entity-specific effects from participantEffects.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { NarrativeEvent, EntityEffect } from '@canonry/world-schema';
import type { HardState } from '../types/world.ts';
import { linkifyText } from '../lib/entityLinking.ts';
import styles from './EntityTimeline.module.css';

type WeightTier = 'high' | 'mid-high' | 'mid-low' | 'low';

/**
 * Determine weight tier from significance score (0-1)
 * >0.75: high, 0.50-0.75: mid-high, 0.25-0.50: mid-low, <0.25: low
 */
function getWeightTier(significance: number): WeightTier {
  if (significance > 0.75) return 'high';
  if (significance > 0.50) return 'mid-high';
  if (significance > 0.25) return 'mid-low';
  return 'low';
}

/**
 * Get CSS class for weight tier
 */
function getWeightClass(tier: WeightTier): string {
  switch (tier) {
    case 'high':
      return styles.weightHigh;
    case 'mid-high':
      return styles.weightMidHigh;
    case 'mid-low':
      return styles.weightMidLow;
    case 'low':
      return styles.weightLow;
  }
}

/**
 * Get icon and CSS class for an effect type
 */
function getEffectStyle(type: EntityEffect['type']): { icon: string; colorClass: string } {
  switch (type) {
    case 'created':
      return { icon: '+', colorClass: styles.effectCreated };
    case 'ended':
      return { icon: '×', colorClass: styles.effectEnded };
    case 'relationship_formed':
      return { icon: '↔', colorClass: styles.effectRelationship };
    case 'relationship_ended':
      return { icon: '↮', colorClass: styles.effectEnded };
    case 'tag_gained':
      return { icon: '●', colorClass: styles.effectTag };
    case 'tag_lost':
      return { icon: '○', colorClass: styles.effectEnded };
    case 'field_changed':
      return { icon: '△', colorClass: styles.effectField };
    default:
      return { icon: '•', colorClass: '' };
  }
}

// Entity link style for linkifyText (kept as inline style since it's passed to external function)
const entityLinkStyle = {
  color: '#10b981',
  cursor: 'pointer',
  borderBottom: '1px dotted #10b981',
  textDecoration: 'none',
};

interface EntityTimelineProps {
  events: NarrativeEvent[];
  entityId: string;
  entityIndex: Map<string, HardState>;
  onNavigate: (entityId: string) => void;
  onHoverEnter?: (entityId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
  loading?: boolean;
}

export default function EntityTimeline({
  events,
  entityId,
  entityIndex,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  loading = false,
}: EntityTimelineProps) {
  // Multi-expand state: set of expanded event IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Whether to show prominence-only events (default: hidden)
  const [showProminenceOnly, setShowProminenceOnly] = useState(false);

  /**
   * Check if an event is "prominence-only" for this entity.
   * An event is prominence-only if ALL of its effects for this entity
   * are field_changed effects on the 'prominence' field.
   */
  const isProminenceOnlyEvent = useCallback((event: NarrativeEvent): boolean => {
    const participant = event.participantEffects?.find(p => p.entity.id === entityId);
    if (!participant || participant.effects.length === 0) return false;

    // Check if ALL effects are prominence field changes
    return participant.effects.every(
      effect => effect.type === 'field_changed' && effect.field === 'prominence'
    );
  }, [entityId]);

  // Filter and process events for this entity
  const relevantEvents = useMemo(() => {
    return events
      .filter(event => {
        // Check if entity appears in participantEffects
        if (!event.participantEffects?.some(p => p.entity.id === entityId)) {
          return false;
        }
        // Exclude prominence-only events unless checkbox is checked
        if (!showProminenceOnly && isProminenceOnlyEvent(event)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.tick - b.tick); // Chronological order
  }, [events, entityId, isProminenceOnlyEvent, showProminenceOnly]);

  // Get participant effects for the current entity
  const getEntityEffects = useCallback((event: NarrativeEvent): EntityEffect[] => {
    const participant = event.participantEffects?.find(p => p.entity.id === entityId);
    return participant?.effects ?? [];
  }, [entityId]);

  // Toggle expand state for an event
  const toggleExpand = useCallback((eventId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Get era name from entity index
  const getEraName = useCallback((eraId: string): string => {
    const era = entityIndex.get(eraId);
    return era?.name ?? eraId;
  }, [entityIndex]);

  // Build linkable entities list for entity linking
  const linkableEntities = useMemo(() => {
    return Array.from(entityIndex.values()).map(e => ({ name: e.name, id: e.id }));
  }, [entityIndex]);

  // Render description with wiki links
  const renderDescription = useCallback((event: NarrativeEvent): React.ReactNode => {
    const description = event.description || '';
    return linkifyText(description, linkableEntities, onNavigate, {
      linkStyle: entityLinkStyle,
      onHoverEnter,
      onHoverLeave,
    });
  }, [linkableEntities, onNavigate, onHoverEnter, onHoverLeave]);

  if (relevantEvents.length === 0 && !showProminenceOnly) {
    return (
      <div className={styles.container}>
        <label className={styles.filterRow}>
          <input
            type="checkbox"
            checked={showProminenceOnly}
            onChange={(e) => setShowProminenceOnly(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.checkboxLabel}>Show prominence-only events</span>
        </label>
        <div className={styles.emptyState}>
          {loading ? 'Loading narrative history...' : 'No timeline events recorded for this entity.'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <label className={styles.filterRow}>
        <input
          type="checkbox"
          checked={showProminenceOnly}
          onChange={(e) => setShowProminenceOnly(e.target.checked)}
          className={styles.checkbox}
        />
        <span className={styles.checkboxLabel}>Show prominence-only events</span>
      </label>
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
          {relevantEvents.map(event => {
            const isExpanded = expandedIds.has(event.id);
            const effects = getEntityEffects(event);
            const canExpand = effects.length > 0;

            return (
              <React.Fragment key={event.id}>
                {/* Main event row */}
                <tr
                  className={isExpanded ? styles.rowExpanded : styles.row}
                  onClick={() => canExpand && toggleExpand(event.id)}
                >
                  <td className={`${styles.td} ${styles.tdTick}`}>{event.tick}</td>
                  <td className={`${styles.td} ${styles.tdEra}`}>{getEraName(event.era)}</td>
                  <td className={`${styles.td} ${styles.tdEvent} ${getWeightClass(getWeightTier(event.significance ?? 0.5))}`}>
                    {renderDescription(event)}
                  </td>
                  <td className={`${styles.td} ${styles.tdExpand}`}>
                    {canExpand && (
                      <span className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ''}`}>
                        ▶
                      </span>
                    )}
                  </td>
                </tr>

                {/* Expanded effects row */}
                {isExpanded && (
                  <tr className={styles.effectsRow}>
                    <td colSpan={4} className={styles.effectsCell}>
                      {effects.length > 0 ? (
                        <ul className={styles.effectsList}>
                          {effects.map((effect, idx) => {
                            const { icon, colorClass } = getEffectStyle(effect.type);
                            return (
                              <li key={idx} className={styles.effectItem}>
                                <span className={`${styles.effectIcon} ${colorClass}`}>
                                  {icon}
                                </span>
                                <span className={styles.effectDescription}>
                                  {linkifyText(effect.description, linkableEntities, onNavigate, {
                                    linkStyle: entityLinkStyle,
                                    onHoverEnter,
                                    onHoverLeave,
                                  })}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className={styles.noEffects}>No specific effects recorded</span>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
