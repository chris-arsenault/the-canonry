import { useMemo } from "react";
import type { WorldState } from "../types/world.ts";
import type { ProminenceScale } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";
import { getKindColor, prominenceToNumber } from "./dataTransform.ts";

export type EdgeMetric = "strength" | "distance" | "none";

/** Minimal typing for the d3 link force returned by ForceGraph */
export interface D3LinkForce {
  distance(fn: (link: GraphLink) => number): D3LinkForce;
  strength(fn: (link: GraphLink) => number): D3LinkForce;
  stop: Optional<() => void>;
}

/** Minimal typing for the imperative handle exposed by react-force-graph-3d */
export interface ForceGraphInstance {
  camera(): import("three").Camera;
  pauseAnimation: Optional<() => void>;
  d3Force(name: string): D3LinkForce | undefined;
  d3Force(name: string, force: ((alpha: number) => void) | null): void;
  d3ReheatSimulation(): void;
}

export interface TimelineView3DProps {
  data: WorldState;
  selectedNodeId: Optional<string>;
  onNodeSelect: (nodeId: string | undefined) => void;
  showCatalyzedBy: Optional<boolean>;
  edgeMetric: Optional<EdgeMetric>;
  prominenceScale: ProminenceScale;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  prominence: number;
  color: string;
  val: number;
  createdAt: number;
  fx: Optional<number>;
  fy: Optional<number>;
  fz: Optional<number>;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: string;
  strength: number;
  distance: Optional<number>;
  catalyzed: Optional<boolean>;
  isCreatedDuring: Optional<boolean>;
}

/** Extended graph node with simulation-mutated fields */
export interface SimulationNode extends GraphNode {
  x: Optional<number>;
  y: Optional<number>;
  vx: Optional<number>;
  vy: Optional<number>;
  _targetX: Optional<number>;
}

// Era spacing along X-axis
export const ERA_SPACING = 200;
export const ERA_Y_POSITION = 0;
export const ERA_Z_POSITION = 0;
export const ERA_RELATIONSHIP_KINDS = ["active_during", "created_during"];

export function useEraLayout(hardState: WorldState["hardState"], relationships: WorldState["relationships"]) {
  return useMemo(() => {
    const eras = hardState.filter((e) => e.kind === "era").sort((a, b) => a.createdAt - b.createdAt);
    const positions = new Map<string, number>();
    eras.forEach((era, index) => {
      const centerOffset = ((eras.length - 1) * ERA_SPACING) / 2;
      positions.set(era.id, index * ERA_SPACING - centerOffset);
    });

    const entityToEra = new Map<string, string>();
    const firstEraId = eras.length > 0 ? eras[0].id : null;

    hardState.forEach((entity) => {
      if (entity.kind !== "era" && entity.eraId) {
        entityToEra.set(entity.id, entity.eraId);
      }
    });
    relationships.forEach((rel) => {
      if (rel.kind === "created_during" && !entityToEra.has(rel.src) && positions.has(rel.dst)) {
        entityToEra.set(rel.src, rel.dst);
      }
    });
    hardState.forEach((entity) => {
      if (entity.kind !== "era" && !entityToEra.has(entity.id) && firstEraId) {
        entityToEra.set(entity.id, firstEraId);
      }
    });

    return { eraPositions: positions, entityEraMap: entityToEra };
  }, [hardState, relationships]);
}

export function useTimelineGraphData(
  data: WorldState, showCatalyzedBy: boolean,
  eraPositions: Map<string, number>, entityEraMap: Map<string, string>,
  prominenceScale: ProminenceScale
) {
  return useMemo(() => {
    const nodes: GraphNode[] = data.hardState.map((entity) => {
      const isEra = entity.kind === "era";
      let eraX: number | undefined;
      if (isEra) { eraX = eraPositions.get(entity.id); }
      else {
        const entityEraId = entityEraMap.get(entity.id);
        if (entityEraId) { eraX = eraPositions.get(entityEraId); }
      }
      return {
        id: entity.id, name: entity.name, kind: entity.kind,
        prominence: prominenceToNumber(entity.prominence, data.schema, prominenceScale),
        color: isEra ? "#FFD700" : getKindColor(entity.kind, data.schema),
        val: isEra ? 6 : prominenceToNumber(entity.prominence, data.schema, prominenceScale) + 1,
        createdAt: entity.createdAt,
        fx: isEra ? eraX : undefined, fy: isEra ? ERA_Y_POSITION : undefined, fz: isEra ? ERA_Z_POSITION : undefined,
        _targetX: isEra ? undefined : eraX,
      } as SimulationNode;
    });

    const links: GraphLink[] = data.relationships.map((rel) => ({
      source: rel.src, target: rel.dst, kind: rel.kind,
      strength: rel.strength ?? 0.5, distance: rel.distance,
      catalyzed: showCatalyzedBy && !!rel.catalyzedBy,
      isCreatedDuring: ERA_RELATIONSHIP_KINDS.includes(rel.kind),
    }));

    return { nodes, links };
  }, [data, showCatalyzedBy, eraPositions, entityEraMap, prominenceScale]);
}

export function useTimelineLegend(schema: WorldState["schema"]) {
  return useMemo(() => {
    return schema.entityKinds
      .filter((kind) => kind.kind !== "era")
      .map((kind) => ({
        kind: kind.kind,
        label: kind.style?.displayName || kind.description || kind.kind,
        color: getKindColor(kind.kind, schema),
      }));
  }, [schema]);
}
