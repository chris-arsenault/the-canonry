/**
 * Constants shared across ChroniclePanel sub-components.
 */

export const REFINEMENT_STEPS = new Set([
  "summary",
  "image_refs",
  "compare",
  "combine",
  "cover_image_scene",
  "cover_image",
]);

export const NAV_PAGE_SIZE = 10;

export interface SelectOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SelectOption[] = [
  { value: "created_desc", label: "Newest created" },
  { value: "created_asc", label: "Oldest created" },
  { value: "length_desc", label: "Longest" },
  { value: "length_asc", label: "Shortest" },
  { value: "type_asc", label: "Type A-Z" },
  { value: "type_desc", label: "Type Z-A" },
  { value: "era_asc", label: "Era (earliest)" },
  { value: "era_desc", label: "Era (latest)" },
];

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "not_started", label: "Not started" },
  { value: "generating", label: "Generating" },
  { value: "assembly_ready", label: "Assembly ready" },
  { value: "failed", label: "Failed" },
  { value: "complete", label: "Complete" },
];

export const FOCUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All focuses" },
  { value: "single", label: "Single" },
  { value: "ensemble", label: "Ensemble" },
];

export function buildTemporalDescription(
  focalEra: { name: string },
  tickRange: [number, number],
  scope: string,
  isMultiEra: boolean,
  eraCount: number,
): string {
  const duration = tickRange[1] - tickRange[0];
  const scopeDescriptions: Record<string, string> = {
    moment: "a brief moment",
    episode: "a short episode",
    arc: "an extended arc",
    saga: "an epic saga",
  };
  const scopeText = scopeDescriptions[scope] || "a span of time";
  if (isMultiEra) {
    return `${scopeText} spanning ${eraCount} eras, centered on the ${focalEra.name}`;
  }
  if (duration === 0) {
    return `a single moment during the ${focalEra.name}`;
  }
  return `${scopeText} during the ${focalEra.name} (${duration} ticks)`;
}
