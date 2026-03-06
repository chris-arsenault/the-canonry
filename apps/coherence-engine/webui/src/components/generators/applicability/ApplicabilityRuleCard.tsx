/**
 * ApplicabilityRuleCard - Display and edit a single applicability rule
 */

import React, { useCallback, useMemo } from 'react';
import { useExpandBoolean } from '../../shared';
import { APPLICABILITY_TYPES } from '../constants';
import { AddRuleButton } from './AddRuleButton';
import { createNewRule } from './createNewRule';
import { getRuleSummary } from './getRuleSummary';
import { RuleEditorBody } from './RuleEditorBody';
import type {
  ApplicabilityRule,
  DomainSchema,
  PressureDef,
  EraDef,
  SelectOption,
  TagRegistryEntry,
} from './applicabilityRuleTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_SCHEMA: DomainSchema = {};
const EMPTY_PRESSURES: PressureDef[] = [];
const EMPTY_ERAS: EraDef[] = [];
const EMPTY_ENTITY_KINDS: DomainSchema['entityKinds'] = [];
const EMPTY_RELATIONSHIP_KINDS: DomainSchema['relationshipKinds'] = [];
const EMPTY_TAG_REGISTRY: TagRegistryEntry[] = [];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApplicabilityRuleCardProps {
  readonly rule: ApplicabilityRule;
  readonly onChange: (updated: ApplicabilityRule) => void;
  readonly onRemove: () => void;
  readonly schema?: DomainSchema;
  readonly pressures?: PressureDef[];
  readonly eras?: EraDef[];
  readonly depth?: number;
}

// ---------------------------------------------------------------------------
// NestedRulesSection - Renders sub-rules for AND/OR logical rules
// ---------------------------------------------------------------------------

interface NestedRulesSectionProps {
  readonly rule: ApplicabilityRule & { conditions?: ApplicabilityRule[] };
  readonly updateField: (field: string, value: unknown) => void;
  readonly schema: DomainSchema;
  readonly pressures: PressureDef[];
  readonly eras: EraDef[];
  readonly depth: number;
}

interface NestedRuleItemProps {
  readonly subRule: ApplicabilityRule;
  readonly index: number;
  readonly conditions: ApplicabilityRule[];
  readonly updateField: (field: string, value: unknown) => void;
  readonly schema: DomainSchema;
  readonly pressures: PressureDef[];
  readonly eras: EraDef[];
  readonly depth: number;
}

function NestedRuleItem({
  subRule,
  index,
  conditions,
  updateField,
  schema,
  pressures,
  eras,
  depth,
}: Readonly<NestedRuleItemProps>) {
  const handleChange = useCallback(
    (updated: ApplicabilityRule) => {
      const newRules = [...conditions];
      newRules[index] = updated;
      updateField('conditions', newRules);
    },
    [conditions, index, updateField],
  );

  const handleRemove = useCallback(() => {
    updateField('conditions', conditions.filter((_, i) => i !== index));
  }, [conditions, index, updateField]);

  return (
    <ApplicabilityRuleCard
      rule={subRule}
      onChange={handleChange}
      onRemove={handleRemove}
      schema={schema}
      pressures={pressures}
      eras={eras}
      depth={depth + 1}
    />
  );
}

function NestedRulesSection({
  rule,
  updateField,
  schema,
  pressures,
  eras,
  depth,
}: Readonly<NestedRulesSectionProps>) {
  const conditions = useMemo(
    () => rule.conditions || [],
    [rule.conditions],
  );

  const handleAddRule = useCallback(
    (type: string) => {
      const newRule = createNewRule(type, pressures) as ApplicabilityRule;
      updateField('conditions', [...conditions, newRule]);
    },
    [conditions, pressures, updateField],
  );

  return (
    <div className="condition-card-nested">
      {conditions.map((subRule, idx) => (
        <NestedRuleItem
          key={idx}
          subRule={subRule}
          index={idx}
          conditions={conditions}
          updateField={updateField}
          schema={schema}
          pressures={pressures}
          eras={eras}
          depth={depth}
        />
      ))}
      <AddRuleButton onAdd={handleAddRule} depth={depth + 1} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// useRuleOptions - Encapsulate schema-derived option computation
// ---------------------------------------------------------------------------

function useRuleOptions(schema: DomainSchema, pressures: PressureDef[], eras: EraDef[]) {
  const entityKinds = schema.entityKinds || EMPTY_ENTITY_KINDS;
  const relationshipKinds = schema.relationshipKinds || EMPTY_RELATIONSHIP_KINDS;
  const tagRegistry = schema.tagRegistry || EMPTY_TAG_REGISTRY;

  const entityKindOptions = useMemo<SelectOption[]>(
    () => entityKinds.map((ek) => ({ value: ek.kind, label: ek.description || ek.kind })),
    [entityKinds],
  );

  const relationshipKindOptions = useMemo<SelectOption[]>(
    () => relationshipKinds.map((rk) => ({ value: rk.kind, label: rk.description || rk.kind })),
    [relationshipKinds],
  );

  const getSubtypesForKind = useCallback(
    (kind: string): SelectOption[] => {
      const ek = entityKinds.find((e) => e.kind === kind);
      if (!ek?.subtypes) return [];
      return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
    },
    [entityKinds],
  );

  const pressureOptions = useMemo<SelectOption[]>(
    () => pressures.map((p) => ({ value: p.id, label: p.name || p.id })),
    [pressures],
  );

  const eraOptions = useMemo<SelectOption[]>(
    () => eras.map((e) => ({ value: e.id, label: e.name || e.id })),
    [eras],
  );

  return {
    entityKindOptions,
    relationshipKindOptions,
    tagRegistry,
    getSubtypesForKind,
    pressureOptions,
    eraOptions,
  };
}

// ---------------------------------------------------------------------------
// RuleCardHeader - Header with icon, summary, and expand/remove buttons
// ---------------------------------------------------------------------------

interface RuleCardHeaderProps {
  readonly rule: ApplicabilityRule;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onRemove: () => void;
}

const UNKNOWN_TYPE_CONFIG = Object.freeze({ label: '', icon: '\uD83D\uDCCB', color: '#3b82f6', desc: '' });

function getTypeConfig(ruleType: string) {
  if (ruleType in APPLICABILITY_TYPES) {
    return APPLICABILITY_TYPES[ruleType as keyof typeof APPLICABILITY_TYPES];
  }
  return UNKNOWN_TYPE_CONFIG;
}

function RuleCardHeader({ rule, expanded, onToggle, onRemove }: Readonly<RuleCardHeaderProps>) {
  const config = getTypeConfig(rule.type);

  const iconStyle = useMemo(
    () => ({
      '--arc-icon-bg': `${config.color}20`,
      backgroundColor: 'var(--arc-icon-bg)',
    } as React.CSSProperties),
    [config.color],
  );

  const summary = getRuleSummary(rule);

  return (
    <div className="condition-card-header">
      <div className="condition-card-type">
        <div
          className="condition-card-icon"
          // eslint-disable-next-line local/no-inline-styles -- dynamic color per rule type
          style={iconStyle}
        >
          {config.icon}
        </div>
        <div>
          <div className="condition-card-label">{config.label || rule.type}</div>
          <div className="condition-card-summary">{summary}</div>
        </div>
      </div>
      <div className="condition-card-actions">
        <button className="btn-icon" onClick={onToggle}>
          {expanded ? '^' : 'v'}
        </button>
        <button className="btn-icon btn-icon-danger" onClick={onRemove}>
          x
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ApplicabilityRuleCard
// ---------------------------------------------------------------------------

export function ApplicabilityRuleCard({
  rule,
  onChange,
  onRemove,
  schema: schemaProp,
  pressures: pressuresProp,
  eras: erasProp,
  depth = 0,
}: Readonly<ApplicabilityRuleCardProps>) {
  const { expanded, toggle } = useExpandBoolean();

  const schema = schemaProp || EMPTY_SCHEMA;
  const pressures = pressuresProp || EMPTY_PRESSURES;
  const eras = erasProp || EMPTY_ERAS;

  const options = useRuleOptions(schema, pressures, eras);

  const updateField = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...rule, [field]: value } as ApplicabilityRule);
    },
    [onChange, rule],
  );

  const isNested = rule.type === 'or' || rule.type === 'and';

  return (
    <div className="condition-card">
      <RuleCardHeader
        rule={rule}
        expanded={expanded}
        onToggle={toggle}
        onRemove={onRemove}
      />

      {expanded && (
        <div className="mt-lg">
          <div className="form-grid">
            <RuleEditorBody
              rule={rule}
              updateField={updateField}
              entityKindOptions={options.entityKindOptions}
              relationshipKindOptions={options.relationshipKindOptions}
              pressureOptions={options.pressureOptions}
              eraOptions={options.eraOptions}
              tagRegistry={options.tagRegistry}
              getSubtypesForKind={options.getSubtypesForKind}
              schema={schema}
            />
          </div>
        </div>
      )}

      {isNested && (
        <NestedRulesSection
          rule={rule}
          updateField={updateField}
          schema={schema}
          pressures={pressures}
          eras={eras}
          depth={depth}
        />
      )}
    </div>
  );
}

export default ApplicabilityRuleCard;
