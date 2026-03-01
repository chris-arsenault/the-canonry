/**
 * SimulationTraceVisx - Full-screen trace visualization using visx
 *
 * Replaces Recharts-based SimulationTraceView with more flexible visx primitives.
 * Features:
 * - Multi-line pressure chart
 * - Stacked template markers at tick + 0.5
 * - Era timeline with transition markers
 * - Interactive tooltips and selection
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ParentSize } from "@visx/responsive";
import "./SimulationTraceVisx.css";
import { PRESSURE_COLORS } from "./traceConstants";
import { transformPressureData, transformEventData, extractEraBoundaries } from "./traceDataTransforms";
import TraceVisualization from "./TraceVisualization";
import DetailPanel from "./DetailPanel";
import TemplateDetailPanel from "./TemplateDetailPanel";
import SystemActionDetailPanel from "./SystemActionDetailPanel";
import ActionDetailPanel from "./ActionDetailPanel";
import { ActivityPanelWrapper, DiffusionPanel, ContagionPanel } from "./SystemVisPanels";
import type {
  PressureUpdate,
  EpochStat,
  TemplateApplication,
  ActionApplication,
  SystemActionRecord,
  SelectedEvent,
  SystemIdName,
} from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimulationTraceVisxProps {
  pressureUpdates?: PressureUpdate[];
  epochStats?: EpochStat[];
  templateApplications?: TemplateApplication[];
  actionApplications?: ActionApplication[];
  systemActions?: SystemActionRecord[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// System panel type
// ---------------------------------------------------------------------------

type SystemPanelMode = null | "activity" | "plane-diffusion" | "graph-contagion";

// ---------------------------------------------------------------------------
// Hooks extracted for readability
// ---------------------------------------------------------------------------

function useSystemsWithData(systemActions: SystemActionRecord[]) {
  const diffusionSystemsWithData = useMemo<SystemIdName[]>(() => {
    const map = new Map<string, SystemIdName>();
    for (const action of systemActions) {
      if (action.details?.diffusionSnapshot && !map.has(action.systemId)) {
        map.set(action.systemId, { id: action.systemId, name: action.systemName });
      }
    }
    return Array.from(map.values());
  }, [systemActions]);

  const contagionSystemsWithData = useMemo<SystemIdName[]>(() => {
    const map = new Map<string, SystemIdName>();
    for (const action of systemActions) {
      if (action.details?.contagionSnapshot && !map.has(action.systemId)) {
        map.set(action.systemId, { id: action.systemId, name: action.systemName });
      }
    }
    return Array.from(map.values());
  }, [systemActions]);

  return { diffusionSystemsWithData, contagionSystemsWithData };
}

function useAvailableVisTicks(
  systemPanel: SystemPanelMode,
  activeDiffusionId: string | null,
  activeContagionId: string | null,
  systemActions: SystemActionRecord[]
): number[] {
  return useMemo(() => {
    if (systemPanel === "plane-diffusion" && activeDiffusionId) {
      return [...new Set(
        systemActions
          .filter((a) => a.systemId === activeDiffusionId && a.details?.diffusionSnapshot)
          .map((a) => a.tick)
      )].sort((a, b) => a - b);
    }
    if (systemPanel === "graph-contagion" && activeContagionId) {
      return [...new Set(
        systemActions
          .filter((a) => a.systemId === activeContagionId && a.details?.contagionSnapshot)
          .map((a) => a.tick)
      )].sort((a, b) => a - b);
    }
    return [];
  }, [systemPanel, activeDiffusionId, activeContagionId, systemActions]);
}

// ---------------------------------------------------------------------------
// Header sub-component
// ---------------------------------------------------------------------------

interface HeaderProps {
  pressureCount: number;
  tickCount: number;
  templateCount: number;
  actionCount: number;
  eraTransitionCount: number;
  systemPanel: SystemPanelMode;
  onSystemPanelChange: (panel: SystemPanelMode) => void;
  diffusionCount: number;
  diffusionNames: string;
  contagionCount: number;
  contagionNames: string;
  onClose: () => void;
}

function Header({
  pressureCount, tickCount, templateCount, actionCount, eraTransitionCount,
  systemPanel, onSystemPanelChange,
  diffusionCount, diffusionNames, contagionCount, contagionNames,
  onClose,
}: HeaderProps) {
  return (
    <div className="lw-trace-view-header">
      <div className="lw-trace-view-title">
        Simulation Trace
        <span className="lw-trace-view-subtitle">
          {tickCount} ticks / {pressureCount} pressures / {templateCount} templates / {actionCount} actions / {eraTransitionCount} era transitions
        </span>
      </div>
      <div className="lw-trace-view-header-actions">
        <button
          className={`lw-trace-view-panel-toggle ${systemPanel === "activity" ? "active" : ""}`}
          onClick={() => onSystemPanelChange(systemPanel === "activity" ? null : "activity")}
        >
          Activity
        </button>
        <button
          className={`lw-trace-view-panel-toggle ${systemPanel === "plane-diffusion" ? "active" : ""} ${diffusionCount > 0 ? "has-data" : ""}`}
          onClick={() => onSystemPanelChange(systemPanel === "plane-diffusion" ? null : "plane-diffusion")}
          title={diffusionCount > 0 ? `${diffusionCount} system(s): ${diffusionNames}` : "No diffusion systems ran"}
        >
          Diffusion{diffusionCount > 0 && ` (${diffusionCount})`}
        </button>
        <button
          className={`lw-trace-view-panel-toggle ${systemPanel === "graph-contagion" ? "active" : ""} ${contagionCount > 0 ? "has-data" : ""}`}
          onClick={() => onSystemPanelChange(systemPanel === "graph-contagion" ? null : "graph-contagion")}
          title={contagionCount > 0 ? `${contagionCount} system(s): ${contagionNames}` : "No contagion systems ran"}
        >
          Contagion{contagionCount > 0 && ` (${contagionCount})`}
        </button>
        <button className="lw-trace-view-close" onClick={onClose}>x</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pressure toggle bar
// ---------------------------------------------------------------------------

interface PressureTogglesProps {
  pressureIds: string[];
  pressureData: Array<Record<string, unknown>>;
  hiddenPressures: Set<string>;
  onToggle: (id: string) => void;
}

function PressureToggles({ pressureIds, pressureData, hiddenPressures, onToggle }: PressureTogglesProps) {
  return (
    <div className="lw-trace-view-pressure-toggles">
      {pressureIds.map((id, i) => {
        const name = (pressureData[0]?.[`${id}_name`] as string) ?? id;
        const isHidden = hiddenPressures.has(id);
        return (
          <button
            key={id}
            className={`lw-trace-view-toggle ${isHidden ? "hidden" : ""}`}
            style={{
              "--st-toggle-border": PRESSURE_COLORS[i % PRESSURE_COLORS.length],
              "--st-toggle-bg": isHidden
                ? "transparent"
                : PRESSURE_COLORS[i % PRESSURE_COLORS.length] + "20",
            } as React.CSSProperties}
            onClick={() => onToggle(id)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SimulationTraceVisx({
  pressureUpdates = [],
  epochStats = [],
  templateApplications = [],
  actionApplications = [],
  systemActions = [],
  onClose,
}: SimulationTraceVisxProps) {
  // State
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [lockedTick, setLockedTick] = useState<number | null>(null);
  const [hiddenPressures, setHiddenPressures] = useState<Set<string>>(new Set());
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState<number | null>(null);
  const [systemPanel, setSystemPanel] = useState<SystemPanelMode>(null);
  const [selectedDiffusionId, setSelectedDiffusionId] = useState<string | null>(null);
  const [selectedContagionId, setSelectedContagionId] = useState<string | null>(null);
  const [autoScaleColors, setAutoScaleColors] = useState(false);

  // Derived system data
  const { diffusionSystemsWithData, contagionSystemsWithData } = useSystemsWithData(systemActions);
  const activeDiffusionId = selectedDiffusionId ?? diffusionSystemsWithData[0]?.id ?? null;
  const activeContagionId = selectedContagionId ?? contagionSystemsWithData[0]?.id ?? null;

  const diffusionConfig = useMemo(
    () => ({ name: diffusionSystemsWithData.find((s) => s.id === activeDiffusionId)?.name }),
    [diffusionSystemsWithData, activeDiffusionId]
  );
  const contagionConfig = useMemo(
    () => ({ name: contagionSystemsWithData.find((s) => s.id === activeContagionId)?.name }),
    [contagionSystemsWithData, activeContagionId]
  );

  // Transform data
  const { data: pressureData, pressureIds, breakdownsByTick } = useMemo(
    () => transformPressureData(pressureUpdates),
    [pressureUpdates]
  );

  const eventData = useMemo(
    () => transformEventData(templateApplications, actionApplications, systemActions),
    [templateApplications, actionApplications, systemActions]
  );

  const eraBoundaries = useMemo(
    () => extractEraBoundaries(pressureUpdates, epochStats, systemActions),
    [pressureUpdates, epochStats, systemActions]
  );

  // Selected event for detail panel
  const selectedEvent = useMemo<SelectedEvent | null>(() => {
    const eventId = selectedEventId ?? hoveredEventId;
    if (!eventId) return null;

    const templateEvent = eventData.template.find((e) => e.uniqueId === eventId);
    if (templateEvent) return { type: "template", data: templateEvent.data };

    const actionEvent = eventData.action.find((e) => e.uniqueId === eventId);
    if (actionEvent) return { type: "action", data: actionEvent.data };

    const systemEvent = eventData.system.find((e) => e.uniqueId === eventId);
    if (systemEvent) return { type: "system", data: systemEvent.data, isEraTransition: systemEvent.isEraTransition };

    return null;
  }, [eventData, selectedEventId, hoveredEventId]);

  // Counts for header
  const eraTransitionCount = useMemo(
    () => eventData.system.filter((e) => e.isEraTransition).length,
    [eventData]
  );

  const maxTick = useMemo(() => {
    const pressureMax = pressureData.length > 0 ? Math.max(...pressureData.map((d) => d.tick)) : 0;
    const systemMax = systemActions.length > 0 ? Math.max(...systemActions.map((a) => a.tick)) : 0;
    return Math.max(pressureMax, systemMax, 1);
  }, [pressureData, systemActions]);

  const availableVisTicks = useAvailableVisTicks(
    systemPanel, activeDiffusionId, activeContagionId, systemActions
  );

  // Initialize lockedTick when opening a vis panel
  useEffect(() => {
    if ((systemPanel === "plane-diffusion" || systemPanel === "graph-contagion") && lockedTick === null) {
      setLockedTick(maxTick);
    }
  }, [systemPanel, maxTick, lockedTick]);

  // Handlers
  const handleTickHover = useCallback((tick: number) => setSelectedTick(tick), []);

  const handleTickClick = useCallback(
    (tick: number) => {
      if (lockedTick === tick) { setLockedTick(null); }
      else { setLockedTick(tick); setSelectedTick(tick); }
    },
    [lockedTick]
  );

  const handleEventHover = useCallback(
    (eventId: string | null) => { if (!selectedEventId) setHoveredEventId(eventId); },
    [selectedEventId]
  );

  const handleEventClick = useCallback(
    (eventId: string) => setSelectedEventId((prev) => (prev === eventId ? null : eventId)),
    []
  );

  const handleUnlock = useCallback(() => setLockedTick(null), []);

  const handleClearEvent = useCallback(() => {
    setSelectedEventId(null);
    setHoveredEventId(null);
  }, []);

  const togglePressure = useCallback((id: string) => {
    setHiddenPressures((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Detail panel selection
  const detailPanel = useMemo(() => {
    if (selectedEvent?.type === "template") {
      return (
        <TemplateDetailPanel
          template={selectedEvent.data as TemplateApplication}
          isLocked={!!selectedEventId}
          onClear={handleClearEvent}
        />
      );
    }
    if (selectedEvent?.type === "action") {
      return (
        <ActionDetailPanel
          actionApplication={selectedEvent.data as ActionApplication}
          isLocked={!!selectedEventId}
          onClear={handleClearEvent}
        />
      );
    }
    if (selectedEvent?.type === "system") {
      return (
        <SystemActionDetailPanel
          systemAction={selectedEvent.data as SystemActionRecord}
          isEraTransition={selectedEvent.isEraTransition ?? false}
          isLocked={!!selectedEventId}
          onClear={handleClearEvent}
        />
      );
    }
    return (
      <DetailPanel
        selectedTick={selectedTick}
        lockedTick={lockedTick}
        breakdownsByTick={breakdownsByTick}
        pressureIds={pressureIds}
        onUnlock={handleUnlock}
      />
    );
  }, [
    selectedEvent, selectedEventId, handleClearEvent,
    selectedTick, lockedTick, breakdownsByTick, pressureIds, handleUnlock,
  ]);

  return (
    <div className="lw-trace-view-overlay">
      <div className="lw-trace-view">
        <Header
          pressureCount={pressureIds.length}
          tickCount={pressureData.length}
          templateCount={eventData.template.length}
          actionCount={eventData.action.length}
          eraTransitionCount={eraTransitionCount}
          systemPanel={systemPanel}
          onSystemPanelChange={setSystemPanel}
          diffusionCount={diffusionSystemsWithData.length}
          diffusionNames={diffusionSystemsWithData.map((s) => s.name).join(", ")}
          contagionCount={contagionSystemsWithData.length}
          contagionNames={contagionSystemsWithData.map((s) => s.name).join(", ")}
          onClose={onClose}
        />

        <div className="lw-trace-view-content">
          <div className="lw-trace-view-charts">
            <PressureToggles
              pressureIds={pressureIds}
              pressureData={pressureData}
              hiddenPressures={hiddenPressures}
              onToggle={togglePressure}
            />

            <div className={`lw-trace-view-chart-area ${lockedTick !== null ? "locked" : ""}`}>
              <ParentSize>
                {({ width, height }: { width: number; height: number }) => (
                  <TraceVisualization
                    width={width}
                    height={height}
                    pressureData={pressureData}
                    pressureIds={pressureIds}
                    eventData={eventData}
                    eraBoundaries={eraBoundaries}
                    hiddenPressures={hiddenPressures}
                    interaction={{
                      selectedTick,
                      lockedTick,
                      hoveredEventId,
                      selectedEventId,
                      scrollOffset,
                    }}
                    callbacks={{
                      onTickHover: handleTickHover,
                      onTickClick: handleTickClick,
                      onEventHover: handleEventHover,
                      onEventClick: handleEventClick,
                      onScrollChange: setScrollOffset,
                    }}
                  />
                )}
              </ParentSize>
            </div>

            {systemPanel === "activity" && (
              <ActivityPanelWrapper systemActions={systemActions} />
            )}
            {systemPanel === "plane-diffusion" && (
              <DiffusionPanel
                diffusionSystems={diffusionSystemsWithData}
                activeDiffusionId={activeDiffusionId}
                onSelectDiffusion={setSelectedDiffusionId}
                diffusionConfig={diffusionConfig}
                systemActions={systemActions}
                lockedTick={lockedTick}
                selectedTick={selectedTick}
                maxTick={maxTick}
                availableVisTicks={availableVisTicks}
                onTickChange={setLockedTick}
                autoScaleColors={autoScaleColors}
                onAutoScaleChange={setAutoScaleColors}
              />
            )}
            {systemPanel === "graph-contagion" && (
              <ContagionPanel
                contagionSystems={contagionSystemsWithData}
                activeContagionId={activeContagionId}
                onSelectContagion={setSelectedContagionId}
                contagionConfig={contagionConfig}
                systemActions={systemActions}
                lockedTick={lockedTick}
                selectedTick={selectedTick}
                maxTick={maxTick}
                availableVisTicks={availableVisTicks}
                onTickChange={setLockedTick}
              />
            )}
          </div>

          {detailPanel}
        </div>
      </div>
    </div>
  );
}
