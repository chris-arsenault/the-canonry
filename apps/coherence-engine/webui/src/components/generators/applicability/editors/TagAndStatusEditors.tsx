/**
 * Rule editors for tag and status applicability rules:
 * - TagEditor (tag_exists, tag_absent)
 * - StatusEditor (status)
 * - ProminenceEditor (prominence)
 */

import React, { useCallback, useMemo } from 'react';
import { ReferenceDropdown, PROMINENCE_LEVELS } from '../../../shared';
import TagSelector from '@the-canonry/shared-components/TagSelector';
import type { SelectOption, TagExistsRule, TagAbsentRule, StatusRule, ProminenceRule, TagRegistryEntry } from '../applicabilityRuleTypes';

// ---------------------------------------------------------------------------
// Tag Editor (tag_exists / tag_absent)
// ---------------------------------------------------------------------------

interface TagEditorProps {
  rule: TagExistsRule | TagAbsentRule;
  updateField: (field: string, value: unknown) => void;
  tagRegistry: TagRegistryEntry[];
  showValueField: boolean;
}

export function TagEditor({ rule, updateField, tagRegistry, showValueField }: Readonly<TagEditorProps>) {
  const tagValue = useMemo(() => (rule.tag ? [rule.tag] : []), [rule.tag]);

  const handleTagChange = useCallback(
    (tags: string[]) => updateField('tag', tags[0] || ''),
    [updateField],
  );
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('value', e.target.value || undefined),
    [updateField],
  );

  return (
    <>
      <div className="form-group grid-col-full">
        <label className="label">Tag
        <TagSelector
          value={tagValue}
          onChange={handleTagChange}
          tagRegistry={tagRegistry}
          placeholder="Select tag..."
          singleSelect
        />
        </label>
      </div>
      {showValueField && (
        <div className="form-group grid-col-full">
          <label htmlFor="value-optional" className="label">Value (optional)</label>
          <input
            id="value-optional"
            type="text"
            value={(rule as TagExistsRule).value ?? ''}
            onChange={handleValueChange}
            className="input"
            placeholder="Any value"
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Status Editor
// ---------------------------------------------------------------------------

interface StatusEditorProps {
  rule: StatusRule;
  updateField: (field: string, value: unknown) => void;
}

export function StatusEditor({ rule, updateField }: Readonly<StatusEditorProps>) {
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('status', e.target.value || undefined),
    [updateField],
  );
  const handleNotChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('not', e.target.checked || undefined),
    [updateField],
  );

  return (
    <>
      <div className="form-group">
        <label htmlFor="status" className="label">Status</label>
        <input
          id="status"
          type="text"
          value={rule.status || ''}
          onChange={handleStatusChange}
          className="input"
        />
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={rule.not || false}
            onChange={handleNotChange}
            className="checkbox"
          />
          Exclude status
        </label>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prominence Editor
// ---------------------------------------------------------------------------

const PROMINENCE_OPTIONS: SelectOption[] = PROMINENCE_LEVELS.map((p) => ({
  value: p.value,
  label: p.label,
}));

interface ProminenceEditorProps {
  rule: ProminenceRule;
  updateField: (field: string, value: unknown) => void;
}

export function ProminenceEditor({ rule, updateField }: Readonly<ProminenceEditorProps>) {
  const handleMinChange = useCallback(
    (v: string | undefined) => updateField('min', v || undefined),
    [updateField],
  );
  const handleMaxChange = useCallback(
    (v: string | undefined) => updateField('max', v || undefined),
    [updateField],
  );

  return (
    <>
      <ReferenceDropdown
        label="Min Prominence"
        value={rule.min || ''}
        onChange={handleMinChange}
        options={PROMINENCE_OPTIONS}
        placeholder="Any"
      />
      <ReferenceDropdown
        label="Max Prominence"
        value={rule.max || ''}
        onChange={handleMaxChange}
        options={PROMINENCE_OPTIONS}
        placeholder="Any"
      />
    </>
  );
}
