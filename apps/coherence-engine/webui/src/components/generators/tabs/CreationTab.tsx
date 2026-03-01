/**
 * CreationTab - Visual entity creation cards
 *
 * Decomposed into sub-components for maintainability.
 * All callbacks are memoized, all array literals use useMemo.
 */

import React, { useState, useMemo, useCallback } from "react";
import TagSelector from "@the-canonry/shared-components/TagSelector";
import {
  ReferenceDropdown,
  LevelSelector,
  PROMINENCE_LEVELS,
  ChipSelect,
  NumberInput,
  LocalTextArea,
  useExpandBoolean,
} from "../../shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface PlacementAnchor {
  type: string;
  ref?: string;
  id?: string;
  refs?: string[];
  jitter?: number;
  stickToRegion?: boolean;
  preferPeriphery?: boolean;
  bounds?: {
    x?: [number, number];
    y?: [number, number];
    z?: [number, number];
  };
}

interface PlacementSpacing {
  minDistance?: number;
  avoidRefs?: string[];
}

interface PlacementRegionPolicy {
  allowEmergent?: boolean;
  createRegion?: boolean;
  preferSparse?: boolean;
}

interface Placement {
  anchor?: PlacementAnchor;
  spacing?: PlacementSpacing;
  regionPolicy?: PlacementRegionPolicy;
  steps?: string[];
}

interface CreationItem {
  entityRef: string;
  kind: string;
  subtype?: string | { inherit?: string; fromPressure?: Record<string, unknown> };
  status?: string;
  prominence?: string;
  culture?: { inherit?: string; fixed?: string };
  placement?: Placement;
  tags?: Record<string, boolean>;
  description?: string;
}

interface StrategyGroupConditions {
  entityKinds?: string[];
  subtypes?: string[];
  prominence?: string[];
  tags?: string[];
  tagMatchAll?: boolean;
}

interface StrategyGroup {
  name?: string;
  conditions?: StrategyGroupConditions;
}

interface NamingProfile {
  id: string;
  strategyGroups?: StrategyGroup[];
}

interface Culture {
  id: string;
  name?: string;
  naming?: { profiles?: NamingProfile[] };
}

interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: Array<{ id: string; name?: string }>;
  statuses?: Array<{ id: string; name?: string }>;
}

interface Schema {
  entityKinds?: EntityKindDef[];
  cultures?: Culture[];
}

interface VariantCondition {
  type: string;
  pressureId?: string;
  pressureA?: string;
  pressureB?: string;
  operator?: string;
  kind?: string;
  entity?: string;
  tag?: string;
  chance?: number;
  min?: number;
  max?: number;
}

interface VariantEffects {
  subtype?: Record<string, string>;
  tags?: Record<string, Record<string, boolean>>;
  stateUpdates?: Array<{
    type?: string;
    pressureId?: string;
    delta?: number;
  }>;
}

interface Variant {
  name?: string;
  when?: VariantCondition;
  apply?: VariantEffects;
}

interface VariantsConfig {
  selection: string;
  options: Variant[];
}

interface Generator {
  selection?: { kind?: string };
  variables?: Record<string, { select?: { kind?: string } }>;
  creation?: CreationItem[];
  variants?: VariantsConfig;
}

interface Pressure {
  id: string;
  name?: string;
}

interface TagRegistryEntry {
  id: string;
  name?: string;
}

interface ProfileMatch {
  cultureId: string;
  profileId: string;
  groupName: string;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers (outside components)
// ---------------------------------------------------------------------------

function getSubtypeOptionsFromSchema(schema: Schema | undefined, kind: string): SelectOption[] {
  const ek = (schema?.entityKinds ?? []).find((e) => e.kind === kind);
  if (!ek?.subtypes) return [];
  return ek.subtypes.map((st) => ({ value: st.id, label: st.name ?? st.id }));
}

function safeDisplay(value: unknown, fallback = "?", label = "value"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") {
    console.warn(`[CreationTab] Expected string for ${label} but got object:`, value);
    return "[object]";
  }
  return String(value as string | number | boolean);
}

// ---------------------------------------------------------------------------
// findMatchingNamingProfile - refactored into small helpers
// ---------------------------------------------------------------------------

function conditionMatchesEntityKind(cond: StrategyGroupConditions, entityKind: string): boolean {
  if (!cond.entityKinds?.length) return true;
  return cond.entityKinds.includes(entityKind);
}

function conditionMatchesSubtype(cond: StrategyGroupConditions, subtype: string | null): boolean {
  if (!cond.subtypes?.length) return true;
  return subtype !== null && cond.subtypes.includes(subtype);
}

function conditionMatchesProminence(cond: StrategyGroupConditions, prominence: string | undefined): boolean {
  if (!cond.prominence?.length) return true;
  return prominence !== undefined && cond.prominence.includes(prominence);
}

function conditionMatchesTags(cond: StrategyGroupConditions, tags: Record<string, boolean>): boolean {
  if (!cond.tags?.length) return true;
  const entityTags = Object.keys(tags);
  return cond.tagMatchAll
    ? cond.tags.every((t) => entityTags.includes(t))
    : cond.tags.some((t) => entityTags.includes(t));
}

function groupMatchesAll(
  group: StrategyGroup,
  entityKind: string,
  subtype: string | null,
  prominence: string | undefined,
  tags: Record<string, boolean>,
): boolean {
  const cond = group.conditions ?? {};
  return (
    conditionMatchesEntityKind(cond, entityKind) &&
    conditionMatchesSubtype(cond, subtype) &&
    conditionMatchesProminence(cond, prominence) &&
    conditionMatchesTags(cond, tags)
  );
}

function isDefaultGroup(group: StrategyGroup): boolean {
  if (!group.conditions) return true;
  return Object.keys(group.conditions).every((k) => {
    const val = group.conditions![k as keyof StrategyGroupConditions];
    return !val || (Array.isArray(val) && val.length === 0);
  });
}

function findConditionalMatch(
  profiles: NamingProfile[],
  entityKind: string,
  subtype: string | null,
  prominence: string | undefined,
  tags: Record<string, boolean>,
): { profileId: string; groupName: string } | null {
  for (const profile of profiles) {
    for (const group of profile.strategyGroups ?? []) {
      if (groupMatchesAll(group, entityKind, subtype, prominence, tags)) {
        return { profileId: profile.id, groupName: group.name ?? "" };
      }
    }
  }
  return null;
}

function findDefaultMatch(
  profiles: NamingProfile[],
): { profileId: string; groupName: string; isDefault: true } | null {
  for (const profile of profiles) {
    for (const group of profile.strategyGroups ?? []) {
      if (isDefaultGroup(group)) {
        return { profileId: profile.id, groupName: group.name ?? "Default", isDefault: true };
      }
    }
  }
  return null;
}

function findMatchingNamingProfile(
  culture: Culture | undefined,
  entityKind: string,
  subtype: string | null,
  prominence: string | undefined,
  tags: Record<string, boolean> = {},
): { profileId: string; groupName: string; isDefault?: boolean } | null {
  if (!culture?.naming?.profiles) return null;
  return (
    findConditionalMatch(culture.naming.profiles, entityKind, subtype, prominence, tags) ??
    findDefaultMatch(culture.naming.profiles)
  );
}

// ---------------------------------------------------------------------------
// Subtype display helper
// ---------------------------------------------------------------------------

function getSubtypeDisplay(subtype: CreationItem["subtype"]): string {
  if (subtype === null || subtype === undefined) return "\u26A0 not set";
  if (typeof subtype === "string") return subtype || "\u26A0 not set";
  if (typeof subtype === "object") {
    if ("inherit" in subtype && subtype.inherit) return `inherit:${subtype.inherit}`;
    if ("fromPressure" in subtype) return "from-pressure";
    return "[complex]";
  }
  return String(subtype as string | number | boolean);
}

// ---------------------------------------------------------------------------
// Condition summary helper
// ---------------------------------------------------------------------------

function summarizePressure(when: VariantCondition): string {
  return `${when.pressureId ?? "?"} in [${when.min ?? 0}, ${when.max ?? 100}]`;
}

function summarizeCompare(when: VariantCondition): string {
  return `${when.pressureA ?? "?"} ${when.operator ?? ">"} ${when.pressureB ?? "?"}`;
}

function summarizeEntityCount(when: VariantCondition): string {
  return `${when.kind ?? "?"} count in [${when.min ?? 0}, ${when.max ?? "\u221E"}]`;
}

function summarizeTagExists(when: VariantCondition): string {
  return `${when.entity ?? "?"} has "${when.tag ?? "?"}"`;
}

function getConditionSummary(when: VariantCondition | undefined): string {
  if (!when) return "No condition";
  if (when.type === "pressure") return summarizePressure(when);
  if (when.type === "pressure_compare") return summarizeCompare(when);
  if (when.type === "entity_count") return summarizeEntityCount(when);
  if (when.type === "tag_exists") return summarizeTagExists(when);
  if (when.type === "random_chance") return `${Math.round((when.chance ?? 0.5) * 100)}% chance`;
  if (when.type === "always") return "Always applies";
  return when.type;
}

// ---------------------------------------------------------------------------
// Static option arrays (stable references)
// ---------------------------------------------------------------------------

const SUBTYPE_MODE_OPTIONS: SelectOption[] = [
  { value: "", label: "Select mode..." },
  { value: "fixed", label: "Fixed subtype" },
  { value: "inherit", label: "Inherit from entity" },
  { value: "from_pressure", label: "From pressure" },
];

const CULTURE_MODE_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "inherit", label: "Inherit from entity" },
  { value: "fixed", label: "Fixed culture ID" },
];

const ANCHOR_TYPE_OPTIONS: SelectOption[] = [
  { value: "entity", label: "Near Entity (same kind)" },
  { value: "culture", label: "In Culture Region" },
  { value: "refs_centroid", label: "At Refs Centroid" },
  { value: "sparse", label: "Sparse Area" },
  { value: "bounds", label: "Within Bounds" },
];

const STEPS_OPTIONS: SelectOption[] = [
  { value: "anchor_region", label: "Anchor Region" },
  { value: "ref_region", label: "Ref Region" },
  { value: "seed_region", label: "Seed Region" },
  { value: "sparse", label: "Sparse" },
  { value: "bounds", label: "Bounds" },
  { value: "random", label: "Random" },
];

const CONDITION_TYPE_OPTIONS: SelectOption[] = [
  { value: "always", label: "Always (default)" },
  { value: "pressure", label: "Pressure threshold" },
  { value: "pressure_compare", label: "Pressure A > B" },
  { value: "entity_count", label: "Entity count" },
  { value: "tag_exists", label: "Tag exists on entity" },
  { value: "random_chance", label: "Random chance" },
];

const SELECTION_MODE_OPTIONS: SelectOption[] = [
  { value: "first_match", label: "First Match - Apply first matching variant only" },
  { value: "all_matching", label: "All Matching - Apply all matching variants" },
];

// ---------------------------------------------------------------------------
// SubtypeEditor
// ---------------------------------------------------------------------------

interface SubtypeEditorProps {
  readonly item: CreationItem;
  readonly schema: Schema | undefined;
  readonly availableRefs: string[];
  readonly updateField: (field: string, value: unknown) => void;
}

const SubtypeEditor = React.memo(function SubtypeEditor({
  item,
  schema,
  availableRefs,
  updateField,
}: Readonly<SubtypeEditorProps>) {
  const subtypeMode = useMemo(() => {
    if (typeof item.subtype === "string") return "fixed";
    if (item.subtype && typeof item.subtype === "object" && "inherit" in item.subtype) return "inherit";
    if (item.subtype && typeof item.subtype === "object" && "fromPressure" in item.subtype) return "from_pressure";
    return "";
  }, [item.subtype]);

  const subtypeOptions = useMemo(
    () => getSubtypeOptionsFromSchema(schema, item.kind),
    [schema, item.kind],
  );

  const fixedOptions = useMemo(
    () => [{ value: "", label: "Select subtype..." }, ...subtypeOptions],
    [subtypeOptions],
  );

  const refOptions = useMemo(
    () => availableRefs.map((r) => ({ value: r, label: r })),
    [availableRefs],
  );

  const handleModeChange = useCallback(
    (v: string) => {
      if (v === "fixed") updateField("subtype", "");
      else if (v === "inherit") updateField("subtype", { inherit: "$target" });
      else if (v === "from_pressure") updateField("subtype", { fromPressure: {} });
      else updateField("subtype", undefined);
    },
    [updateField],
  );

  const handleFixedChange = useCallback(
    (v: string) => updateField("subtype", v),
    [updateField],
  );

  const handleInheritChange = useCallback(
    (v: string) => {
      if (item.subtype && typeof item.subtype === "object") {
        updateField("subtype", { ...item.subtype, inherit: v });
      }
    },
    [updateField, item.subtype],
  );

  if (!item.kind) return null;

  const hasInherit = item.subtype && typeof item.subtype === "object" && "inherit" in item.subtype;
  const hasFromPressure = item.subtype && typeof item.subtype === "object" && "fromPressure" in item.subtype;

  return (
    <div className="mt-xl">
      <span className="label">Subtype (required)</span>
      <div className="form-grid">
        <ReferenceDropdown
          label="Mode"
          value={subtypeMode}
          onChange={handleModeChange}
          options={SUBTYPE_MODE_OPTIONS}
          placeholder="Select mode..."
        />
        {typeof item.subtype === "string" && (
          <ReferenceDropdown
            label="Subtype value"
            value={item.subtype}
            onChange={handleFixedChange}
            options={fixedOptions}
            placeholder="Select subtype..."
          />
        )}
        {hasInherit && (
          <ReferenceDropdown
            label="Inherit from"
            value={(item.subtype as { inherit: string }).inherit}
            onChange={handleInheritChange}
            options={refOptions}
            placeholder="Select entity..."
          />
        )}
      </div>
      {hasFromPressure && (
        <div className="form-help-text mt-md">
          From pressure mapping requires JSON editing for now.
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// CultureEditor
// ---------------------------------------------------------------------------

interface CultureEditorProps {
  readonly item: CreationItem;
  readonly availableRefs: string[];
  readonly cultureIds: string[];
  readonly culturesById: Record<string, Culture>;
  readonly updateField: (field: string, value: unknown) => void;
}

const CultureEditor = React.memo(function CultureEditor({
  item,
  availableRefs,
  cultureIds,
  culturesById,
  updateField,
}: Readonly<CultureEditorProps>) {
  const cultureMode = useMemo(() => {
    if (item.culture?.inherit) return "inherit";
    if (item.culture?.fixed) return "fixed";
    return "none";
  }, [item.culture]);

  const refOptions = useMemo(
    () => availableRefs.map((r) => ({ value: r, label: r })),
    [availableRefs],
  );

  const cultureOptions = useMemo(
    () => cultureIds.map((c) => ({ value: c, label: culturesById[c]?.name ?? c })),
    [cultureIds, culturesById],
  );

  const handleModeChange = useCallback(
    (v: string) => {
      if (v === "inherit") updateField("culture", { inherit: "$target" });
      else if (v === "fixed") updateField("culture", { fixed: "" });
      else updateField("culture", undefined);
    },
    [updateField],
  );

  const handleInheritChange = useCallback(
    (v: string) => updateField("culture", { inherit: v }),
    [updateField],
  );

  const handleFixedChange = useCallback(
    (v: string) => updateField("culture", { fixed: v }),
    [updateField],
  );

  return (
    <div className="mt-xl">
      <span className="label">Culture</span>
      <div className="form-grid">
        <ReferenceDropdown label="Mode" value={cultureMode} onChange={handleModeChange} options={CULTURE_MODE_OPTIONS} />
        {item.culture?.inherit && (
          <ReferenceDropdown label="Inherit from" value={item.culture.inherit} onChange={handleInheritChange} options={refOptions} placeholder="Select entity..." />
        )}
        {item.culture?.fixed !== undefined && (
          <ReferenceDropdown label="Culture ID" value={item.culture.fixed} onChange={handleFixedChange} options={cultureOptions} placeholder="Select culture..." />
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// BoundsEditor
// ---------------------------------------------------------------------------

interface BoundsEditorProps {
  readonly anchor: PlacementAnchor;
  readonly setAnchor: (a: PlacementAnchor) => void;
}

const BoundsEditor = React.memo(function BoundsEditor({ anchor, setAnchor }: Readonly<BoundsEditorProps>) {
  const makeHandler = useCallback(
    (axis: "x" | "y" | "z", idx: 0 | 1, fallback: number) =>
      (v: number | string) => {
        const current = anchor.bounds?.[axis] ?? [0, 100];
        const updated = [...current] as [number, number];
        updated[idx] = v === "" ? fallback : Number(v);
        setAnchor({ ...anchor, bounds: { ...anchor.bounds, [axis]: updated } });
      },
    [anchor, setAnchor],
  );

  const xMin = useMemo(() => makeHandler("x", 0, 0), [makeHandler]);
  const xMax = useMemo(() => makeHandler("x", 1, 100), [makeHandler]);
  const yMin = useMemo(() => makeHandler("y", 0, 0), [makeHandler]);
  const yMax = useMemo(() => makeHandler("y", 1, 100), [makeHandler]);
  const zMin = useMemo(() => makeHandler("z", 0, 0), [makeHandler]);
  const zMax = useMemo(() => makeHandler("z", 1, 100), [makeHandler]);

  return (
    <div className="mt-lg">
      <div className="ct-bounds-grid">
        <div />
        <span className="label text-center">Min</span>
        <span className="label text-center">Max</span>
        <label className="label">X<NumberInput value={anchor.bounds?.x?.[0] ?? ""} onChange={xMin} step={1} placeholder="0" /></label>
        <NumberInput value={anchor.bounds?.x?.[1] ?? ""} onChange={xMax} step={1} placeholder="100" />
        <label className="label">Y<NumberInput value={anchor.bounds?.y?.[0] ?? ""} onChange={yMin} step={1} placeholder="0" /></label>
        <NumberInput value={anchor.bounds?.y?.[1] ?? ""} onChange={yMax} step={1} placeholder="100" />
        <label className="label">Z<NumberInput value={anchor.bounds?.z?.[0] ?? ""} onChange={zMin} step={1} placeholder="0" /></label>
        <NumberInput value={anchor.bounds?.z?.[1] ?? ""} onChange={zMax} step={1} placeholder="100" />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// AnchorDetails - shows per-anchor-type fields
// ---------------------------------------------------------------------------

interface AnchorDetailsProps {
  readonly placement: Placement;
  readonly sameKindRefs: string[];
  readonly availableRefs: string[];
  readonly itemKind: string;
  readonly setAnchor: (a: PlacementAnchor) => void;
}

const AnchorDetails = React.memo(function AnchorDetails({
  placement,
  sameKindRefs,
  availableRefs,
  itemKind,
  setAnchor,
}: Readonly<AnchorDetailsProps>) {
  const anchor = placement.anchor;
  if (!anchor) return null;

  const entityRefOptions = useMemo(
    () =>
      sameKindRefs.length > 0
        ? sameKindRefs.map((r) => ({ value: r, label: `${r} (${itemKind})` }))
        : [{ value: "$target", label: "$target" }],
    [sameKindRefs, itemKind],
  );

  const cultureSourceOptions = useMemo(
    () =>
      availableRefs.length > 0
        ? availableRefs.map((r) => ({ value: r, label: r }))
        : [{ value: "$target", label: "$target" }],
    [availableRefs],
  );

  const centroidRefOptions = useMemo(
    () => sameKindRefs.map((r) => ({ value: r, label: r })),
    [sameKindRefs],
  );

  const handleEntityRef = useCallback((v: string) => { if (v) setAnchor({ ...anchor, ref: v }); }, [anchor, setAnchor]);
  const handleStick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setAnchor({ ...anchor, stickToRegion: e.target.checked }), [anchor, setAnchor]);
  const handleCultureSrc = useCallback((v: string) => { if (v) setAnchor({ ...anchor, id: v }); }, [anchor, setAnchor]);
  const handleCentroidRefs = useCallback((v: string[]) => { if (v.length > 0) setAnchor({ ...anchor, refs: v }); }, [anchor, setAnchor]);
  const handleJitter = useCallback((v: number | string) => setAnchor({ ...anchor, jitter: v === "" ? undefined : Number(v) }), [anchor, setAnchor]);
  const handlePeriphery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setAnchor({ ...anchor, preferPeriphery: e.target.checked }), [anchor, setAnchor]);

  if (anchor.type === "entity") {
    return (
      <div className="form-grid mt-lg">
        <ReferenceDropdown label="Reference Entity" value={anchor.ref} onChange={handleEntityRef} options={entityRefOptions} placeholder={sameKindRefs.length > 0 ? "Select..." : `Define a ${itemKind} variable first`} />
        <div className="form-group">
          <label className="checkbox-label"><input type="checkbox" className="checkbox" checked={anchor.stickToRegion ?? false} onChange={handleStick} />Stick to Region</label>
        </div>
      </div>
    );
  }

  if (anchor.type === "culture") {
    return (
      <div className="form-grid mt-lg">
        <ReferenceDropdown label="Culture Source" value={anchor.id} onChange={handleCultureSrc} options={cultureSourceOptions} placeholder="Select entity..." />
      </div>
    );
  }

  if (anchor.type === "refs_centroid") {
    return (
      <div className="form-grid mt-lg">
        <ChipSelect label="Reference Entities" value={anchor.refs ?? []} onChange={handleCentroidRefs} options={centroidRefOptions} placeholder="Select entities..." />
        <div className="form-group">
          <label className="label">Jitter Radius<NumberInput value={anchor.jitter ?? ""} onChange={handleJitter} min={0} step={1} placeholder="0" /></label>
        </div>
      </div>
    );
  }

  if (anchor.type === "sparse") {
    return (
      <div className="form-grid mt-lg">
        <div className="form-group">
          <label className="checkbox-label"><input type="checkbox" className="checkbox" checked={anchor.preferPeriphery ?? false} onChange={handlePeriphery} />Prefer Periphery</label>
        </div>
      </div>
    );
  }

  if (anchor.type === "bounds") {
    return <BoundsEditor anchor={anchor} setAnchor={setAnchor} />;
  }

  return null;
});

// ---------------------------------------------------------------------------
// SpacingEditor
// ---------------------------------------------------------------------------

interface SpacingEditorProps {
  readonly placement: Placement;
  readonly availableRefs: string[];
  readonly setSpacing: (s: PlacementSpacing | undefined) => void;
}

const SpacingEditor = React.memo(function SpacingEditor({
  placement,
  availableRefs,
  setSpacing,
}: Readonly<SpacingEditorProps>) {
  const avoidRefOptions = useMemo(
    () => availableRefs.map((r) => ({ value: r, label: r })),
    [availableRefs],
  );

  const handleMinDistance = useCallback(
    (v: number | string) => {
      const minDistance = v === "" ? undefined : Number(v);
      const avoidRefs = placement.spacing?.avoidRefs;
      setSpacing({
        ...(minDistance !== undefined && { minDistance }),
        ...(avoidRefs?.length && { avoidRefs }),
      });
    },
    [placement.spacing, setSpacing],
  );

  const handleAvoidRefs = useCallback(
    (v: string[]) => {
      const minDistance = placement.spacing?.minDistance;
      setSpacing({
        ...(minDistance !== undefined && { minDistance }),
        ...(v.length && { avoidRefs: v }),
      });
    },
    [placement.spacing, setSpacing],
  );

  return (
    <>
      <div className="nested-title mt-2xl">Spacing</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="label">Min Distance<NumberInput value={placement.spacing?.minDistance ?? ""} onChange={handleMinDistance} min={0} step={1} placeholder="No minimum" /></label>
        </div>
        <ChipSelect label="Avoid Refs" value={placement.spacing?.avoidRefs ?? []} onChange={handleAvoidRefs} options={avoidRefOptions} placeholder="Select entities to avoid..." />
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------
// RegionPolicyEditor
// ---------------------------------------------------------------------------

interface RegionPolicyEditorProps {
  readonly placement: Placement;
  readonly setRegionPolicy: (rp: PlacementRegionPolicy | undefined) => void;
}

const RegionPolicyEditor = React.memo(function RegionPolicyEditor({
  placement,
  setRegionPolicy,
}: Readonly<RegionPolicyEditorProps>) {
  const handleAllowEmergent = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRegionPolicy({ ...(placement.regionPolicy ?? {}), allowEmergent: e.target.checked || undefined });
    },
    [placement.regionPolicy, setRegionPolicy],
  );

  const handleCreateRegion = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRegionPolicy({ ...(placement.regionPolicy ?? {}), createRegion: e.target.checked || undefined });
    },
    [placement.regionPolicy, setRegionPolicy],
  );

  const handlePreferSparse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRegionPolicy({ ...(placement.regionPolicy ?? {}), preferSparse: e.target.checked || undefined });
    },
    [placement.regionPolicy, setRegionPolicy],
  );

  return (
    <>
      <div className="nested-title mt-2xl">Region Policy</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="checkbox-label"><input type="checkbox" className="checkbox" checked={placement.regionPolicy?.allowEmergent ?? false} onChange={handleAllowEmergent} />Allow Emergent Regions</label>
          <div className="hint">When enabled, creates new regions when existing regions are at capacity</div>
        </div>
        <div className="form-group">
          <label className="checkbox-label"><input type="checkbox" className="checkbox" checked={placement.regionPolicy?.createRegion ?? false} onChange={handleCreateRegion} />Create Region at Location</label>
          <div className="hint">Creates a new region centered on the placed entity</div>
        </div>
        <div className="form-group">
          <label className="checkbox-label"><input type="checkbox" className="checkbox" checked={placement.regionPolicy?.preferSparse ?? false} onChange={handlePreferSparse} />Prefer Sparse Regions</label>
          <div className="hint">Bias region selection toward regions with fewer entities</div>
        </div>
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------
// PlacementEditor
// ---------------------------------------------------------------------------

interface PlacementEditorProps {
  readonly item: CreationItem;
  readonly placement: Placement | undefined;
  readonly sameKindRefs: string[];
  readonly availableRefs: string[];
  readonly onChange: (item: CreationItem) => void;
}

const PlacementEditor = React.memo(function PlacementEditor({
  item,
  placement,
  sameKindRefs,
  availableRefs,
  onChange,
}: Readonly<PlacementEditorProps>) {
  const hasAnchor = Boolean(placement?.anchor);

  const setPlacement = useCallback(
    (p: Placement) => onChange({ ...item, placement: p }),
    [item, onChange],
  );

  const setAnchor = useCallback(
    (anchor: PlacementAnchor) => {
      setPlacement({
        anchor,
        ...(placement?.spacing && { spacing: placement.spacing }),
        ...(placement?.regionPolicy && { regionPolicy: placement.regionPolicy }),
        ...(placement?.steps && { steps: placement.steps }),
      });
    },
    [placement, setPlacement],
  );

  const setSpacing = useCallback(
    (spacing: PlacementSpacing | undefined) => {
      if (!placement?.anchor) return;
      setPlacement({
        anchor: placement.anchor,
        ...(spacing && Object.keys(spacing).length > 0 && { spacing }),
        ...(placement.regionPolicy && { regionPolicy: placement.regionPolicy }),
        ...(placement.steps && { steps: placement.steps }),
      });
    },
    [placement, setPlacement],
  );

  const setRegionPolicy = useCallback(
    (rp: PlacementRegionPolicy | undefined) => {
      if (!placement?.anchor) return;
      setPlacement({
        anchor: placement.anchor,
        ...(placement.spacing && { spacing: placement.spacing }),
        ...(rp && Object.keys(rp).length > 0 && { regionPolicy: rp }),
        ...(placement.steps && { steps: placement.steps }),
      });
    },
    [placement, setPlacement],
  );

  const handleSteps = useCallback(
    (steps: string[]) => {
      if (!placement?.anchor) return;
      setPlacement({
        anchor: placement.anchor,
        ...(placement.spacing && { spacing: placement.spacing }),
        ...(placement.regionPolicy && { regionPolicy: placement.regionPolicy }),
        ...(steps.length > 0 && { steps }),
      });
    },
    [placement, setPlacement],
  );

  const handleAnchorType = useCallback(
    (v: string) => {
      if (!v) return;
      if (v === "entity") setAnchor({ type: "entity", ref: sameKindRefs[0] || "$target", stickToRegion: true });
      else if (v === "culture") setAnchor({ type: "culture", id: "$target" });
      else if (v === "refs_centroid") setAnchor({ type: "refs_centroid", refs: sameKindRefs.length > 0 ? sameKindRefs.slice(0, 1) : ["$target"] });
      else if (v === "sparse") setAnchor({ type: "sparse" });
      else if (v === "bounds") setAnchor({ type: "bounds", bounds: { x: [0, 100], y: [0, 100] } });
    },
    [sameKindRefs, setAnchor],
  );

  return (
    <div className="mt-xl">
      <span className="label">Placement</span>
      <div className="form-help-text">Configure semantic placement. Semantic planes are per-kind; cross-kind anchors are not allowed.</div>
      <div className="ct-nested-panel mt-md">
        <div className="nested-title">Anchor Strategy</div>
        <div className="form-grid">
          <ReferenceDropdown label="Strategy Type" value={placement?.anchor?.type ?? ""} onChange={handleAnchorType} options={ANCHOR_TYPE_OPTIONS} placeholder="Select anchor..." />
        </div>
        {placement && <AnchorDetails placement={placement} sameKindRefs={sameKindRefs} availableRefs={availableRefs} itemKind={item.kind} setAnchor={setAnchor} />}
        {!hasAnchor && <div className="hint mt-lg">Select an anchor strategy to configure spacing, region policy, and placement steps.</div>}
        {hasAnchor && placement && (
          <>
            <SpacingEditor placement={placement} availableRefs={availableRefs} setSpacing={setSpacing} />
            <RegionPolicyEditor placement={placement} setRegionPolicy={setRegionPolicy} />
            <div className="nested-title mt-2xl">Placement Steps</div>
            <ChipSelect label="Steps" value={placement.steps ?? []} onChange={handleSteps} options={STEPS_OPTIONS} placeholder="Add placement steps..." />
          </>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CreationCardBody - expanded content of CreationCard
// ---------------------------------------------------------------------------

interface CreationCardBodyProps {
  readonly item: CreationItem;
  readonly onChange: (item: CreationItem) => void;
  readonly schema: Schema | undefined;
  readonly availableRefs: string[];
  readonly culturesById: Record<string, Culture>;
  readonly cultureIds: string[];
  readonly sameKindRefs: string[];
  readonly tagRegistry: TagRegistryEntry[];
  readonly onAddToRegistry?: (tag: string) => void;
}

const CreationCardBody = React.memo(function CreationCardBody({
  item,
  onChange,
  schema,
  availableRefs,
  culturesById,
  cultureIds,
  sameKindRefs,
  tagRegistry,
  onAddToRegistry,
}: Readonly<CreationCardBodyProps>) {
  const entityKindOptions = useMemo(
    () => (schema?.entityKinds ?? []).map((ek) => ({ value: ek.kind, label: ek.description ?? ek.kind })),
    [schema],
  );

  const statusOptions = useMemo(() => {
    const ek = (schema?.entityKinds ?? []).find((e) => e.kind === item.kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name ?? st.id }));
  }, [schema, item.kind]);

  const statusDropdownOptions = useMemo(
    () => [{ value: "", label: "None" }, ...statusOptions],
    [statusOptions],
  );

  const updateField = useCallback(
    (field: string, value: unknown) => onChange({ ...item, [field]: value }),
    [item, onChange],
  );

  const handleEntityRef = useCallback((e: React.ChangeEvent<HTMLInputElement>) => updateField("entityRef", e.target.value), [updateField]);
  const handleKindChange = useCallback(
    (v: string) => {
      const updates: Partial<CreationItem> = { kind: v, status: undefined };
      if (typeof item.subtype !== "object") updates.subtype = undefined;
      onChange({ ...item, ...updates });
    },
    [item, onChange],
  );
  const handleStatus = useCallback((v: string) => updateField("status", v), [updateField]);
  const handleProminence = useCallback((v: string) => updateField("prominence", v), [updateField]);
  const handleTags = useCallback(
    (tagArray: string[]) => {
      const tagsObj: Record<string, boolean> = {};
      tagArray.forEach((t) => { tagsObj[t] = true; });
      updateField("tags", tagsObj);
    },
    [updateField],
  );
  const handleDescription = useCallback((value: string) => updateField("description", value || undefined), [updateField]);

  const tagValue = useMemo(
    () => Object.keys(item.tags ?? {}).filter((k) => item.tags?.[k]),
    [item.tags],
  );

  return (
    <div className="item-card-body">
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="entity-reference" className="label">Entity Reference</label>
          <input id="entity-reference" type="text" value={item.entityRef ?? ""} onChange={handleEntityRef} className="input" placeholder="$hero" />
        </div>
        <ReferenceDropdown label="Kind" value={item.kind} onChange={handleKindChange} options={entityKindOptions} />
        {item.kind && <ReferenceDropdown label="Status" value={item.status} onChange={handleStatus} options={statusDropdownOptions} />}
      </div>
      <SubtypeEditor item={item} schema={schema} availableRefs={availableRefs} updateField={updateField} />
      <div className="form-group mt-lg">
        <label className="label">Prominence<LevelSelector value={item.prominence} onChange={handleProminence} levels={PROMINENCE_LEVELS} /></label>
      </div>
      <CultureEditor item={item} availableRefs={availableRefs} cultureIds={cultureIds} culturesById={culturesById} updateField={updateField} />
      <PlacementEditor item={item} placement={item.placement} sameKindRefs={sameKindRefs} availableRefs={availableRefs} onChange={onChange} />
      <div className="mt-xl">
        <span className="label">Tags</span>
        <div className="form-help-text">Assign tags to this entity for filtering, naming profiles, and system targeting.</div>
        <TagSelector value={tagValue} onChange={handleTags} tagRegistry={tagRegistry} onAddToRegistry={onAddToRegistry} placeholder="Select tags..." />
      </div>
      <div className="mt-xl">
        <span className="label">Description (optional)</span>
        <div className="form-help-text">A description for the created entity. Leave empty to auto-generate.</div>
        <LocalTextArea value={typeof item.description === "string" ? item.description : ""} onChange={handleDescription} placeholder="Optional entity description..." rows={2} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CreationCard
// ---------------------------------------------------------------------------

interface CreationCardProps {
  readonly item: CreationItem;
  readonly onChange: (item: CreationItem) => void;
  readonly onRemove: () => void;
  readonly schema: Schema | undefined;
  readonly availableRefs: string[];
  readonly culturesById: Record<string, Culture>;
  readonly cultureIds: string[];
  readonly generator: Generator;
  readonly tagRegistry: TagRegistryEntry[];
  readonly onAddToRegistry?: (tag: string) => void;
}

function CreationCard({
  item, onChange, onRemove, schema, availableRefs, culturesById, cultureIds, generator, tagRegistry, onAddToRegistry,
}: Readonly<CreationCardProps>) {
  const { expanded, hovering, headerProps } = useExpandBoolean();

  const getRefKind = useCallback(
    (ref: string) => {
      if (!ref) return null;
      if (ref === "$target") return generator?.selection?.kind ?? null;
      const varConfig = generator?.variables?.[ref];
      if (varConfig?.select?.kind) return varConfig.select.kind;
      const ci = generator?.creation?.find((c) => c.entityRef === ref);
      return ci?.kind ?? null;
    },
    [generator],
  );

  const sameKindRefs = useMemo(() => {
    if (!item.kind) return [];
    return availableRefs.filter((ref) => ref !== item.entityRef && getRefKind(ref) === item.kind);
  }, [availableRefs, item.kind, item.entityRef, getRefKind]);

  const cultureId = useMemo(() => {
    if (!item.culture) return null;
    if (item.culture.fixed) return item.culture.fixed;
    return null;
  }, [item.culture]);

  const subtype = typeof item.subtype === "string" ? item.subtype : null;

  const profileMatches = useMemo(() => {
    const targetCultures = cultureId ? [cultureId] : cultureIds;
    const matches: ProfileMatch[] = [];
    for (const cid of targetCultures) {
      const match = findMatchingNamingProfile(culturesById[cid], item.kind, subtype, item.prominence, item.tags);
      if (match) matches.push({ cultureId: cid, ...match });
    }
    return matches;
  }, [culturesById, cultureId, cultureIds, item.kind, subtype, item.prominence, item.tags]);

  const handleRemove = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onRemove(); }, [onRemove]);
  const subtypeDisplay = getSubtypeDisplay(item.subtype);

  return (
    <div className="item-card">
      <div className={`item-card-header ${hovering ? "item-card-header-hover" : ""}`} {...headerProps}>
        <div className="item-card-icon item-card-icon-creation">&#x2728;</div>
        <div className="item-card-info">
          <div className="item-card-title"><span className="entity-ref">{item.entityRef}</span></div>
          <div className="item-card-subtitle">{safeDisplay(item.kind, "?", "kind")}:{subtypeDisplay} &bull; {safeDisplay(item.prominence, "no prominence", "prominence")}</div>
          {cultureIds.length > 0 && (
            <div className="mt-xs">
              {profileMatches.length > 0
                ? <span className="badge badge-success"><span>&#x2713;</span><span>{profileMatches.length === 1 ? profileMatches[0].profileId : `${profileMatches.length} profiles`}</span></span>
                : <span className="badge badge-error"><span>!</span><span>No naming profile</span></span>}
            </div>
          )}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? "\u25B2" : "\u25BC"}</button>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>&times;</button>
        </div>
      </div>
      {expanded && (
        <CreationCardBody item={item} onChange={onChange} schema={schema} availableRefs={availableRefs} culturesById={culturesById} cultureIds={cultureIds} sameKindRefs={sameKindRefs} tagRegistry={tagRegistry} onAddToRegistry={onAddToRegistry} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PressureConditionFields / CompareConditionFields / etc.
// ---------------------------------------------------------------------------

interface PressureConditionFieldsProps {
  readonly condition: VariantCondition;
  readonly onChange: (c: VariantCondition) => void;
  readonly pressureOptions: SelectOption[];
}

const PressureConditionFields = React.memo(function PressureConditionFields({
  condition, onChange, pressureOptions,
}: Readonly<PressureConditionFieldsProps>) {
  const handleId = useCallback((v: string) => onChange({ ...condition, pressureId: v }), [condition, onChange]);
  const handleMin = useCallback((v: number | string) => onChange({ ...condition, min: Number(v) }), [condition, onChange]);
  const handleMax = useCallback((v: number | string) => onChange({ ...condition, max: Number(v) }), [condition, onChange]);
  return (
    <>
      <ReferenceDropdown label="Pressure" value={condition.pressureId ?? ""} onChange={handleId} options={pressureOptions} placeholder="Select pressure..." />
      <div className="form-group"><label className="label">Min Value<NumberInput value={condition.min} onChange={handleMin} integer allowEmpty placeholder="0" /></label></div>
      <div className="form-group"><label className="label">Max Value<NumberInput value={condition.max} onChange={handleMax} integer allowEmpty placeholder="100" /></label></div>
    </>
  );
});

interface CompareConditionFieldsProps {
  readonly condition: VariantCondition;
  readonly onChange: (c: VariantCondition) => void;
  readonly pressureOptions: SelectOption[];
}

const CompareConditionFields = React.memo(function CompareConditionFields({
  condition, onChange, pressureOptions,
}: Readonly<CompareConditionFieldsProps>) {
  const handleA = useCallback((v: string) => onChange({ ...condition, pressureA: v }), [condition, onChange]);
  const handleB = useCallback((v: string) => onChange({ ...condition, pressureB: v }), [condition, onChange]);
  return (
    <>
      <ReferenceDropdown label="Pressure A" value={condition.pressureA ?? ""} onChange={handleA} options={pressureOptions} placeholder="Select pressure..." />
      <div className="ct-compare-arrow"><span className="ct-arrow-icon">&gt;</span></div>
      <ReferenceDropdown label="Pressure B" value={condition.pressureB ?? ""} onChange={handleB} options={pressureOptions} placeholder="Select pressure..." />
    </>
  );
});

interface EntityCountFieldsProps {
  readonly condition: VariantCondition;
  readonly onChange: (c: VariantCondition) => void;
  readonly entityKindOptions: SelectOption[];
}

const EntityCountFields = React.memo(function EntityCountFields({
  condition, onChange, entityKindOptions,
}: Readonly<EntityCountFieldsProps>) {
  const handleKind = useCallback((v: string) => onChange({ ...condition, kind: v }), [condition, onChange]);
  const handleMin = useCallback((v: number | string) => onChange({ ...condition, min: Number(v) }), [condition, onChange]);
  const handleMax = useCallback((v: number | string) => onChange({ ...condition, max: Number(v) }), [condition, onChange]);
  return (
    <>
      <ReferenceDropdown label="Entity Kind" value={condition.kind ?? ""} onChange={handleKind} options={entityKindOptions} placeholder="Select kind..." />
      <div className="form-group"><label className="label">Min Count<NumberInput value={condition.min} onChange={handleMin} integer allowEmpty placeholder="0" /></label></div>
      <div className="form-group"><label className="label">Max Count<NumberInput value={condition.max} onChange={handleMax} integer allowEmpty placeholder="No limit" /></label></div>
    </>
  );
});

interface TagExistsFieldsProps {
  readonly condition: VariantCondition;
  readonly onChange: (c: VariantCondition) => void;
  readonly availableRefs: string[];
  readonly tagRegistry: TagRegistryEntry[];
}

const TagExistsFields = React.memo(function TagExistsFields({
  condition, onChange, availableRefs, tagRegistry,
}: Readonly<TagExistsFieldsProps>) {
  const refOptions = useMemo(() => availableRefs.map((r) => ({ value: r, label: r })), [availableRefs]);
  const tagValue = useMemo(() => (condition.tag ? [condition.tag] : []), [condition.tag]);
  const handleEntity = useCallback((v: string) => onChange({ ...condition, entity: v }), [condition, onChange]);
  const handleTag = useCallback((tags: string[]) => onChange({ ...condition, tag: tags[0] ?? "" }), [condition, onChange]);
  return (
    <>
      <ReferenceDropdown label="Entity Reference" value={condition.entity ?? ""} onChange={handleEntity} options={refOptions} placeholder="Select entity..." />
      <div className="form-group"><label className="label">Tag Name<TagSelector value={tagValue} onChange={handleTag} tagRegistry={tagRegistry} placeholder="Select tag..." singleSelect /></label></div>
    </>
  );
});

// ---------------------------------------------------------------------------
// VariantConditionEditor
// ---------------------------------------------------------------------------

interface VariantConditionEditorProps {
  readonly condition: VariantCondition | undefined;
  readonly onChange: (condition: VariantCondition) => void;
  readonly pressureOptions: SelectOption[];
  readonly entityKindOptions: SelectOption[];
  readonly availableRefs: string[];
  readonly tagRegistry: TagRegistryEntry[];
}

function VariantConditionEditor({
  condition, onChange, pressureOptions, entityKindOptions, availableRefs, tagRegistry,
}: Readonly<VariantConditionEditorProps>) {
  const conditionType = condition?.type ?? "always";

  const handleTypeChange = useCallback(
    (type: string) => {
      if (type === "pressure") onChange({ type: "pressure", pressureId: pressureOptions[0]?.value ?? "", min: 30 });
      else if (type === "pressure_compare") onChange({ type: "pressure_compare", pressureA: pressureOptions[0]?.value ?? "", pressureB: pressureOptions[1]?.value ?? "", operator: ">" });
      else if (type === "entity_count") onChange({ type: "entity_count", kind: entityKindOptions[0]?.value ?? "npc", min: 1 });
      else if (type === "tag_exists") onChange({ type: "tag_exists", entity: "$target", tag: "" });
      else if (type === "random_chance") onChange({ type: "random_chance", chance: 0.5 });
      else onChange({ type: "always" });
    },
    [onChange, pressureOptions, entityKindOptions],
  );

  const handleChance = useCallback(
    (v: number | string) => onChange({ ...condition!, chance: Number(v) || 0.5 }),
    [condition, onChange],
  );

  return (
    <div className="form-grid">
      <ReferenceDropdown label="Condition Type" value={conditionType} onChange={handleTypeChange} options={CONDITION_TYPE_OPTIONS} />
      {conditionType === "pressure" && condition && <PressureConditionFields condition={condition} onChange={onChange} pressureOptions={pressureOptions} />}
      {conditionType === "pressure_compare" && condition && <CompareConditionFields condition={condition} onChange={onChange} pressureOptions={pressureOptions} />}
      {conditionType === "entity_count" && condition && <EntityCountFields condition={condition} onChange={onChange} entityKindOptions={entityKindOptions} />}
      {conditionType === "tag_exists" && condition && <TagExistsFields condition={condition} onChange={onChange} availableRefs={availableRefs} tagRegistry={tagRegistry} />}
      {conditionType === "random_chance" && (
        <div className="form-group"><label className="label">Chance (0-1)<NumberInput value={condition?.chance ?? 0.5} onChange={handleChance} step={0.1} placeholder="0.5" /></label></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubtypeOverrideRow
// ---------------------------------------------------------------------------

interface SubtypeOverrideRowProps {
  readonly refId: string;
  readonly kind: string | undefined;
  readonly currentOverride: string | undefined;
  readonly schema: Schema | undefined;
  readonly onOverride: (ref: string, subtype: string | undefined) => void;
}

const SubtypeOverrideRow = React.memo(function SubtypeOverrideRow({
  refId, kind, currentOverride, schema, onOverride,
}: Readonly<SubtypeOverrideRowProps>) {
  const subtypeOptions = useMemo(
    () => (kind ? getSubtypeOptionsFromSchema(schema, kind) : []),
    [kind, schema],
  );
  const options = useMemo(
    () => [{ value: "", label: "No override" }, ...subtypeOptions],
    [subtypeOptions],
  );
  const handleChange = useCallback(
    (v: string) => onOverride(refId, v || undefined),
    [refId, onOverride],
  );
  return (
    <div className="form-grid mb-md">
      <div className="form-group"><span className="label">{refId}</span><div className="form-help-text">{kind ?? "Unknown kind"}</div></div>
      <ReferenceDropdown label="Override Subtype" value={currentOverride ?? ""} onChange={handleChange} options={options} placeholder="No override" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// PressureModRow
// ---------------------------------------------------------------------------

interface PressureModRowProps {
  readonly update: { type?: string; pressureId?: string; delta?: number };
  readonly index: number;
  readonly stateUpdates: Array<{ type?: string; pressureId?: string; delta?: number }>;
  readonly pressureOptions: SelectOption[];
  readonly updateEffects: (key: string, value: unknown) => void;
}

const PressureModRow = React.memo(function PressureModRow({
  update, index, stateUpdates, pressureOptions, updateEffects,
}: Readonly<PressureModRowProps>) {
  const handlePressure = useCallback(
    (v: string) => {
      const u = [...stateUpdates];
      u[index] = { ...update, pressureId: v };
      updateEffects("stateUpdates", u);
    },
    [stateUpdates, index, update, updateEffects],
  );
  const handleDelta = useCallback(
    (v: number | string) => {
      const u = [...stateUpdates];
      u[index] = { ...update, delta: Number(v) || 0 };
      updateEffects("stateUpdates", u);
    },
    [stateUpdates, index, update, updateEffects],
  );
  const handleRemove = useCallback(
    () => updateEffects("stateUpdates", stateUpdates.filter((_, i) => i !== index)),
    [stateUpdates, index, updateEffects],
  );
  return (
    <div className="item-card mb-md">
      <div className="ct-step-pad">
        <div className="form-row-with-delete">
          <div className="form-row-fields">
            <ReferenceDropdown label="Pressure" value={update.pressureId ?? ""} onChange={handlePressure} options={pressureOptions} placeholder="Select pressure..." />
            <div className="form-group"><label className="label">Delta<NumberInput value={update.delta} onChange={handleDelta} placeholder="0" /></label></div>
          </div>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>&times;</button>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// VariantEffectsEditor
// ---------------------------------------------------------------------------

interface VariantEffectsEditorProps {
  readonly effects: VariantEffects | undefined;
  readonly onChange: (effects: VariantEffects) => void;
  readonly creationRefs: string[];
  readonly creationRules: CreationItem[];
  readonly pressureOptions: SelectOption[];
  readonly tagRegistry: TagRegistryEntry[];
  readonly schema: Schema | undefined;
}

function VariantEffectsEditor({
  effects, onChange, creationRefs, creationRules, pressureOptions, tagRegistry, schema,
}: Readonly<VariantEffectsEditorProps>) {
  const currentEffects = useMemo(() => effects ?? {}, [effects]);
  const [selectedEntity, setSelectedEntity] = useState(creationRefs[0] ?? "");

  const updateEffects = useCallback(
    (key: string, value: unknown) => {
      const next = { ...currentEffects } as Record<string, unknown>;
      if (value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value as object).length === 0) || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      onChange(next as VariantEffects);
    },
    [currentEffects, onChange],
  );

  const getKindForRef = useCallback(
    (ref: string) => creationRules.find((r) => r.entityRef === ref)?.kind,
    [creationRules],
  );

  const subtypeOverrides = useMemo(() => currentEffects.subtype ?? {}, [currentEffects.subtype]);

  const setSubtypeOverride = useCallback(
    (ref: string, subtype: string | undefined) => {
      const next = { ...subtypeOverrides };
      if (subtype) next[ref] = subtype;
      else delete next[ref];
      updateEffects("subtype", next);
    },
    [subtypeOverrides, updateEffects],
  );

  const allTags = useMemo(() => {
    const tags: Array<{ ref: string; tag: string }> = [];
    if (currentEffects.tags) {
      Object.entries(currentEffects.tags).forEach(([ref, tagMap]) => {
        Object.keys(tagMap).forEach((tag) => { if (tagMap[tag]) tags.push({ ref, tag }); });
      });
    }
    return tags;
  }, [currentEffects.tags]);

  const addTag = useCallback(
    (ref: string, tag: string) => {
      if (!ref || !tag) return;
      const next = { ...(currentEffects.tags ?? {}) };
      next[ref] = { ...(next[ref] ?? {}), [tag]: true };
      updateEffects("tags", next);
    },
    [currentEffects.tags, updateEffects],
  );

  const removeTag = useCallback(
    (ref: string, tag: string) => {
      const next = { ...(currentEffects.tags ?? {}) };
      if (next[ref]) {
        delete next[ref][tag];
        if (Object.keys(next[ref]).length === 0) delete next[ref];
      }
      updateEffects("tags", next);
    },
    [currentEffects.tags, updateEffects],
  );

  const refOptions = useMemo(() => creationRefs.map((r) => ({ value: r, label: r })), [creationRefs]);
  const emptyTagValue = useMemo<string[]>(() => [], []);
  const handleTagSelect = useCallback(
    (tags: string[]) => { if (tags.length > 0 && selectedEntity) addTag(selectedEntity, tags[0]); },
    [selectedEntity, addTag],
  );
  const handleAddPressure = useCallback(() => {
    updateEffects("stateUpdates", [
      ...(currentEffects.stateUpdates ?? []),
      { type: "modify_pressure", pressureId: pressureOptions[0]?.value ?? "", delta: -10 },
    ]);
  }, [currentEffects.stateUpdates, pressureOptions, updateEffects]);

  return (
    <div>
      <div className="ct-nested-panel">
        <div className="nested-title">Subtype Overrides</div>
        <div className="form-help-text mb-md">Override the subtype of created entities when this variant applies.</div>
        {creationRefs.length > 0
          ? creationRefs.map((ref) => <SubtypeOverrideRow key={ref} refId={ref} kind={getKindForRef(ref)} currentOverride={subtypeOverrides[ref]} schema={schema} onOverride={setSubtypeOverride} />)
          : <div className="form-help-text ct-italic">Define entity creation rules first to override subtypes.</div>}
      </div>
      <div className="ct-nested-panel mt-xl">
        <div className="nested-title">Additional Tags</div>
        <div className="form-help-text mb-md">Add tags to created entities when this variant applies.</div>
        {allTags.length > 0 && (
          <div className="ct-tag-flex">
            {allTags.map(({ ref, tag }, idx) => (
              <div key={idx} className="chip"><span className="ct-tag-ref">{ref}:</span><span>{tag}</span><button className="chip-remove" onClick={() => removeTag(ref, tag)}>&times;</button></div>
            ))}
          </div>
        )}
        {creationRefs.length > 0
          ? (
            <div className="form-grid">
              <ReferenceDropdown label="Entity" value={selectedEntity} onChange={setSelectedEntity} options={refOptions} placeholder="Select entity..." />
              <div className="form-group"><label className="label">Tag<TagSelector value={emptyTagValue} onChange={handleTagSelect} tagRegistry={tagRegistry} placeholder="Select or type tag..." singleSelect /></label></div>
            </div>
          )
          : <div className="form-help-text ct-italic">Define entity creation rules first to add variant tags.</div>}
      </div>
      <div className="ct-nested-panel mt-xl">
        <div className="nested-title">Pressure Modifications</div>
        <div className="form-help-text mb-md">Modify pressure values when this variant applies.</div>
        {(currentEffects.stateUpdates ?? []).map((update, idx) => (
          <PressureModRow key={idx} update={update} index={idx} stateUpdates={currentEffects.stateUpdates!} pressureOptions={pressureOptions} updateEffects={updateEffects} />
        ))}
        <button className="btn-add" onClick={handleAddPressure}>+ Add Pressure Modification</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantCard
// ---------------------------------------------------------------------------

interface VariantCardProps {
  readonly variant: Variant;
  readonly onChange: (variant: Variant) => void;
  readonly onRemove: () => void;
  readonly pressureOptions: SelectOption[];
  readonly entityKindOptions: SelectOption[];
  readonly creationRefs: string[];
  readonly creationRules: CreationItem[];
  readonly tagRegistry: TagRegistryEntry[];
  readonly schema: Schema | undefined;
}

function VariantCard({
  variant, onChange, onRemove, pressureOptions, entityKindOptions, creationRefs, creationRules, tagRegistry, schema,
}: Readonly<VariantCardProps>) {
  const { expanded, headerProps } = useExpandBoolean();
  const summary = useMemo(() => getConditionSummary(variant.when), [variant.when]);
  const handleName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...variant, name: e.target.value }), [variant, onChange]);
  const handleCondition = useCallback((when: VariantCondition) => onChange({ ...variant, when }), [variant, onChange]);
  const handleEffects = useCallback((apply: VariantEffects) => onChange({ ...variant, apply }), [variant, onChange]);
  const handleRemove = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onRemove(); }, [onRemove]);
  const conditionRefs = useMemo(() => ["$target", ...creationRefs], [creationRefs]);

  return (
    <div className="item-card">
      <div className="item-card-header" {...headerProps}>
        <div className="item-card-icon item-card-icon-variant">&#x26A1;</div>
        <div className="item-card-info">
          <div className="item-card-title">{variant.name ?? "Unnamed Variant"}</div>
          <div className="item-card-subtitle">{summary}</div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? "\u25B2" : "\u25BC"}</button>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>&times;</button>
        </div>
      </div>
      {expanded && (
        <div className="item-card-body">
          <div className="form-group">
            <label htmlFor="variant-name" className="label">Variant Name</label>
            <input id="variant-name" type="text" value={variant.name ?? ""} onChange={handleName} className="input" placeholder="e.g., Resource Site" />
          </div>
          <div className="mt-xl">
            <span className="label">Condition</span>
            <div className="form-help-text">When should this variant apply?</div>
            <VariantConditionEditor condition={variant.when} onChange={handleCondition} pressureOptions={pressureOptions} entityKindOptions={entityKindOptions} availableRefs={conditionRefs} tagRegistry={tagRegistry} />
          </div>
          <div className="mt-xl">
            <span className="label">Effects</span>
            <div className="form-help-text">What modifications to apply when this variant is selected.</div>
            <VariantEffectsEditor effects={variant.apply} onChange={handleEffects} creationRefs={creationRefs} creationRules={creationRules} pressureOptions={pressureOptions} tagRegistry={tagRegistry} schema={schema} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantsSection
// ---------------------------------------------------------------------------

interface VariantsSectionProps {
  readonly generator: Generator;
  readonly onChange: (generator: Generator) => void;
  readonly pressures: Pressure[];
  readonly schema: Schema | undefined;
  readonly tagRegistry: TagRegistryEntry[];
}

function VariantsSection({
  generator, onChange, pressures, schema, tagRegistry,
}: Readonly<VariantsSectionProps>) {
  const variants = useMemo<VariantsConfig>(
    () => generator.variants ?? { selection: "first_match", options: [] },
    [generator.variants],
  );

  const pressureOptions = useMemo(
    () => (pressures ?? []).map((p) => ({ value: p.id, label: p.name ?? p.id })),
    [pressures],
  );

  const entityKindOptions = useMemo(
    () => (schema?.entityKinds ?? []).map((ek) => ({ value: ek.kind, label: ek.description ?? ek.kind })),
    [schema],
  );

  const creationRules = useMemo(() => generator.creation ?? [], [generator.creation]);
  const creationRefs = useMemo(() => creationRules.map((c) => c.entityRef).filter(Boolean), [creationRules]);

  const updateVariants = useCallback(
    (newVariants: VariantsConfig) => {
      if (newVariants.options.length === 0) {
        const rest = { ...generator };
        delete rest.variants;
        onChange(rest);
      } else {
        onChange({ ...generator, variants: newVariants });
      }
    },
    [generator, onChange],
  );

  const addVariant = useCallback(() => {
    updateVariants({
      ...variants,
      options: [...variants.options, { name: `Variant ${variants.options.length + 1}`, when: { type: "always" }, apply: {} }],
    });
  }, [variants, updateVariants]);

  const handleSelection = useCallback(
    (v: string) => updateVariants({ ...variants, selection: v }),
    [variants, updateVariants],
  );

  const handleChange = useCallback(
    (idx: number, updated: Variant) => {
      const opts = [...variants.options];
      opts[idx] = updated;
      updateVariants({ ...variants, options: opts });
    },
    [variants, updateVariants],
  );

  const handleRemove = useCallback(
    (idx: number) => updateVariants({ ...variants, options: variants.options.filter((_, i) => i !== idx) }),
    [variants, updateVariants],
  );

  return (
    <div className="section mt-2xl">
      <div className="section-title"><span>&#x26A1;</span> Conditional Variants</div>
      <div className="section-desc">Define variants that modify tags or pressure effects based on world state.</div>
      {variants.options.length > 0 && (
        <div className="mb-xl">
          <ReferenceDropdown label="Selection Mode" value={variants.selection} onChange={handleSelection} options={SELECTION_MODE_OPTIONS} />
        </div>
      )}
      {variants.options.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#x26A1;</div>
          <div className="empty-state-title">No variants defined</div>
          <div className="empty-state-desc">Add variants to make this template produce different outcomes based on world state.</div>
        </div>
      ) : (
        variants.options.map((v, idx) => (
          <VariantCard key={idx} variant={v} onChange={(u) => handleChange(idx, u)} onRemove={() => handleRemove(idx)} pressureOptions={pressureOptions} entityKindOptions={entityKindOptions} creationRefs={creationRefs} creationRules={creationRules} tagRegistry={tagRegistry} schema={schema} />
        ))
      )}
      <button className="btn-add" onClick={addVariant}>+ Add Variant</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreationTab - Main tab component
// ---------------------------------------------------------------------------

interface CreationTabProps {
  readonly generator: Generator;
  readonly onChange: (generator: Generator) => void;
  readonly schema: Schema | undefined;
  readonly tagRegistry: TagRegistryEntry[];
  readonly onAddToRegistry?: (tag: string) => void;
  readonly pressures: Pressure[];
}

export function CreationTab({
  generator, onChange, schema, tagRegistry = [], onAddToRegistry, pressures = [],
}: Readonly<CreationTabProps>) {
  const creation = useMemo(() => generator.creation ?? [], [generator.creation]);

  const availableRefs = useMemo(() => {
    const refs = ["$target"];
    Object.keys(generator.variables ?? {}).forEach((v) => refs.push(v));
    creation.forEach((c) => { if (c.entityRef && !refs.includes(c.entityRef)) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, creation]);

  const culturesById = useMemo(() => {
    const map: Record<string, Culture> = {};
    (schema?.cultures ?? []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [schema?.cultures]);

  const cultureIds = useMemo(() => Object.keys(culturesById), [culturesById]);

  const handleAdd = useCallback(() => {
    onChange({
      ...generator,
      creation: [...creation, { entityRef: `$entity${creation.length + 1}`, kind: "npc", prominence: "marginal" }],
    });
  }, [creation, generator, onChange]);

  const handleChange = useCallback(
    (index: number, updated: CreationItem) => {
      const next = [...creation];
      next[index] = updated;
      onChange({ ...generator, creation: next });
    },
    [creation, generator, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => onChange({ ...generator, creation: creation.filter((_, i) => i !== index) }),
    [creation, generator, onChange],
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Creation</div>
        <div className="section-desc">
          Define entities that this generator creates. Each entity gets a reference (like <code className="inline-code">$hero</code>) that can be used in relationships.
        </div>
        {creation.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#x2728;</div>
            <div className="empty-state-title">No entities created</div>
            <div className="empty-state-desc">This generator only modifies existing entities. Add creation rules to spawn new entities.</div>
          </div>
        ) : (
          creation.map((item, index) => (
            <CreationCard key={index} item={item} onChange={(u) => handleChange(index, u)} onRemove={() => handleRemove(index)} schema={schema} availableRefs={availableRefs} culturesById={culturesById} cultureIds={cultureIds} generator={generator} tagRegistry={tagRegistry} onAddToRegistry={onAddToRegistry} />
          ))
        )}
        <button className="btn-add" onClick={handleAdd}>+ Add Entity Creation</button>
      </div>
      <VariantsSection generator={generator} onChange={onChange} pressures={pressures} schema={schema} tagRegistry={tagRegistry} />
    </div>
  );
}

export default CreationTab;
