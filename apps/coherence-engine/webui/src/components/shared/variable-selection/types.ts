/**
 * Shared types and constants for VariableSelectionEditor components.
 */

export interface DropdownOption {
  value: string;
  label: string;
}

export interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: { id: string; name?: string }[];
}

export interface Schema {
  entityKinds?: EntityKindDef[];
  relationshipKinds?: { kind: string; description?: string }[];
}

export interface PathStep {
  from?: string;
  via: string;
  direction: string;
  targetKind?: string;
}

export interface FromSpec {
  relatedTo: string;
  relationshipKind: string;
  direction: string;
}

export interface PathSpec {
  path: PathStep[];
}

export interface SelectionFilter {
  type: string;
  [key: string]: unknown;
}

export interface SelectConfig {
  from?: string | FromSpec | PathSpec;
  kind?: string;
  subtypes?: string[];
  pickStrategy?: string;
  maxResults?: number;
  status?: string;
  notStatus?: string;
  filters?: SelectionFilter[];
  preferFilters?: SelectionFilter[];
  [key: string]: unknown;
}

export type SelectionMode = "graph" | "path" | "related";

export function getSelectionMode(select: SelectConfig): SelectionMode {
  if (!select.from || select.from === "graph") return "graph";
  if (typeof select.from === "object" && "path" in select.from) return "path";
  if (typeof select.from === "object" && "relatedTo" in select.from)
    return "related";
  return "graph";
}

export const DIRECTION_OPTIONS: readonly DropdownOption[] = [
  { value: "both", label: "Both" },
  { value: "src", label: "Source (outgoing)" },
  { value: "dst", label: "Destination (incoming)" },
];

export const SELECT_FROM_OPTIONS: readonly DropdownOption[] = [
  { value: "graph", label: "Graph (by entity kind)" },
  { value: "related", label: "Related Entities (single hop)" },
  { value: "path", label: "Path Traversal (multi-hop)" },
];
