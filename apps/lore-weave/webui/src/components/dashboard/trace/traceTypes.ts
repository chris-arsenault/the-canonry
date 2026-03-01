/**
 * TypeScript interfaces for trace visualization data structures.
 */

// ---------------------------------------------------------------------------
// Raw input data (from simulation engine)
// ---------------------------------------------------------------------------

export interface PressureBreakdown {
  positiveFeedback?: Array<{ label: string; contribution: number }>;
  negativeFeedback?: Array<{ label: string; contribution: number }>;
  homeostasis: number;
  homeostaticDelta: number;
  eraModifier?: number;
  growthScaling?: number;
  smoothedDelta: number;
}

export interface PressureEntry {
  id: string;
  name: string;
  newValue: number;
  previousValue: number;
  breakdown?: PressureBreakdown;
}

export interface DiscreteMod {
  pressureId: string;
  delta: number;
  source?: {
    type?: string;
    templateId?: string;
    systemId?: string;
    actionId?: string;
  };
}

export interface PressureUpdate {
  tick: number;
  epoch: number;
  pressures: PressureEntry[];
  discreteModifications?: DiscreteMod[];
}

export interface EpochStat {
  epoch: number;
  era?: {
    start?: { name: string };
    end?: { name: string };
    transitions?: unknown[];
  };
}

export interface PlacementTrace {
  anchorType?: string;
  resolvedVia?: string;
  anchorEntity?: { name: string; kind: string };
  anchorCulture?: string;
  seedRegionsAvailable?: unknown[];
  emergentRegionCreated?: { label: string };
}

export interface CreatedEntity {
  name: string;
  kind: string;
  subtype: string;
  culture: string;
  prominence: string;
  placement?: PlacementTrace;
  placementStrategy?: string;
  coordinates?: { x: number; y: number; z?: number };
  regionId?: string;
  tags?: Record<string, string | boolean>;
  derivedTags?: Record<string, string | boolean>;
}

export interface CreatedRelationship {
  kind: string;
  srcId?: string;
  dstId?: string;
  srcName?: string;
  dstName?: string;
  strength?: number;
}

export interface TemplateApplication {
  tick: number;
  epoch: number;
  templateId: string;
  targetEntityName: string;
  targetEntityKind: string;
  description?: string;
  entitiesCreated?: CreatedEntity[];
  relationshipsCreated?: CreatedRelationship[];
  pressureChanges?: Record<string, number>;
}

export interface EraTransitionDetail {
  fromEra: string;
  toEra: string;
  fromEraId: string;
  toEraId: string;
  tickInEra: number;
  prominentEntitiesLinked?: number;
  exitConditionsMet?: Array<{
    type: string;
    pressureId?: string;
    entityKind?: string;
    operator?: string;
    threshold?: number;
    currentAge?: number;
    minTicks?: number;
  }>;
}

export interface SystemActionRecord {
  tick: number;
  epoch: number;
  systemId: string;
  systemName: string;
  description?: string;
  relationshipsAdded: number;
  entitiesModified: number;
  pressureChanges?: Record<string, number>;
  details?: {
    eraTransition?: EraTransitionDetail;
    diffusionSnapshot?: unknown;
    contagionSnapshot?: unknown;
  };
}

export interface PressureInfluence {
  pressureId: string;
  value: number;
  multiplier: number;
  contribution: number;
}

export interface ProminenceChange {
  entityName: string;
  direction: "up" | "down";
}

export interface ActionOutcome {
  status: string;
  description?: string;
  successChance: number;
  prominenceMultiplier: number;
  relationshipsCreated?: CreatedRelationship[];
  prominenceChanges?: ProminenceChange[];
}

export interface SelectionContext {
  availableActionCount: number;
  selectedWeight: number;
  totalWeight: number;
  attemptChance: number;
  prominenceBonus: number;
  pressureInfluences?: PressureInfluence[];
}

export interface ActionApplication {
  tick: number;
  epoch: number;
  actionId: string;
  actionName: string;
  actorId: string;
  actorName: string;
  actorKind: string;
  actorProminence: string;
  instigatorId?: string;
  instigatorName?: string;
  targetId?: string;
  targetName?: string;
  targetKind?: string;
  target2Id?: string;
  target2Name?: string;
  outcome: ActionOutcome;
  selectionContext: SelectionContext;
}

// ---------------------------------------------------------------------------
// Derived / transformed data
// ---------------------------------------------------------------------------

export interface PressureDataPoint {
  tick: number;
  epoch: number;
  [key: string]: number | string | undefined;
}

export interface TickBreakdownInfo {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  delta: number;
  breakdown?: PressureBreakdown;
  discreteModifications: DiscreteMod[];
  discreteTotal: number;
}

export interface TransformedPressureData {
  data: PressureDataPoint[];
  pressureIds: string[];
  breakdownsByTick: Map<number, Map<string, TickBreakdownInfo>>;
}

export interface TemplateEventMarker {
  tick: number;
  uniqueId: string;
  templateId: string;
  data: TemplateApplication;
  stackIndex: number;
  totalAtTick: number;
  entityKind: string | null;
  color: string;
}

export interface SystemEventMarker {
  tick: number;
  uniqueId: string;
  systemId: string;
  systemName: string;
  data: SystemActionRecord;
  stackIndex: number;
  totalAtTick: number;
  isEraTransition: boolean;
  color: string;
}

export interface ActionEventMarker {
  tick: number;
  uniqueId: string;
  actionId: string;
  actionName: string;
  data: ActionApplication;
  stackIndex: number;
  totalAtTick: number;
  color: string;
}

export interface EventData {
  template: TemplateEventMarker[];
  system: SystemEventMarker[];
  action: ActionEventMarker[];
}

export interface EraBoundary {
  era: string;
  eraId?: string;
  epoch: number;
  startTick: number;
  endTick: number;
}

export interface SelectedEvent {
  type: "template" | "action" | "system";
  data: TemplateApplication | ActionApplication | SystemActionRecord;
  isEraTransition?: boolean;
}

export interface SystemIdName {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Scale types
// ---------------------------------------------------------------------------

/** A visx/d3 linear scale with .invert() support */
export interface LinearScale {
  (value: number): number;
  invert(value: number): number;
  domain(): number[];
  range(): number[];
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
