/**
 * Shared color palettes and constants for trace visualization.
 *
 * Extracted from SimulationTraceVisx so that sibling modules
 * (PressureChart, EventSwimlanes) can import them without pulling
 * in React component code, which also fixes the
 * react-refresh/only-export-components warning.
 */

export const PRESSURE_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export const EVENT_COLORS: Record<string, string> = {
  template: "#22c55e",
  system: "#8b5cf6",
  action: "#f59e0b",
};

/** Entity kind color palette - deterministic colors based on kind string hash */
const ENTITY_KIND_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // purple
  "#eab308", // yellow
];

export const ERA_COLORS = [
  "rgba(59, 130, 246, 0.15)",
  "rgba(168, 85, 247, 0.15)",
  "rgba(236, 72, 153, 0.15)",
  "rgba(34, 197, 94, 0.15)",
  "rgba(249, 115, 22, 0.15)",
];

/** Visible tick window for the scrolling chart */
export const VISIBLE_TICKS = 45;

/** Simple hash function for consistent color assignment */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Get color for an entity kind (deterministic) */
export function getEntityKindColor(kind: string | null | undefined): string {
  if (!kind) return ENTITY_KIND_COLORS[0];
  const index = hashString(kind) % ENTITY_KIND_COLORS.length;
  return ENTITY_KIND_COLORS[index];
}
