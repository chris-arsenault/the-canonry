/**
 * getRuleSummary - Pure function that generates a human-readable summary for a rule
 *
 * Split into category-specific sub-functions to stay within complexity limits.
 */

import type {
  ApplicabilityRule,
  EntityCountRule,
  PressureRule,
  PressureAnyAboveRule,
  PressureCompareRule,
  RelationshipCountRule,
  RelationshipExistsRule,
  StatusRule,
  GrowthPhasesCompleteRule,
  EraMatchRule,
  RandomChanceRule,
  GraphPathRule,
  LogicalRule,
} from './applicabilityRuleTypes';

// ---------------------------------------------------------------------------
// Pressure summaries
// ---------------------------------------------------------------------------

function summarizePressure(rule: PressureRule): string {
  return `${rule.pressureId || '?'} in [${rule.min ?? '-\u221E'}, ${rule.max ?? '\u221E'}]`;
}

function summarizePressureAnyAbove(rule: PressureAnyAboveRule): string {
  return `Any of [${rule.pressureIds?.join(', ') || '?'}] > ${rule.threshold ?? '?'}`;
}

function summarizePressureCompare(rule: PressureCompareRule): string {
  return `${rule.pressureA || '?'} ${rule.operator || '>'} ${rule.pressureB || '?'}`;
}

// ---------------------------------------------------------------------------
// Entity / relationship summaries
// ---------------------------------------------------------------------------

function summarizeEntityCount(rule: EntityCountRule): string {
  const kindSpec = `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''}`;
  const minPart = rule.min !== undefined ? `>= ${rule.min}` : '';
  const maxPart = rule.max !== undefined ? ` <= ${rule.max}` : '';
  return `${kindSpec} ${minPart}${maxPart}`;
}

function summarizeRelationshipCount(rule: RelationshipCountRule): string {
  const minPart = rule.min !== undefined ? `>= ${rule.min}` : '';
  const maxPart = rule.max !== undefined ? ` <= ${rule.max}` : '';
  return `${rule.relationshipKind || 'any'} count ${minPart}${maxPart}`;
}

function summarizeRelationshipExists(rule: RelationshipExistsRule): string {
  const targetSuffix = rule.targetKind ? ` to ${rule.targetKind}` : '';
  return `${rule.relationshipKind || '?'} exists${targetSuffix}`;
}

// ---------------------------------------------------------------------------
// Temporal summaries
// ---------------------------------------------------------------------------

function summarizeGrowthPhases(rule: GrowthPhasesCompleteRule): string {
  const eraSuffix = rule.eraId ? ` in ${rule.eraId}` : '';
  return `${rule.minPhases ?? '?'} growth phases${eraSuffix}`;
}

function summarizeEraMatch(rule: EraMatchRule): string {
  return rule.eras?.length ? rule.eras.join(', ') : 'No eras selected';
}

function summarizeRandomChance(rule: RandomChanceRule): string {
  return `${Math.round((rule.chance ?? 0.5) * 100)}% chance`;
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

type SummaryFn = (rule: never) => string;

const SUMMARY_MAP: Record<string, SummaryFn> = {
  entity_count: summarizeEntityCount as SummaryFn,
  pressure: summarizePressure as SummaryFn,
  pressure_any_above: summarizePressureAnyAbove as SummaryFn,
  pressure_compare: summarizePressureCompare as SummaryFn,
  relationship_count: summarizeRelationshipCount as SummaryFn,
  relationship_exists: summarizeRelationshipExists as SummaryFn,
  growth_phases_complete: summarizeGrowthPhases as SummaryFn,
  era_match: summarizeEraMatch as SummaryFn,
  random_chance: summarizeRandomChance as SummaryFn,
};

function summarizeSimpleRule(rule: ApplicabilityRule): string {
  switch (rule.type) {
    case 'tag_exists':
      return `has tag "${rule.tag || '?'}"`;
    case 'tag_absent':
      return `missing tag "${rule.tag || '?'}"`;
    case 'status':
      return (rule as StatusRule).not
        ? `status != ${rule.status || '?'}`
        : `status = ${rule.status || '?'}`;
    case 'prominence':
      return `prominence ${rule.min || '?'}-${rule.max || '?'}`;
    case 'time_elapsed':
      return `${rule.minTicks || '?'} ticks since ${rule.since || 'updated'}`;
    case 'cooldown_elapsed':
      return `${rule.cooldownTicks ?? '?'} ticks since last run`;
    case 'creations_per_epoch':
      return `max ${rule.maxPerEpoch ?? '?'} per epoch`;
    case 'graph_path':
      return `graph path (${(rule as GraphPathRule).assert?.check || 'exists'})`;
    case 'entity_exists':
      return `entity ${rule.entity || '?'} exists`;
    case 'entity_has_relationship':
      return `${rule.entity || '?'} has ${rule.relationshipKind || '?'} relationship`;
    case 'or':
    case 'and':
      return `${(rule as LogicalRule).conditions?.length || 0} sub-rules`;
    case 'always':
      return 'always';
    default:
      return rule.type;
  }
}

export function getRuleSummary(rule: ApplicabilityRule): string {
  const mapFn = SUMMARY_MAP[rule.type];
  if (mapFn) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SummaryFn uses `never` for generic dispatch
    return mapFn(rule as never);
  }
  return summarizeSimpleRule(rule);
}
