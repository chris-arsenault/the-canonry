import type { HardState } from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import { getEntityCoords } from "./coordinateMapDrawing.ts";

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchored: boolean;
  entity: HardState;
}

function applyAttraction(
  relationships: Array<{ src: string; dst: string; strength: Optional<number> }>,
  nodeMap: Map<string, LayoutNode>
): void {
  for (const rel of relationships) {
    const src = nodeMap.get(rel.src);
    const dst = nodeMap.get(rel.dst);
    if (!src || !dst) continue;
    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const strength = (rel.strength ?? 0.5) * 0.1;
    if (!src.anchored) { src.vx += (dx / dist) * strength; src.vy += (dy / dist) * strength; }
    if (!dst.anchored) { dst.vx -= (dx / dist) * strength; dst.vy -= (dy / dist) * strength; }
  }
}

function applyRepulsion(nodes: LayoutNode[]): void {
  for (const a of nodes) {
    if (a.anchored) continue;
    for (const b of nodes) {
      if (a.id === b.id) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 10) {
        const force = 0.5 / dist;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
      }
    }
  }
}

export function runForceLayout(
  nodes: LayoutNode[],
  relationships: Array<{ src: string; dst: string; strength: Optional<number> }>,
  iterations: number = 50
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < iterations; i++) {
    for (const n of nodes) { if (!n.anchored) { n.vx = 0; n.vy = 0; } }
    applyAttraction(relationships, nodeMap);
    applyRepulsion(nodes);
    for (const n of nodes) {
      if (!n.anchored) {
        n.x = Math.max(0, Math.min(100, n.x + n.vx));
        n.y = Math.max(0, Math.min(100, n.y + n.vy));
      }
    }
  }
}

export function buildLayoutNodes(mapEntities: HardState[], effectiveMapKind: string): LayoutNode[] {
  return mapEntities.map((entity) => {
    const coords = getEntityCoords(entity);
    return { id: entity.id, x: coords.x, y: coords.y, vx: 0, vy: 0, anchored: entity.kind === effectiveMapKind, entity };
  });
}
