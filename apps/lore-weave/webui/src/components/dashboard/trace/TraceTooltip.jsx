/**
 * TraceTooltip - Custom tooltip for the trace visualization
 */

import React from 'react';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';

const TOOLTIP_STYLE = Object.freeze({
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '6px',
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
});

/**
 * Tooltip hook and component for trace visualization
 */
export function useTraceTooltip() {
  return useTooltip();
}

/**
 * Simple tooltip component
 */
export default function TraceTooltip({
  tooltipData,
  tooltipLeft,
  tooltipTop,
  tooltipOpen,
}) {
  if (!tooltipOpen || !tooltipData) return null;

  return (
    <TooltipWithBounds
      left={tooltipLeft}
      top={tooltipTop}
      style={TOOLTIP_STYLE}
    >
      {tooltipData.type === 'tick' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Tick {tooltipData.tick}
          </div>
          {tooltipData.pressures?.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ color: p.color }}>{p.name}</span>
              <span>{p.value?.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      {tooltipData.type === 'event' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {tooltipData.eventType === 'template' && '▲ '}
            {tooltipData.eventType === 'system' && '◆ '}
            {tooltipData.eventType === 'action' && '● '}
            {tooltipData.label}
          </div>
          <div style={{ color: '#94a3b8' }}>
            Tick {tooltipData.tick}
          </div>
        </div>
      )}
    </TooltipWithBounds>
  );
}
