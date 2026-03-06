import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { WorldState, LoreData, EraNarrativeLore, DiscoveryEventLore } from "../types/world.ts";
import EraNarrative from "./EraNarrative.tsx";
import DiscoveryStory from "./DiscoveryStory.tsx";
import "./archivist-section.css";
import "./TimelineControl.css";

interface NarrativeEvent {
  id: string; tick: number; era: string; eventKind: string; significance: number;
  subject: { id: string; name: string; kind: string; subtype: string; };
  action: string; description: string; narrativeTags: string[];
}

interface EraTransitionMilestone { id: string; tick: number; era: string; description: string; }

interface TimelineControlProps {
  worldData: WorldState; loreData: LoreData | null; currentTick: number; onTickChange: (tick: number) => void;
}

function useTimelineDerived(worldData: WorldState, loreData: LoreData | null, currentTick: number) {
  const eraNarratives = useMemo(() =>
    (loreData?.records?.filter(r => r.type === "era_narrative") as EraNarrativeLore[]) || [], [loreData]);
  const discoveryEvents = useMemo(() =>
    (loreData?.records?.filter(r => r.type === "discovery_event") as DiscoveryEventLore[]) || [], [loreData]);
  const eraTransitions = useMemo(() => {
    const h = worldData.narrativeHistory as NarrativeEvent[] | undefined;
    return h ? h.filter(e => e.eventKind === "era_transition").map(e => ({ id: e.id, tick: e.tick, era: e.era, description: e.description })) : [];
  }, [worldData]);
  const currentEvents = useMemo(() => {
    const h = worldData.narrativeHistory as NarrativeEvent[] | undefined;
    if (!h) return [];
    return h.filter(e => e.tick === currentTick && e.eventKind !== "era_transition" && e.significance > 0.75)
      .sort((a, b) => b.significance - a.significance).slice(0, 5)
      .map(e => ({ type: e.eventKind, description: e.description, significance: e.significance }));
  }, [worldData, currentTick]);
  const currentEra = useMemo(() => {
    const eras = worldData.hardState.filter(e => e.kind === "era").sort((a, b) => a.createdAt - b.createdAt);
    let active = eras[0]?.name || "unknown";
    for (const era of eras) { if (era.createdAt <= currentTick) active = era.name; else break; }
    return active;
  }, [worldData.hardState, currentTick]);
  const entitiesAtTick = worldData.hardState.filter(e => e.createdAt <= currentTick).length;
  return { eraNarratives, discoveryEvents, eraTransitions, currentEvents, currentEra, entitiesAtTick };
}

function EraTransitionModal({ transition, onClose }: Readonly<{ transition: EraTransitionMilestone; onClose: () => void }>) {
  const keyHandler = (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); };
  return (
    <div className="era-transition-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={keyHandler}>
      <div className="era-transition-content" onClick={e => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={keyHandler}>
        <div className="era-transition-header">
          <span className="era-transition-icon">🏛️</span>
          <h2>Era Transition</h2>
          <button className="era-transition-close" onClick={onClose}>×</button>
        </div>
        <div className="era-transition-body">
          <div className="era-transition-era">{transition.era}</div>
          <div className="era-transition-tick">Tick {transition.tick}</div>
          <p className="era-transition-description">{transition.description}</p>
        </div>
      </div>
    </div>
  );
}

function TimelineEventsTicker({ currentEvents, currentTick }: Readonly<{ currentEvents: { type: string; description: string }[]; currentTick: number }>) {
  return (
    <div className="timeline-events">
      <div className="timeline-events-header">
        {currentEvents.length > 0 ? `Events at Tick ${currentTick}:` : "No events at this tick"}
      </div>
      <div className="timeline-events-ticker">
        {currentEvents.length > 0
          ? currentEvents.map((event, idx) => (
            <div key={idx} className={`timeline-event timeline-event-${event.type}`}>
              <span className="timeline-event-type">{getEventIcon(event.type)}</span>
              <span className="timeline-event-desc">{event.description}</span>
            </div>))
          : <div className="timeline-event-empty">Scrub through time to see historical events unfold</div>}
      </div>
    </div>
  );
}

const NOOP = () => {};

// eslint-disable-next-line complexity -- timeline playback + era detection + milestone rendering requires inherent branching
export default function TimelineControl({ worldData, loreData, currentTick, onTickChange }: Readonly<TimelineControlProps>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  // eslint-disable-next-line local/no-manual-expand-state -- useExpandBoolean doesn't support initial=true; timeline must start expanded
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedEraNarrative, setSelectedEraNarrative] = useState<EraNarrativeLore | null>(null);
  const [selectedEraTransition, setSelectedEraTransition] = useState<EraTransitionMilestone | null>(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryEventLore | null>(null);
  const maxTick = worldData.metadata.tick;
  const { eraNarratives, discoveryEvents, eraTransitions, currentEvents, currentEra, entitiesAtTick } =
    useTimelineDerived(worldData, loreData, currentTick);
  const hasLoreNarratives = eraNarratives.length > 0;
  const clearEraNarrative = useCallback(() => setSelectedEraNarrative(null), []);
  const clearEraTransition = useCallback(() => setSelectedEraTransition(null), []);
  const clearDiscovery = useCallback(() => setSelectedDiscovery(null), []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const next = currentTick + playSpeed;
      // Check milestone crossings during playback advance
      const crossed = hasLoreNarratives
        ? eraNarratives.find(n => currentTick < n.metadata.tick && next >= n.metadata.tick) : null;
      if (crossed) { setSelectedEraNarrative(crossed); setIsPlaying(false); return; }
      if (!hasLoreNarratives) {
        const ct = eraTransitions.find(t => currentTick < t.tick && next >= t.tick);
        if (ct) { setSelectedEraTransition(ct); setIsPlaying(false); return; }
      }
      if (next >= maxTick) { setIsPlaying(false); onTickChange(maxTick); } else { onTickChange(next); }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, maxTick, currentTick, onTickChange, hasLoreNarratives, eraNarratives, eraTransitions]);

  return (
    <div className={`timeline-control ${isExpanded ? "expanded" : "collapsed"}`}>
      <div className="timeline-header">
        <button className="timeline-expand-btn" onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse timeline" : "Expand timeline"}>{isExpanded ? "▼" : "▲"}</button>
        <div className="timeline-title"><span className="timeline-icon">⏱️</span><span>Timeline</span></div>
        <div className="timeline-stats">
          <span className="timeline-stat">Tick {currentTick}</span><span className="timeline-divider">•</span>
          <span className="timeline-stat era-badge">{currentEra}</span><span className="timeline-divider">•</span>
          <span className="timeline-stat">{entitiesAtTick} entities</span>
        </div>
      </div>
      {isExpanded && <>
        <div className="timeline-slider-container">
          <input type="range" min={0} max={maxTick} value={currentTick}
            onChange={e => { setIsPlaying(false); onTickChange(parseInt(e.target.value)); }} className="timeline-slider" />
          {(eraNarratives.length > 0 || eraTransitions.length > 0 || discoveryEvents.length > 0) && (
            <div className="timeline-milestones">
              {eraNarratives.map(n => <button key={n.id} className={`timeline-milestone timeline-milestone-era ${currentTick === n.metadata.tick ? "active" : ""}`}
                onClick={() => setSelectedEraNarrative(n)} title={`${n.metadata.from} → ${n.metadata.to} (Tick ${n.metadata.tick})`}>📜</button>)}
              {!hasLoreNarratives && eraTransitions.map(t => <button key={t.id} className={`timeline-milestone timeline-milestone-era ${currentTick === t.tick ? "active" : ""}`}
                onClick={() => setSelectedEraTransition(t)} title={`Era: ${t.era} (Tick ${t.tick})`}>🏛️</button>)}
              {discoveryEvents.map(d => <button key={d.id} className={`timeline-milestone timeline-milestone-discovery timeline-milestone-${d.metadata.discoveryType} ${currentTick === d.metadata.tick ? "active" : ""}`}
                onClick={() => setSelectedDiscovery(d)} title={`Discovery by ${d.metadata.explorer} (Tick ${d.metadata.tick})`}>🧭</button>)}
            </div>)}
          <div className="timeline-markers"><span>0</span><span>{maxTick}</span></div>
        </div>
        <div className="timeline-controls">
          <button onClick={() => { setIsPlaying(false); onTickChange(0); }} className="timeline-btn" title="Reset to start">⏮</button>
          <button onClick={() => { if (currentTick >= maxTick) { onTickChange(0); } setIsPlaying(!isPlaying); }} className="timeline-btn timeline-btn-play">{isPlaying ? "⏸" : "▶"}</button>
          <button onClick={() => { setIsPlaying(false); onTickChange(maxTick); }} className="timeline-btn" title="Jump to end">⏭</button>
          <div className="timeline-speed">
            <label htmlFor="speed">Speed:</label>
            <select id="speed" value={playSpeed} onChange={e => setPlaySpeed(Number(e.target.value))} className="timeline-speed-select">
              <option value={1}>1x</option><option value={2}>2x</option><option value={5}>5x</option><option value={10}>10x</option>
            </select>
          </div>
        </div>
        <TimelineEventsTicker currentEvents={currentEvents} currentTick={currentTick} />
      </>}
      {selectedEraNarrative && <EraNarrative lore={selectedEraNarrative} onClose={clearEraNarrative} />}
      {selectedEraTransition && <EraTransitionModal transition={selectedEraTransition} onClose={clearEraTransition} />}
      {selectedDiscovery && <DiscoveryStory lore={selectedDiscovery} onExplorerClick={NOOP} onClose={clearDiscovery} isModal={true} />}
    </div>
  );
}

// Helper function to get icon for event type
function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    creation_batch: "🌱",
    alliance_formed: "🤝",
    state_change: "🔄",
    downfall: "📉",
    rivalry_formed: "⚔️",
    war_started: "🔥",
    war_ended: "🕊️",
    betrayal: "🗡️",
    reconciliation: "💙",
    triumph: "🏆",
    relationship_formed: "🔗",
    tag_gained: "🏷️",
    tag_lost: "❌"
  };
  return icons[eventType] || "📋";
}
