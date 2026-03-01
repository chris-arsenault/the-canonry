/**
 * Shared types and helpers for SelectionFilterCard and its sub-components.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface TagDefinition {
  readonly tag: string;
  readonly category: string;
  readonly rarity: string;
  readonly description?: string;
  readonly isAxis?: boolean;
}

export interface RelationshipKindDef {
  readonly kind: string;
  readonly description?: string;
}

export interface CultureDef {
  readonly id: string;
  readonly name?: string;
}

export interface FilterTypeConfig {
  readonly label: string;
  readonly icon: string;
  readonly color: string;
  readonly desc?: string;
}

export interface GraphPathAssert {
  readonly check: string;
  readonly path?: ReadonlyArray<Record<string, unknown>>;
  readonly count?: number;
  readonly constraints?: ReadonlyArray<Record<string, unknown>>;
}

/** Union of all fields that selection filters can carry. */
export interface SelectionFilter {
  readonly type: string;
  readonly tag?: string;
  readonly tags?: readonly string[];
  readonly value?: string;
  readonly culture?: string;
  readonly with?: string;
  readonly status?: string;
  readonly minProminence?: string;
  readonly kind?: string;
  readonly direction?: string;
  readonly entities?: readonly string[];
  readonly relationshipKind?: string;
  readonly assert?: GraphPathAssert;
}

export interface SelectionFilterSchema {
  readonly relationshipKinds?: readonly RelationshipKindDef[];
  readonly cultures?: readonly CultureDef[];
  readonly tagRegistry?: readonly TagDefinition[];
}

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DIRECTION_OPTIONS: readonly DropdownOption[] = [
  { value: "both", label: "Both" },
  { value: "src", label: "Outgoing" },
  { value: "dst", label: "Incoming" },
];

export const FALLBACK_TYPE_CONFIG: FilterTypeConfig = {
  label: "Unknown",
  icon: "\u2753",
  color: "#6b7280",
};

// ---------------------------------------------------------------------------
// Summary helpers — split into per-type functions to stay under complexity 10
// ---------------------------------------------------------------------------

function summarizeTagList(tags: readonly string[] | undefined): string {
  return (tags || []).join(", ") || "no tags";
}

function summarizeWithKind(
  kind: string | undefined,
  withRef: string | undefined,
  direction?: string,
): string {
  const withLabel = withRef ? ` with ${withRef}` : "";
  const dir = direction ? ` [${direction}]` : "";
  return `${kind || "?"}${withLabel}${dir}`;
}

type SummaryFn = (filter: SelectionFilter) => string;

const SUMMARY_MAP: Record<string, SummaryFn> = {
  has_tag: (f) => {
    const suffix = f.value !== undefined ? ` = ${f.value}` : "";
    return `${f.tag || "?"}${suffix}`;
  },
  has_tags: (f) => summarizeTagList(f.tags),
  has_any_tag: (f) => summarizeTagList(f.tags),
  lacks_any_tag: (f) => summarizeTagList(f.tags),
  lacks_tag: (f) => f.tag || "tag?",
  has_culture: (f) => f.culture || "culture?",
  matches_culture: (f) => `with ${f.with || "?"}`,
  has_status: (f) => f.status || "status?",
  has_prominence: (f) => f.minProminence || "prominence?",
  has_relationship: (f) => summarizeWithKind(f.kind, f.with, f.direction),
  lacks_relationship: (f) => summarizeWithKind(f.kind, f.with),
  exclude: (f) => `${(f.entities || []).length} excluded`,
  shares_related: (f) => `${f.relationshipKind || "?"} with ${f.with || "?"}`,
  graph_path: (f) => `graph path (${f.assert?.check || "exists"})`,
};

export function getFilterSummary(filter: SelectionFilter): string {
  const fn = SUMMARY_MAP[filter.type];
  return fn ? fn(filter) : "";
}
