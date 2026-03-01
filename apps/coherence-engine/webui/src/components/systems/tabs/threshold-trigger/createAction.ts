/**
 * Factory for creating default mutation objects by type
 */

import type { Mutation, PressureEntry } from "./types";

const ENTITY_ACTION_DEFAULTS: Record<string, () => Mutation> = {
  set_tag: () => ({ type: "set_tag", entity: "$self", tag: "", value: true }),
  remove_tag: () => ({ type: "remove_tag", entity: "$self", tag: "" }),
  change_status: () => ({ type: "change_status", entity: "$self", newStatus: "" }),
  adjust_prominence: () => ({ type: "adjust_prominence", entity: "$self", delta: 0.25 }),
};

const RELATIONSHIP_ACTION_DEFAULTS: Record<string, () => Mutation> = {
  archive_relationship: () => ({
    type: "archive_relationship",
    entity: "$self",
    relationshipKind: "",
    direction: "both",
  }),
  adjust_relationship_strength: () => ({
    type: "adjust_relationship_strength",
    kind: "",
    src: "$self",
    dst: "$self",
    delta: 0.1,
  }),
  transfer_relationship: () => ({
    type: "transfer_relationship",
    entity: "$self",
    relationshipKind: "",
    from: "$self",
    to: "$self",
  }),
};

const COMPOSITE_ACTION_DEFAULTS: Record<string, () => Mutation> = {
  update_rate_limit: () => ({ type: "update_rate_limit" }),
  for_each_related: () => ({
    type: "for_each_related",
    relationship: "",
    direction: "both",
    actions: [],
  }),
  conditional: () => ({
    type: "conditional",
    thenActions: [],
    elseActions: [],
  }),
};

export function createAction(type: string, pressures: PressureEntry[]): Mutation {
  if (type === "modify_pressure") {
    return { type: "modify_pressure", pressureId: pressures[0]?.id || "", delta: 0 };
  }

  const entityFactory = ENTITY_ACTION_DEFAULTS[type];
  if (entityFactory) return entityFactory();

  const relFactory = RELATIONSHIP_ACTION_DEFAULTS[type];
  if (relFactory) return relFactory();

  const compositeFactory = COMPOSITE_ACTION_DEFAULTS[type];
  if (compositeFactory) return compositeFactory();

  return { type: "create_relationship", kind: "", src: "$self", dst: "$self", strength: 0.5 };
}
