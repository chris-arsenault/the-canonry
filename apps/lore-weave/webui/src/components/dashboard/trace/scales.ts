/**
 * Shared scale creators for the simulation trace visualization
 */

import { scaleLinear } from "@visx/scale";

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TickDataPoint {
  tick: number;
}

/**
 * Create X scale for tick values
 */
export function createXScale(data: TickDataPoint[], width: number, margin: Margin) {
  if (!data?.length) {
    return scaleLinear({
      domain: [0, 100],
      range: [margin.left, width - margin.right],
    });
  }

  const ticks = data.map((d) => d.tick);
  return scaleLinear({
    domain: [Math.min(...ticks), Math.max(...ticks)],
    range: [margin.left, width - margin.right],
  });
}

/**
 * Create Y scale for pressure values
 *
 * Note: `chartBottom` is the y-coordinate of the bottom of the chart area.
 * This is NOT height - margin.bottom; the caller passes the actual bottom coordinate.
 */
export function createPressureYScale(_data: TickDataPoint[], _pressureIds: string[], chartBottom: number, margin: Margin) {
  return scaleLinear({
    domain: [-100, 100],
    range: [chartBottom, margin.top],
    nice: true,
  });
}

/**
 * Default margins
 */
export const DEFAULT_MARGIN: Margin = {
  top: 20,
  right: 30,
  bottom: 80, // Extra space for swimlanes and era timeline
  left: 50,
};

/**
 * Swimlane configuration
 */
export const SWIMLANE_CONFIG = {
  height: 24,
  gap: 2,
  types: ["template", "system", "action"] as const,
};

/**
 * Era timeline configuration
 */
export const ERA_TIMELINE_HEIGHT = 36;
