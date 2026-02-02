import type { WorldState } from '../types/world.ts';

const MAX_ISSUES = 20;

export function validateWorldData(worldData: WorldState): string[] {
  const issues: string[] = [];
  let overflow = 0;

  const addIssue = (message: string) => {
    if (issues.length < MAX_ISSUES) {
      issues.push(message);
    } else {
      overflow += 1;
    }
  };

  if (!worldData?.schema) {
    addIssue('World data is missing schema.');
    return issues;
  }

  const { schema } = worldData;

  if (!schema.entityKinds || schema.entityKinds.length === 0) {
    addIssue('Schema requires entityKinds.');
  }

  if (!schema.relationshipKinds || schema.relationshipKinds.length === 0) {
    addIssue('Schema requires relationshipKinds.');
  }

  if (!schema.cultures || schema.cultures.length === 0) {
    addIssue('Schema requires cultures.');
  }

  if (!schema.uiConfig) {
    addIssue('Schema requires uiConfig.');
  }

  const prominenceLevels = schema.uiConfig?.prominenceLevels;
  const prominenceColors = schema.uiConfig?.prominenceColors;

  if (!prominenceLevels || prominenceLevels.length === 0) {
    addIssue('Schema.uiConfig.prominenceLevels is required.');
  }

  if (!prominenceColors || Object.keys(prominenceColors).length === 0) {
    addIssue('Schema.uiConfig.prominenceColors is required.');
  }

  if (prominenceLevels && prominenceColors) {
    prominenceLevels.forEach((level) => {
      if (!prominenceColors[level]) {
        addIssue(`Schema.uiConfig.prominenceColors missing "${level}".`);
      }
    });
  }

  const axisIds = new Set((schema.axisDefinitions || []).map(axis => axis.id));
  const kindById = new Map(schema.entityKinds?.map(kind => [kind.kind, kind]));
  const cultureIds = new Set(schema.cultures?.map(culture => culture.id));
  const relationshipKinds = new Set(schema.relationshipKinds?.map(kind => kind.kind));

  schema.entityKinds?.forEach((kind) => {
    if (!kind.style?.color) {
      addIssue(`Entity kind "${kind.kind}" is missing style.color.`);
    }

    kind.requiredRelationships?.forEach((rule) => {
      if (!relationshipKinds.has(rule.kind)) {
        addIssue(`Entity kind "${kind.kind}" requires unknown relationship "${rule.kind}".`);
      }
    });

    const axes = kind.semanticPlane?.axes;
    const axisRefs = [axes?.x?.axisId, axes?.y?.axisId, axes?.z?.axisId].filter(Boolean) as string[];
    axisRefs.forEach((axisId) => {
      if (!axisIds.has(axisId)) {
        addIssue(`Axis "${axisId}" referenced by kind "${kind.kind}" is missing in schema.axisDefinitions.`);
      }
    });

    kind.semanticPlane?.regions?.forEach((region) => {
      if (!region.color) {
        addIssue(`Region "${region.id}" in kind "${kind.kind}" is missing color.`);
      }
    });
  });

  schema.cultures?.forEach((culture) => {
    if (!culture.color) {
      addIssue(`Culture "${culture.id}" is missing color.`);
    }
  });

  if (worldData.coordinateState?.emergentRegions) {
    Object.entries(worldData.coordinateState.emergentRegions).forEach(([kind, regions]) => {
      regions.forEach((region) => {
        if (!region.color) {
          addIssue(`Emergent region "${region.id}" for kind "${kind}" is missing color.`);
        }
      });
    });
  }

  worldData.hardState.forEach((entity) => {
    if (!kindById.has(entity.kind)) {
      addIssue(`Entity "${entity.id}" references unknown kind "${entity.kind}".`);
    }

    if (entity.culture && !cultureIds.has(entity.culture)) {
      addIssue(`Entity "${entity.id}" references unknown culture "${entity.culture}".`);
    }

    if (prominenceLevels) {
      if (typeof entity.prominence === 'string') {
        if (!prominenceLevels.includes(entity.prominence)) {
          addIssue(`Entity "${entity.id}" uses prominence "${entity.prominence}" not in schema.uiConfig.prominenceLevels.`);
        }
      } else if (typeof entity.prominence === 'number') {
        if (!Number.isFinite(entity.prominence) || entity.prominence < 0 || entity.prominence > 5) {
          addIssue(`Entity "${entity.id}" has invalid numeric prominence "${entity.prominence}".`);
        }
      } else {
        addIssue(`Entity "${entity.id}" has invalid prominence "${entity.prominence}".`);
      }
    }

    const coords = entity.coordinates;
    if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number' || typeof coords.z !== 'number') {
      addIssue(`Entity "${entity.id}" is missing valid coordinates.`);
    }
  });

  worldData.relationships.forEach((rel) => {
    if (rel.kind && !relationshipKinds.has(rel.kind)) {
      addIssue(`Relationship "${rel.kind}" is not defined in schema.relationshipKinds.`);
    }
  });

  if (overflow > 0) {
    issues.push(`...and ${overflow} more issues.`);
  }

  return issues;
}
