/**
 * SemanticPlane types - Shared type definitions for semantic plane components.
 */

import type { Optional } from "@the-canonry/shared-components";

export interface Point {
  x: number;
  y: number;
  z: Optional<number>;
}

export interface Culture {
  id: string;
  name: string;
  color: Optional<string>;
}

export interface TagEntry {
  tag: string;
  category: string;
  rarity: string;
  description: Optional<string>;
  isAxis: Optional<boolean>;
}

export interface RegionBounds {
  shape: string;
  center: Point;
  radius: number;
}

export interface Region {
  id: string;
  label: string;
  color: string;
  culture: string | null;
  tags: string[];
  bounds: RegionBounds;
}

export interface AxisConfig {
  axisId: Optional<string>;
}

export interface SemanticPlaneData {
  axes: Record<string, AxisConfig>;
  regions: Region[];
}

export interface AxisDefinition {
  id: string;
  name: string;
  lowTag: string;
  highTag: string;
}

export interface ResolvedAxis {
  axisId: string;
  name: string;
  lowTag: string;
  highTag: string;
}

export interface EntityKind {
  kind: string;
  description: Optional<string>;
  isFramework: Optional<boolean>;
  semanticPlane: Optional<SemanticPlaneData>;
}

export interface SeedEntity {
  id: string;
  kind: string;
  name: string;
  culture: string;
  coordinates: Optional<Point>;
}

export interface Project {
  entityKinds: Optional<EntityKind[]>;
  cultures: Optional<Culture[]>;
  tagRegistry: Optional<TagEntry[]>;
  seedEntities: Optional<SeedEntity[]>;
}

export interface NewRegionForm {
  label: string;
  x: number;
  y: number;
  radius: number;
  culture: string;
  tags: string[];
}

export interface EditingAxis {
  key: string;
  axisId: string;
  name: string;
  lowTag: string;
  highTag: string;
}

export interface EditingRegion {
  id: string;
  label: string;
  culture: string | null;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMPTY_PLANE: SemanticPlaneData = { axes: {}, regions: [] };
export const EMPTY_NEW_REGION: NewRegionForm = { label: "", x: 50, y: 50, radius: 15, culture: "", tags: [] };
export const AXIS_KEYS = ["x", "y", "z"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveAxis(
  axisConfig: AxisConfig | undefined,
  axisDefinitions: AxisDefinition[],
): ResolvedAxis | null {
  if (!axisConfig?.axisId) return null;
  const registeredAxis = axisDefinitions.find((a) => a.id === axisConfig.axisId);
  if (!registeredAxis) return null;
  return {
    axisId: registeredAxis.id,
    name: registeredAxis.name,
    lowTag: registeredAxis.lowTag,
    highTag: registeredAxis.highTag,
  };
}
