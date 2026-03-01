/**
 * Utility functions, types and constants for MutationCard
 */

import {
  MUTATION_TYPE_META as RAW_META,
  MUTATION_TYPE_ORDER,
} from "../actions/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MutationTypeOption {
  value: string;
  label: string;
}

export interface EntityRefOption {
  value: string;
  label: string;
}

interface RelationshipKindDef {
  kind: string;
  description?: string;
}

interface TagDefinition {
  name: string;
  rarity: string;
  description?: string;
  isAxis?: boolean;
}

export interface MutationSchema {
  relationshipKinds: RelationshipKindDef[];
  tagRegistry: TagDefinition[];
}

export interface PressureEntry {
  id: string;
  name?: string;
}

export interface MutationTypeMeta {
  label: string;
  icon: string;
  color: string;
}

/**
 * Union of all possible fields across mutation types.
 * Each mutation type uses a subset of these fields.
 */
export interface Mutation {
  type: string;
  // modify_pressure
  pressureId?: string;
  delta?: number;
  // set_tag / remove_tag / change_status / adjust_prominence
  entity?: string;
  tag?: string;
  value?: string | number | boolean;
  valueFrom?: string;
  newStatus?: string;
  // create_relationship / adjust_relationship_strength
  kind?: string;
  src?: string;
  dst?: string;
  strength?: number;
  category?: string;
  bidirectional?: boolean;
  // archive_relationship
  relationshipKind?: string;
  with?: string;
  direction?: string;
  // transfer_relationship
  from?: string;
  to?: string;
  // for_each_related
  relationship?: string;
  targetKind?: string;
  targetSubtype?: string;
  actions?: Mutation[];
  // conditional
  thenActions?: Mutation[];
  elseActions?: Mutation[];
}

export interface MutationCardProps {
  readonly mutation: Mutation;
  readonly onChange: (mutation: Mutation) => void;
  readonly onRemove?: () => void;
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly entityOptions: ReadonlyArray<string | EntityRefOption>;
  readonly typeOptions: MutationTypeOption[];
  readonly createMutation?: (type: string) => Mutation;
  readonly titlePrefix?: string;
}

// ---------------------------------------------------------------------------
// Typed re-export of MUTATION_TYPE_META
// ---------------------------------------------------------------------------

const MUTATION_TYPE_META = RAW_META as Record<string, MutationTypeMeta>;

export { MUTATION_TYPE_META };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_MUTATION_TYPES: MutationTypeOption[] =
  MUTATION_TYPE_ORDER.map((key: string) => ({
    value: key,
    label: MUTATION_TYPE_META[key]?.label || key,
  }));

export const DIRECTION_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "both", label: "Both" },
  { value: "src", label: "Source (outgoing)" },
  { value: "dst", label: "Destination (incoming)" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeOptions(
  options: ReadonlyArray<string | EntityRefOption>,
): EntityRefOption[] {
  return options.map((opt) => {
    if (typeof opt === "string") return { value: opt, label: opt };
    return opt;
  });
}

export type TagValue = string | number | boolean | undefined;

/**
 * Parse a user-entered tag value string into its typed form.
 * Returns undefined for empty strings, booleans for "true"/"false",
 * numbers for numeric strings, or the raw string otherwise.
 */
export function parseTagValue(raw: string): TagValue {
  let result: TagValue = raw;
  if (raw === "") result = undefined;
  else if (raw === "true") result = true;
  else if (raw === "false") result = false;
  else if (!Number.isNaN(Number(raw))) result = Number(raw);
  return result;
}

export function formatDelta(delta: number | undefined | null): string {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return "0";
  const numeric = Number(delta);
  if (Number.isNaN(numeric)) return String(delta);
  return `${numeric >= 0 ? "+" : ""}${numeric}`;
}

// ---------------------------------------------------------------------------
// Summary helpers (split to reduce cyclomatic complexity)
// ---------------------------------------------------------------------------

/** Safe field access: return value or "?" placeholder */
function f(val: string | undefined): string {
  return val || "?";
}

function summarizeSetTag(mutation: Mutation): string {
  const val = mutation.value !== undefined ? ` = ${mutation.value}` : "";
  return `${f(mutation.entity)} tag ${f(mutation.tag)}${val}`;
}

function summarizeArchiveAll(mutation: Mutation): string {
  const dir = mutation.direction;
  const dirLabel = dir && dir !== "both" ? ` (${dir})` : "";
  return `${f(mutation.entity)} all ${f(mutation.relationshipKind)}${dirLabel}`;
}

function summarizeCreateRel(mutation: Mutation): string {
  const arrow = mutation.bidirectional ? "<->" : "->";
  return `${f(mutation.kind)} ${f(mutation.src)} ${arrow} ${f(mutation.dst)}`;
}

function summarizeEntity(mutation: Mutation): string {
  switch (mutation.type) {
    case "set_tag":
      return summarizeSetTag(mutation);
    case "remove_tag":
      return `${f(mutation.entity)} remove ${f(mutation.tag)}`;
    case "change_status":
      return `${f(mutation.entity)} -> ${f(mutation.newStatus)}`;
    case "adjust_prominence":
      return `${f(mutation.entity)} ${formatDelta(mutation.delta)}`;
    default:
      return "";
  }
}

function summarizeRelationship(mutation: Mutation): string {
  switch (mutation.type) {
    case "archive_relationship":
      return `${f(mutation.entity)} ${f(mutation.relationshipKind)} with ${f(mutation.with)}`;
    case "archive_all_relationships":
      return summarizeArchiveAll(mutation);
    case "adjust_relationship_strength":
      return `${f(mutation.kind)} ${f(mutation.src)} -> ${f(mutation.dst)} ${formatDelta(mutation.delta)}`;
    case "create_relationship":
      return summarizeCreateRel(mutation);
    case "transfer_relationship":
      return `${f(mutation.entity)} ${f(mutation.relationshipKind)} from ${f(mutation.from)} to ${f(mutation.to)}`;
    default:
      return "";
  }
}

function summarizeComposite(mutation: Mutation): string {
  switch (mutation.type) {
    case "for_each_related": {
      const actionCount = (mutation.actions || []).length;
      return `${f(mutation.relationship)} (${actionCount} action${actionCount !== 1 ? "s" : ""})`;
    }
    case "conditional": {
      const thenCount = (mutation.thenActions || []).length;
      const elseCount = (mutation.elseActions || []).length;
      return `then: ${thenCount}, else: ${elseCount}`;
    }
    default:
      return "";
  }
}

/**
 * Build a human-readable summary string for a mutation.
 */
export function getMutationSummary(mutation: Mutation): string {
  if (mutation.type === "modify_pressure") {
    return `${f(mutation.pressureId)} ${formatDelta(mutation.delta)}`;
  }
  if (mutation.type === "update_rate_limit") {
    return "track execution";
  }
  const entitySummary = summarizeEntity(mutation);
  if (entitySummary) return entitySummary;
  const relSummary = summarizeRelationship(mutation);
  if (relSummary) return relSummary;
  return summarizeComposite(mutation);
}
