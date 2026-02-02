import { EngineConfig, Graph } from '../engine/types';
import { HardState } from '../core/worldTypes';

/**
 * Validation result for a single check
 */
export interface ValidationResult {
  name: string;
  passed: boolean;
  failureCount: number;
  details: string;
  failedEntities?: HardState[];
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  totalChecks: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Validate that all entities have at least one connection (incoming or outgoing)
 */
export function validateConnectedEntities(graph: Graph): ValidationResult {
  const unconnected = graph.getEntities().filter(entity => {
    const hasOutgoing = graph.getEntityRelationships(entity.id, 'src').length > 0;
    const hasIncoming = graph.getEntityRelationships(entity.id, 'dst').length > 0;

    return !hasOutgoing && !hasIncoming;
  });

  const passed = unconnected.length === 0;

  let details = passed
    ? 'All entities have at least one connection'
    : `${unconnected.length} entities have no connections:\n`;

  if (!passed) {
    // Group by kind for summary
    const byKind = new Map<string, number>();
    unconnected.forEach(e => {
      const key = `${e.kind}:${e.subtype}`;
      byKind.set(key, (byKind.get(key) || 0) + 1);
    });

    byKind.forEach((count, kind) => {
      details += `  - ${kind}: ${count}\n`;
    });

    // Add sample entities
    details += '\nSample unconnected entities:\n';
    unconnected.slice(0, 5).forEach(e => {
      details += `  - ${e.name} (${e.kind}:${e.subtype}, created tick ${e.createdAt})\n`;
    });
  }

  return {
    name: 'Connected Entities',
    passed,
    failureCount: unconnected.length,
    details,
    failedEntities: unconnected
  };
}

/**
 * Validate that entities have required structural relationships.
 * Uses canonical schema requirements (no hardcoded entity kinds).
 */
export function validateNPCStructure(graph: Graph, config: EngineConfig): ValidationResult {
  const invalidEntities: HardState[] = [];
  const missingByKindSubtype = new Map<string, Map<string, number>>();
  const kindsWithRequirements = config.schema.entityKinds.filter(
    kindDef => kindDef.requiredRelationships && kindDef.requiredRelationships.length > 0
  );

  if (kindsWithRequirements.length === 0) {
    return {
      name: 'Entity Structure',
      passed: true,
      failureCount: 0,
      details: 'No requiredRelationships defined in schema'
    };
  }

  // Check all entities against schema requirements
  for (const entity of graph.getEntities()) {
    const kindDef = config.schema.entityKinds.find(kind => kind.kind === entity.kind);
    const required = kindDef?.requiredRelationships;
    if (!required || required.length === 0) continue;

    const relationships = graph.getEntityRelationships(entity.id, 'both', { includeHistorical: true });
    const missing = required.filter(rule => !relationships.some(rel => rel.kind === rule.kind));

    if (missing.length > 0) {
      invalidEntities.push(entity);

      // Track missing relationships by kind:subtype
      const key = `${entity.kind}:${entity.subtype}`;
      if (!missingByKindSubtype.has(key)) {
        missingByKindSubtype.set(key, new Map());
      }
      const subtypeMap = missingByKindSubtype.get(key)!;

      missing.forEach(rule => {
        subtypeMap.set(rule.kind, (subtypeMap.get(rule.kind) || 0) + 1);
      });
    }
  }

  const passed = invalidEntities.length === 0;

  let details = passed
    ? 'All entities have required relationships'
    : `${invalidEntities.length} entities missing required relationships:\n`;

  if (!passed) {
    // Group by kind:subtype and missing relationships
    missingByKindSubtype.forEach((relMap, kindSubtype) => {
      relMap.forEach((count, relKind) => {
        details += `  - ${kindSubtype}: ${count} (missing ${relKind})\n`;
      });
    });
  }

  return {
    name: 'Entity Structure',
    passed,
    failureCount: invalidEntities.length,
    details,
    failedEntities: invalidEntities
  };
}

/**
 * Validate that all relationship references point to existing entities
 */
export function validateRelationshipIntegrity(graph: Graph): ValidationResult {
  const brokenRelationships: string[] = [];

  graph.getRelationships().forEach((rel, index) => {
    const srcExists = graph.getEntity(rel.src) !== undefined;
    const dstExists = graph.getEntity(rel.dst) !== undefined;

    if (!srcExists || !dstExists) {
      const srcName = graph.getEntity(rel.src)?.name || rel.src;
      const dstName = graph.getEntity(rel.dst)?.name || rel.dst;
      brokenRelationships.push(
        `[${index}] ${rel.kind}: ${srcName} → ${dstName} ` +
        `(${!srcExists ? 'src missing' : ''} ${!dstExists ? 'dst missing' : ''})`
      );
    }
  });

  const passed = brokenRelationships.length === 0;

  let details = passed
    ? 'All relationships reference existing entities'
    : `${brokenRelationships.length} broken relationships:\n`;

  if (!passed) {
    brokenRelationships.slice(0, 10).forEach(msg => {
      details += `  - ${msg}\n`;
    });
    if (brokenRelationships.length > 10) {
      details += `  ... and ${brokenRelationships.length - 10} more\n`;
    }
  }

  return {
    name: 'Relationship Integrity',
    passed,
    failureCount: brokenRelationships.length,
    details
  };
}

// validateLorePresence moved to @illuminator

/**
 * Run all validators and generate a complete report
 */
export function validateWorld(graph: Graph, config: EngineConfig): ValidationReport {
  const results: ValidationResult[] = [
    validateConnectedEntities(graph),
    validateNPCStructure(graph, config),
    validateRelationshipIntegrity(graph)
    // validateLorePresence moved to @illuminator
  ];

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    totalChecks: results.length,
    passed,
    failed,
    results
  };
}
