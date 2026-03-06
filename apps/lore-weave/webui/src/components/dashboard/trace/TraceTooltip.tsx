/**
 * TraceTooltip - Custom tooltip for the trace visualization
 */

import React from "react";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import "./TraceTooltip.css";

interface PressurePoint {
  name: string;
  color: string;
  value: number;
}

type TooltipData =
  | { type: "tick"; tick: number; pressures: PressurePoint[] }
  | { type: "event"; tick: number; eventType: string; label: string };

/**
 * Tooltip hook and component for trace visualization
 */
export function useTraceTooltip() {
  return useTooltip<TooltipData>();
}

interface TraceTooltipProps {
  tooltipData: TooltipData | null;
  tooltipLeft: number;
  tooltipTop: number;
  tooltipOpen: boolean;
}

export default function TraceTooltip({ tooltipData, tooltipLeft, tooltipTop, tooltipOpen }: Readonly<TraceTooltipProps>) {
  if (!tooltipOpen || !tooltipData) return null;

  return (
    <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="tt-tooltip">
      {tooltipData.type === "tick" && (
        <div>
          <div className="tt-tick-header">Tick {tooltipData.tick}</div>
          {tooltipData.pressures?.map((p, i) => (
            <div key={i} className="tt-pressure-row">
              <span className="tt-pressure-name" style={{ '--tt-pressure-color': p.color } as React.CSSProperties}>{p.name}</span>
              <span>{p.value?.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      {tooltipData.type === "event" && (
        <div>
          <div className="tt-event-header">
            {tooltipData.eventType === "template" && "▲ "}
            {tooltipData.eventType === "system" && "◆ "}
            {tooltipData.eventType === "action" && "● "}
            {tooltipData.label}
          </div>
          <div className="tt-event-tick">Tick {tooltipData.tick}</div>
        </div>
      )}
    </TooltipWithBounds>
  );
}
