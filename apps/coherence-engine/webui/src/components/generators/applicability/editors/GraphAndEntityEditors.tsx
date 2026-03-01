/**
 * Rule editors for graph/entity reference applicability rules:
 * - GraphPathRuleEditor
 * - EntityExistsEditor
 * - EntityHasRelationshipEditor
 */

import React, { useCallback } from 'react';
import { ReferenceDropdown } from '../../../shared';
import { GraphPathEditor } from '../../filters/GraphPathEditor';
import type {
  SelectOption,
  GraphPathRule,
  EntityExistsRule,
  EntityHasRelationshipRule,
  DomainSchema,
  GraphPathAssert,
} from '../applicabilityRuleTypes';

const AVAILABLE_REFS = ['$target'];

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'both', label: 'Both' },
  { value: 'src', label: 'Outgoing (src)' },
  { value: 'dst', label: 'Incoming (dst)' },
];

// ---------------------------------------------------------------------------
// Graph Path
// ---------------------------------------------------------------------------

interface GraphPathRuleEditorProps {
  rule: GraphPathRule;
  updateField: (field: string, value: unknown) => void;
  schema: DomainSchema;
}

export function GraphPathRuleEditor({ rule, updateField, schema }: Readonly<GraphPathRuleEditorProps>) {
  const handleAssertChange = useCallback(
    (assert: GraphPathAssert) => updateField('assert', assert),
    [updateField],
  );

  return (
    <div className="grid-col-full">
      <GraphPathEditor
        assert={rule.assert}
        onChange={handleAssertChange}
        schema={schema}
        availableRefs={AVAILABLE_REFS}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity Exists
// ---------------------------------------------------------------------------

interface EntityExistsEditorProps {
  rule: EntityExistsRule;
  updateField: (field: string, value: unknown) => void;
}

export function EntityExistsEditor({ rule, updateField }: Readonly<EntityExistsEditorProps>) {
  const handleEntityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('entity', e.target.value),
    [updateField],
  );

  return (
    <div className="form-group grid-col-full">
      <label htmlFor="entity-reference" className="label">Entity Reference</label>
      <input
        id="entity-reference"
        type="text"
        value={rule.entity || ''}
        onChange={handleEntityChange}
        className="input"
        placeholder="$target"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity Has Relationship
// ---------------------------------------------------------------------------

interface EntityHasRelationshipEditorProps {
  rule: EntityHasRelationshipRule;
  updateField: (field: string, value: unknown) => void;
  relationshipKindOptions: SelectOption[];
}

export function EntityHasRelationshipEditor({
  rule,
  updateField,
  relationshipKindOptions,
}: Readonly<EntityHasRelationshipEditorProps>) {
  const handleEntityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('entity', e.target.value),
    [updateField],
  );
  const handleKindChange = useCallback(
    (v: string | undefined) => updateField('relationshipKind', v),
    [updateField],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => updateField('direction', v),
    [updateField],
  );

  return (
    <>
      <div className="form-group">
        <label htmlFor="entity-reference" className="label">Entity Reference</label>
        <input
          id="entity-reference"
          type="text"
          value={rule.entity || ''}
          onChange={handleEntityChange}
          className="input"
          placeholder="$target"
        />
      </div>
      <ReferenceDropdown
        label="Relationship Kind"
        value={rule.relationshipKind || ''}
        onChange={handleKindChange}
        options={relationshipKindOptions}
      />
      <ReferenceDropdown
        label="Direction"
        value={rule.direction || 'both'}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
    </>
  );
}
