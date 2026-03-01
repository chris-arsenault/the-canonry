/**
 * System visualization panels - Diffusion and Contagion sub-panels
 * with selector dropdowns and tick sliders.
 */

import React, { useCallback } from "react";
import { SystemActivityPanel, PlaneDiffusionVis, GraphContagionVis } from "../systems";
import type { SystemActionRecord, SystemIdName } from "./traceTypes";

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

function VisEmpty({ icon, label, hint }: { icon: string; label: string; hint: string }) {
  return (
    <div className="vis-empty">
      <div className="vis-empty-icon">{icon}</div>
      <div>{label}</div>
      <div className="st-empty-hint">{hint}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tick slider
// ---------------------------------------------------------------------------

interface TickSliderProps {
  lockedTick: number | null;
  maxTick: number;
  availableVisTicks: number[];
  onTickChange: (tick: number) => void;
}

function TickSlider({ lockedTick, maxTick, availableVisTicks, onTickChange }: TickSliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onTickChange(parseInt(e.target.value, 10)),
    [onTickChange]
  );

  return (
    <div className="lw-trace-view-tick-slider">
      <span className="lw-trace-view-tick-label">Tick {lockedTick ?? 0}</span>
      <input
        type="range"
        min={0}
        max={maxTick}
        value={lockedTick ?? 0}
        onChange={handleChange}
        className="lw-trace-view-slider"
      />
      <span className="lw-trace-view-tick-label">/ {maxTick}</span>
      {availableVisTicks.length > 0 && (
        <span className="lw-trace-view-tick-count">
          ({availableVisTicks.length} snapshots)
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// System selector
// ---------------------------------------------------------------------------

interface SystemSelectorProps {
  systems: SystemIdName[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function SystemSelector({ systems, activeId, onSelect }: SystemSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onSelect(e.target.value),
    [onSelect]
  );

  if (systems.length <= 1) return null;

  return (
    <select
      className="lw-trace-view-system-select"
      value={activeId ?? ""}
      onChange={handleChange}
    >
      {systems.map((sys) => (
        <option key={sys.id} value={sys.id}>
          {sys.name || sys.id}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Activity panel
// ---------------------------------------------------------------------------

interface ActivityPanelWrapperProps {
  systemActions: SystemActionRecord[];
}

export function ActivityPanelWrapper({ systemActions }: ActivityPanelWrapperProps) {
  return (
    <div className="lw-trace-view-system-activity">
      <SystemActivityPanel systemActions={systemActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diffusion panel
// ---------------------------------------------------------------------------

interface DiffusionPanelProps {
  diffusionSystems: SystemIdName[];
  activeDiffusionId: string | null;
  onSelectDiffusion: (id: string) => void;
  diffusionConfig: { name: string | undefined };
  systemActions: SystemActionRecord[];
  lockedTick: number | null;
  selectedTick: number | null;
  maxTick: number;
  availableVisTicks: number[];
  onTickChange: (tick: number) => void;
  autoScaleColors: boolean;
  onAutoScaleChange: (value: boolean) => void;
}

export function DiffusionPanel({
  diffusionSystems,
  activeDiffusionId,
  onSelectDiffusion,
  diffusionConfig,
  systemActions,
  lockedTick,
  selectedTick,
  maxTick,
  availableVisTicks,
  onTickChange,
  autoScaleColors,
  onAutoScaleChange,
}: DiffusionPanelProps) {
  const handleCheckbox = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onAutoScaleChange(e.target.checked),
    [onAutoScaleChange]
  );

  return (
    <div className="lw-trace-view-system-vis">
      {diffusionSystems.length === 0 ? (
        <VisEmpty
          icon="&#9783;"
          label="No diffusion data"
          hint="Enable a planeDiffusion system and run simulation"
        />
      ) : (
        <>
          <div className="lw-trace-view-system-controls">
            <SystemSelector
              systems={diffusionSystems}
              activeId={activeDiffusionId}
              onSelect={onSelectDiffusion}
            />
            <TickSlider
              lockedTick={lockedTick}
              maxTick={maxTick}
              availableVisTicks={availableVisTicks}
              onTickChange={onTickChange}
            />
            <label className="lw-trace-view-checkbox-label">
              <input
                type="checkbox"
                checked={autoScaleColors}
                onChange={handleCheckbox}
              />
              Log scale
            </label>
          </div>
          <PlaneDiffusionVis
            config={diffusionConfig}
            systemActions={systemActions.filter((a) => a.systemId === activeDiffusionId)}
            selectedTick={lockedTick ?? selectedTick}
            autoScaleColors={autoScaleColors}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contagion panel
// ---------------------------------------------------------------------------

interface ContagionPanelProps {
  contagionSystems: SystemIdName[];
  activeContagionId: string | null;
  onSelectContagion: (id: string) => void;
  contagionConfig: { name: string | undefined };
  systemActions: SystemActionRecord[];
  lockedTick: number | null;
  selectedTick: number | null;
  maxTick: number;
  availableVisTicks: number[];
  onTickChange: (tick: number) => void;
}

export function ContagionPanel({
  contagionSystems,
  activeContagionId,
  onSelectContagion,
  contagionConfig,
  systemActions,
  lockedTick,
  selectedTick,
  maxTick,
  availableVisTicks,
  onTickChange,
}: ContagionPanelProps) {
  return (
    <div className="lw-trace-view-system-vis">
      {contagionSystems.length === 0 ? (
        <VisEmpty
          icon="&#9673;"
          label="No contagion data"
          hint="Enable a graphContagion system and run simulation"
        />
      ) : (
        <>
          <div className="lw-trace-view-system-controls">
            <SystemSelector
              systems={contagionSystems}
              activeId={activeContagionId}
              onSelect={onSelectContagion}
            />
            <TickSlider
              lockedTick={lockedTick}
              maxTick={maxTick}
              availableVisTicks={availableVisTicks}
              onTickChange={onTickChange}
            />
          </div>
          <GraphContagionVis
            config={contagionConfig}
            systemActions={systemActions.filter((a) => a.systemId === activeContagionId)}
            selectedTick={lockedTick ?? selectedTick}
          />
        </>
      )}
    </div>
  );
}
