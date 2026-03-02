import type { WorldState } from "../types/world.ts";
import type { CanonrySchemaSlice } from "@canonry/world-schema";

type Collector = (msg: string) => void;

const MAX_ISSUES = 20;

function validateRequiredCollections(schema: CanonrySchemaSlice, add: Collector): void {
  if (!schema.entityKinds || schema.entityKinds.length === 0) add("Schema requires entityKinds.");
  if (!schema.relationshipKinds || schema.relationshipKinds.length === 0) add("Schema requires relationshipKinds.");
  if (!schema.cultures || schema.cultures.length === 0) add("Schema requires cultures.");
  if (!schema.uiConfig) add("Schema requires uiConfig.");
}

function validateProminenceConfig(schema: CanonrySchemaSlice, add: Collector): void {
  const levels = schema.uiConfig?.prominenceLevels;
  const colors = schema.uiConfig?.prominenceColors;
  if (!levels || levels.length === 0) add("Schema.uiConfig.prominenceLevels is required.");
  if (!colors || Object.keys(colors).length === 0) add("Schema.uiConfig.prominenceColors is required.");
  if (levels && colors) levels.forEach((l) => { if (!colors[l]) add(`Schema.uiConfig.prominenceColors missing "${l}".`); });
}

function validateKindAxesAndRegions(
  kind: NonNullable<CanonrySchemaSlice["entityKinds"]>[number], axisIds: Set<string>, add: Collector
): void {
  const axes = kind.semanticPlane?.axes;
  ([axes?.x?.axisId, axes?.y?.axisId, axes?.z?.axisId].filter(Boolean) as string[]).forEach((id) => {
    if (!axisIds.has(id)) add(`Axis "${id}" referenced by kind "${kind.kind}" is missing in schema.axisDefinitions.`);
  });
  kind.semanticPlane?.regions?.forEach((r) => { if (!r.color) add(`Region "${r.id}" in kind "${kind.kind}" is missing color.`); });
}

function validateEntityKinds(schema: CanonrySchemaSlice, add: Collector): void {
  const axisIds = new Set((schema.axisDefinitions || []).map((a) => a.id));
  const relKinds = new Set(schema.relationshipKinds?.map((r) => r.kind));
  schema.entityKinds?.forEach((kind) => {
    if (!kind.style?.color) add(`Entity kind "${kind.kind}" is missing style.color.`);
    kind.requiredRelationships?.forEach((rule) => {
      if (!relKinds.has(rule.kind)) add(`Entity kind "${kind.kind}" requires unknown relationship "${rule.kind}".`);
    });
    validateKindAxesAndRegions(kind, axisIds, add);
  });
  schema.cultures?.forEach((c) => { if (!c.color) add(`Culture "${c.id}" is missing color.`); });
}

function validateEntities(worldData: WorldState, add: Collector): void {
  const kindById = new Set(worldData.schema.entityKinds?.map((k) => k.kind));
  const cultureIds = new Set(worldData.schema.cultures?.map((c) => c.id));
  const relKinds = new Set(worldData.schema.relationshipKinds?.map((r) => r.kind));
  const levels = worldData.schema.uiConfig?.prominenceLevels;
  worldData.hardState.forEach((entity) => {
    if (!kindById.has(entity.kind)) add(`Entity "${entity.id}" references unknown kind "${entity.kind}".`);
    if (entity.culture && !cultureIds.has(entity.culture)) add(`Entity "${entity.id}" references unknown culture "${entity.culture}".`);
    if (levels) validateProminence(entity.id, entity.prominence, levels, add);
    const c = entity.coordinates;
    if (!c || typeof c.x !== "number" || typeof c.y !== "number" || typeof c.z !== "number")
      add(`Entity "${entity.id}" is missing valid coordinates.`);
  });
  worldData.relationships.forEach((rel) => {
    if (rel.kind && !relKinds.has(rel.kind)) add(`Relationship "${rel.kind}" is not defined in schema.relationshipKinds.`);
  });
}

function validateProminence(id: string, prom: unknown, levels: string[], add: Collector): void {
  if (typeof prom === "string") {
    if (!levels.includes(prom)) add(`Entity "${id}" uses prominence "${prom}" not in schema.uiConfig.prominenceLevels.`);
  } else if (typeof prom === "number") {
    if (!Number.isFinite(prom) || prom < 0 || prom > 5) add(`Entity "${id}" has invalid numeric prominence "${String(prom)}".`);
  } else {
    add(`Entity "${id}" has invalid prominence "${String(prom)}".`);
  }
}

function validateEmergentRegions(worldData: WorldState, add: Collector): void {
  if (!worldData.coordinateState?.emergentRegions) return;
  Object.entries(worldData.coordinateState.emergentRegions).forEach(([kind, regions]) => {
    regions.forEach((r) => { if (!r.color) add(`Emergent region "${r.id}" for kind "${kind}" is missing color.`); });
  });
}

export function validateWorldData(worldData: WorldState): string[] {
  const issues: string[] = [];
  let overflow = 0;
  const add: Collector = (msg) => { if (issues.length < MAX_ISSUES) issues.push(msg); else overflow += 1; };
  if (!worldData?.schema) { add("World data is missing schema."); return issues; }
  validateRequiredCollections(worldData.schema, add);
  validateProminenceConfig(worldData.schema, add);
  validateEntityKinds(worldData.schema, add);
  validateEmergentRegions(worldData, add);
  validateEntities(worldData, add);
  if (overflow > 0) issues.push(`...and ${overflow} more issues.`);
  return issues;
}
