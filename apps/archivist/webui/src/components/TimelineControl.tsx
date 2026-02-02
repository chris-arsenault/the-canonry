import { useState, useEffect, useRef, useMemo } from 'react';
import type { WorldState, LoreData, EraNarrativeLore, DiscoveryEventLore } from '../types/world.ts';
import EraNarrative from './EraNarrative.tsx';
import DiscoveryStory from './DiscoveryStory.tsx';
import './TimelineControl.css';

// Type for narrative history events (from world output)
interface NarrativeEvent {
  id: string;
  tick: number;
  era: string;
  eventKind: string;
  significance: number;
  subject: { id: string; name: string; kind: string; subtype: string };
  action: string;
  description: string;
  narrativeTags: string[];
}

// Era transition milestone derived from narrativeHistory
interface EraTransitionMilestone {
  id: string;
  tick: number;
  era: string;
  description: string;
}

interface TimelineControlProps {
  worldData: WorldState;
  loreData: LoreData | null;
  currentTick: number;
  onTickChange: (tick: number) => void;
}

export default function TimelineControl({ worldData, loreData, currentTick, onTickChange }: TimelineControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedEraNarrative, setSelectedEraNarrative] = useState<EraNarrativeLore | null>(null);
  const [selectedEraTransition, setSelectedEraTransition] = useState<EraTransitionMilestone | null>(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryEventLore | null>(null);
  const previousTickRef = useRef(currentTick);

  const maxTick = worldData.metadata.tick;
  const minTick = 0;

  // Get all era narratives from lore (if available)
  const eraNarratives = useMemo(() => {
    return (loreData?.records?.filter(
      record => record.type === 'era_narrative'
    ) as EraNarrativeLore[]) || [];
  }, [loreData]);

  // Get all discovery events from lore (if available)
  const discoveryEvents = useMemo(() => {
    return (loreData?.records?.filter(
      record => record.type === 'discovery_event'
    ) as DiscoveryEventLore[]) || [];
  }, [loreData]);

  // Get era transitions from narrativeHistory (fallback when no loreData)
  const eraTransitions = useMemo(() => {
    const history = (worldData as any).narrativeHistory as NarrativeEvent[] | undefined;
    if (!history) return [];
    return history
      .filter(e => e.eventKind === 'era_transition')
      .map(e => ({
        id: e.id,
        tick: e.tick,
        era: e.era,
        description: e.description,
      }));
  }, [worldData]);

  // Use eraNarratives if available, otherwise use eraTransitions
  const hasLoreNarratives = eraNarratives.length > 0;

  // Get events at the current tick from narrativeHistory (significance > 0.75 only)
  const currentEvents = useMemo(() => {
    const history = (worldData as any).narrativeHistory as NarrativeEvent[] | undefined;
    if (!history) return [];

    // Get high-significance events at exact tick, sorted by significance
    return history
      .filter(e => e.tick === currentTick && e.eventKind !== 'era_transition' && e.significance > 0.75)
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 5) // Limit to 5 most significant events
      .map(e => ({
        type: e.eventKind,
        description: e.description,
        significance: e.significance,
      }));
  }, [worldData, currentTick]);

  // Detect when crossing era transition ticks
  useEffect(() => {
    const previousTick = previousTickRef.current;
    previousTickRef.current = currentTick;

    // Check if we crossed an era transition from lore
    if (hasLoreNarratives) {
      const crossedNarrative = eraNarratives.find(
        narrative => {
          const tick = narrative.metadata.tick;
          return (previousTick < tick && currentTick >= tick) ||
                 (previousTick > tick && currentTick <= tick);
        }
      );

      if (crossedNarrative && isPlaying) {
        setSelectedEraNarrative(crossedNarrative);
        setIsPlaying(false);
      }
    } else {
      // Check narrativeHistory era transitions
      const crossedTransition = eraTransitions.find(
        transition => {
          const tick = transition.tick;
          return (previousTick < tick && currentTick >= tick) ||
                 (previousTick > tick && currentTick <= tick);
        }
      );

      if (crossedTransition && isPlaying) {
        setSelectedEraTransition(crossedTransition);
        setIsPlaying(false);
      }
    }
  }, [currentTick, eraNarratives, eraTransitions, hasLoreNarratives, isPlaying]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const nextTick = currentTick + playSpeed;
      if (nextTick >= maxTick) {
        setIsPlaying(false);
        onTickChange(maxTick);
      } else {
        onTickChange(nextTick);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, maxTick, currentTick, onTickChange]);

  // Determine the era at the current tick by finding the most recent era created before/at this tick
  const currentEra = useMemo(() => {
    const eras = worldData.hardState
      .filter(e => e.kind === 'era')
      .sort((a, b) => a.createdAt - b.createdAt);

    // Find the last era that was created at or before the current tick
    let activeEra = eras[0]?.name || 'unknown';
    for (const era of eras) {
      if (era.createdAt <= currentTick) {
        activeEra = era.name;
      } else {
        break;
      }
    }
    return activeEra;
  }, [worldData.hardState, currentTick]);

  // Count entities and relationships at current tick
  const entitiesAtTick = worldData.hardState.filter(e => e.createdAt <= currentTick).length;
  const relationshipsAtTick = worldData.relationships.filter(r => {
    const srcEntity = worldData.hardState.find(e => e.id === r.src);
    const dstEntity = worldData.hardState.find(e => e.id === r.dst);
    return srcEntity && dstEntity && srcEntity.createdAt <= currentTick && dstEntity.createdAt <= currentTick;
  }).length;

  const handlePlayPause = () => {
    if (currentTick >= maxTick) {
      onTickChange(minTick);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onTickChange(minTick);
  };

  const handleToEnd = () => {
    setIsPlaying(false);
    onTickChange(maxTick);
  };

  return (
    <div className={`timeline-control ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="timeline-header">
        <button
          className="timeline-expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse timeline' : 'Expand timeline'}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
        <div className="timeline-title">
          <span className="timeline-icon">⏱️</span>
          <span>Timeline</span>
        </div>
        <div className="timeline-stats">
          <span className="timeline-stat">Tick {currentTick}</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat era-badge">{currentEra}</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat">{entitiesAtTick} entities</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat">{relationshipsAtTick} links</span>
        </div>
      </div>

      {isExpanded && (<>
      <div className="timeline-slider-container">
        <input
          type="range"
          min={minTick}
          max={maxTick}
          value={currentTick}
          onChange={(e) => {
            setIsPlaying(false);
            onTickChange(parseInt(e.target.value));
          }}
          className="timeline-slider"
        />
        {/* Era Milestones - positioned over the slider */}
        {(eraNarratives.length > 0 || eraTransitions.length > 0 || discoveryEvents.length > 0) && (
          <div className="timeline-milestones">
            {/* Era Narratives from loreData */}
            {eraNarratives.map(narrative => {
              const tick = narrative.metadata.tick;
              const percent = (tick / maxTick) * 100;
              return (
                <button
                  key={narrative.id}
                  className={`timeline-milestone timeline-milestone-era ${currentTick === tick ? 'active' : ''}`}
                  style={{ left: `${percent}%` }}
                  onClick={() => setSelectedEraNarrative(narrative)}
                  title={`${narrative.metadata.from} → ${narrative.metadata.to} (Tick ${tick})`}
                >
                  📜
                </button>
              );
            })}
            {/* Era Transitions from narrativeHistory (fallback) */}
            {!hasLoreNarratives && eraTransitions.map(transition => {
              const tick = transition.tick;
              const percent = (tick / maxTick) * 100;
              return (
                <button
                  key={transition.id}
                  className={`timeline-milestone timeline-milestone-era ${currentTick === tick ? 'active' : ''}`}
                  style={{ left: `${percent}%` }}
                  onClick={() => setSelectedEraTransition(transition)}
                  title={`Era: ${transition.era} (Tick ${tick})`}
                >
                  🏛️
                </button>
              );
            })}
            {/* Discovery Events */}
            {discoveryEvents.map(discovery => {
              const tick = discovery.metadata.tick;
              const percent = (tick / maxTick) * 100;
              return (
                <button
                  key={discovery.id}
                  className={`timeline-milestone timeline-milestone-discovery timeline-milestone-${discovery.metadata.discoveryType} ${currentTick === tick ? 'active' : ''}`}
                  style={{ left: `${percent}%` }}
                  onClick={() => setSelectedDiscovery(discovery)}
                  title={`Discovery by ${discovery.metadata.explorer} (Tick ${tick})`}
                >
                  🧭
                </button>
              );
            })}
          </div>
        )}
        <div className="timeline-markers">
          <span>{minTick}</span>
          <span>{maxTick}</span>
        </div>
      </div>

      <div className="timeline-controls">
        <button onClick={handleReset} className="timeline-btn" title="Reset to start">
          ⏮
        </button>
        <button onClick={handlePlayPause} className="timeline-btn timeline-btn-play">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={handleToEnd} className="timeline-btn" title="Jump to end">
          ⏭
        </button>

        <div className="timeline-speed">
          <label>Speed:</label>
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            className="timeline-speed-select"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      <div className="timeline-events">
        <div className="timeline-events-header">
          {currentEvents.length > 0 ? `Events at Tick ${currentTick}:` : 'No events at this tick'}
        </div>
        <div className="timeline-events-ticker">
          {currentEvents.length > 0 ? (
            currentEvents.map((event, idx) => (
              <div key={idx} className={`timeline-event timeline-event-${event.type}`}>
                <span className="timeline-event-type">{getEventIcon(event.type)}</span>
                <span className="timeline-event-desc">{event.description}</span>
              </div>
            ))
          ) : (
            <div className="timeline-event-empty">
              Scrub through time to see historical events unfold
            </div>
          )}
        </div>
      </div>
      </>)}

      {/* Era Narrative Modal (from loreData) */}
      {selectedEraNarrative && (
        <EraNarrative
          lore={selectedEraNarrative}
          onClose={() => setSelectedEraNarrative(null)}
        />
      )}

      {/* Era Transition Modal (from narrativeHistory) */}
      {selectedEraTransition && (
        <div className="era-transition-modal" onClick={() => setSelectedEraTransition(null)}>
          <div className="era-transition-content" onClick={e => e.stopPropagation()}>
            <div className="era-transition-header">
              <span className="era-transition-icon">🏛️</span>
              <h2>Era Transition</h2>
              <button className="era-transition-close" onClick={() => setSelectedEraTransition(null)}>×</button>
            </div>
            <div className="era-transition-body">
              <div className="era-transition-era">{selectedEraTransition.era}</div>
              <div className="era-transition-tick">Tick {selectedEraTransition.tick}</div>
              <p className="era-transition-description">{selectedEraTransition.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Story Modal */}
      {selectedDiscovery && (
        <DiscoveryStory
          lore={selectedDiscovery}
          onExplorerClick={() => {}}
          onClose={() => setSelectedDiscovery(null)}
          isModal={true}
        />
      )}
    </div>
  );
}

// Helper function to get icon for event type
function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    creation_batch: '🌱',
    alliance_formed: '🤝',
    state_change: '🔄',
    downfall: '📉',
    rivalry_formed: '⚔️',
    war_started: '🔥',
    war_ended: '🕊️',
    betrayal: '🗡️',
    reconciliation: '💙',
    triumph: '🏆',
    relationship_formed: '🔗',
    tag_gained: '🏷️',
    tag_lost: '❌',
  };
  return icons[eventType] || '📋';
}
