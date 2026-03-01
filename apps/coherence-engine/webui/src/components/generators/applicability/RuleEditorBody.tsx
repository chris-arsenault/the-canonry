/**
 * RuleEditorBody - Dispatches to the correct rule-type-specific editor
 *
 * This component maps an ApplicabilityRule to the appropriate editor sub-component.
 * Extracted from ApplicabilityRuleCard to reduce complexity.
 * Dispatch is split into sub-functions to stay within complexity limits.
 */

import React from 'react';
import type { ApplicabilityRule, SelectOption, TagRegistryEntry, DomainSchema } from './applicabilityRuleTypes';
import {
  EntityCountEditor,
  PressureRangeEditor,
  PressureAnyAboveEditor,
  PressureCompareEditor,
  RelationshipCountEditor,
  RelationshipExistsEditor,
  TagEditor,
  StatusEditor,
  ProminenceEditor,
  TimeElapsedEditor,
  GrowthPhasesCompleteEditor,
  EraMatchEditor,
  RandomChanceEditor,
  CooldownElapsedEditor,
  CreationsPerEpochEditor,
  GraphPathRuleEditor,
  EntityExistsEditor,
  EntityHasRelationshipEditor,
} from './editors';

interface RuleEditorBodyProps {
  readonly rule: ApplicabilityRule;
  readonly updateField: (field: string, value: unknown) => void;
  readonly entityKindOptions: SelectOption[];
  readonly relationshipKindOptions: SelectOption[];
  readonly pressureOptions: SelectOption[];
  readonly eraOptions: SelectOption[];
  readonly tagRegistry: TagRegistryEntry[];
  readonly getSubtypesForKind: (kind: string) => SelectOption[];
  readonly schema: DomainSchema;
}

// ---------------------------------------------------------------------------
// Sub-dispatchers (grouped by category to reduce per-function complexity)
// ---------------------------------------------------------------------------

function renderPressureEditor(props: Readonly<RuleEditorBodyProps>): React.ReactNode {
  const { rule, updateField, pressureOptions } = props;
  switch (rule.type) {
    case 'pressure':
      return <PressureRangeEditor rule={rule} updateField={updateField} pressureOptions={pressureOptions} />;
    case 'pressure_any_above':
      return <PressureAnyAboveEditor rule={rule} updateField={updateField} pressureOptions={pressureOptions} />;
    case 'pressure_compare':
      return <PressureCompareEditor rule={rule} updateField={updateField} pressureOptions={pressureOptions} />;
    default:
      return null;
  }
}

function renderRelationshipEditor(props: Readonly<RuleEditorBodyProps>): React.ReactNode {
  const { rule, updateField, relationshipKindOptions, entityKindOptions } = props;
  switch (rule.type) {
    case 'relationship_count':
      return <RelationshipCountEditor rule={rule} updateField={updateField} relationshipKindOptions={relationshipKindOptions} />;
    case 'relationship_exists':
      return <RelationshipExistsEditor rule={rule} updateField={updateField} relationshipKindOptions={relationshipKindOptions} entityKindOptions={entityKindOptions} />;
    default:
      return null;
  }
}

function renderAttributeEditor(props: Readonly<RuleEditorBodyProps>): React.ReactNode {
  const { rule, updateField, tagRegistry } = props;
  switch (rule.type) {
    case 'tag_exists':
      return <TagEditor rule={rule} updateField={updateField} tagRegistry={tagRegistry} showValueField />;
    case 'tag_absent':
      return <TagEditor rule={rule} updateField={updateField} tagRegistry={tagRegistry} showValueField={false} />;
    case 'status':
      return <StatusEditor rule={rule} updateField={updateField} />;
    case 'prominence':
      return <ProminenceEditor rule={rule} updateField={updateField} />;
    default:
      return null;
  }
}

function renderTemporalEditor(props: Readonly<RuleEditorBodyProps>): React.ReactNode {
  const { rule, updateField, eraOptions } = props;
  switch (rule.type) {
    case 'time_elapsed':
      return <TimeElapsedEditor rule={rule} updateField={updateField} />;
    case 'growth_phases_complete':
      return <GrowthPhasesCompleteEditor rule={rule} updateField={updateField} eraOptions={eraOptions} />;
    case 'era_match':
      return <EraMatchEditor rule={rule} updateField={updateField} eraOptions={eraOptions} />;
    case 'random_chance':
      return <RandomChanceEditor rule={rule} updateField={updateField} />;
    case 'cooldown_elapsed':
      return <CooldownElapsedEditor rule={rule} updateField={updateField} />;
    case 'creations_per_epoch':
      return <CreationsPerEpochEditor rule={rule} updateField={updateField} />;
    default:
      return null;
  }
}

function renderGraphEntityEditor(props: Readonly<RuleEditorBodyProps>): React.ReactNode {
  const { rule, updateField, schema, relationshipKindOptions } = props;
  switch (rule.type) {
    case 'graph_path':
      return <GraphPathRuleEditor rule={rule} updateField={updateField} schema={schema} />;
    case 'entity_exists':
      return <EntityExistsEditor rule={rule} updateField={updateField} />;
    case 'entity_has_relationship':
      return <EntityHasRelationshipEditor rule={rule} updateField={updateField} relationshipKindOptions={relationshipKindOptions} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/** Maps rule type categories to their sub-dispatcher */
const CATEGORY_DISPATCHERS = [
  renderPressureEditor,
  renderRelationshipEditor,
  renderAttributeEditor,
  renderTemporalEditor,
  renderGraphEntityEditor,
] as const;

export function RuleEditorBody(props: Readonly<RuleEditorBodyProps>) {
  const { rule, updateField, entityKindOptions, getSubtypesForKind } = props;

  if (rule.type === 'entity_count') {
    return (
      <EntityCountEditor
        rule={rule}
        updateField={updateField}
        entityKindOptions={entityKindOptions}
        getSubtypesForKind={getSubtypesForKind}
      />
    );
  }

  for (const dispatcher of CATEGORY_DISPATCHERS) {
    const result = dispatcher(props);
    if (result !== null) return <>{result}</>;
  }

  return null;
}
