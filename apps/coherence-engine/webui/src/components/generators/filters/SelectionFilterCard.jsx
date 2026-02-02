/**
 * SelectionFilterCard - Display and edit a single selection filter
 */

import React, { useState } from 'react';
import { FILTER_TYPES } from '../constants';
import { ReferenceDropdown, ChipSelect, PROMINENCE_LEVELS } from '../../shared';
import { GraphPathEditor } from './GraphPathEditor';
import TagSelector from '@penguin-tales/shared-components/TagSelector';

/**
 * @param {Object} props
 * @param {Object} props.filter - The filter configuration
 * @param {Function} props.onChange - Callback when filter changes
 * @param {Function} props.onRemove - Callback to remove this filter
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function SelectionFilterCard({ filter, onChange, onRemove, schema, availableRefs }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = FILTER_TYPES[filter.type] || { label: filter.type, icon: '❓', color: '#6b7280' };

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const refOptions = (availableRefs || []).map((ref) => ({
    value: ref,
    label: ref,
  }));

  const updateFilter = (field, value) => {
    onChange({ ...filter, [field]: value });
  };

  const getSummary = () => {
    switch (filter.type) {
      case 'has_tag':
        return `${filter.tag || '?'}${filter.value !== undefined ? ` = ${filter.value}` : ''}`;
      case 'has_tags':
        return (filter.tags || []).join(', ') || 'no tags';
      case 'has_any_tag':
        return (filter.tags || []).join(', ') || 'no tags';
      case 'lacks_tag':
        return filter.tag || 'tag?';
      case 'lacks_any_tag':
        return (filter.tags || []).join(', ') || 'no tags';
      case 'has_culture':
        return filter.culture || 'culture?';
      case 'matches_culture':
        return `with ${filter.with || '?'}`;
      case 'has_status':
        return filter.status || 'status?';
      case 'has_prominence':
        return filter.minProminence || 'prominence?';
      case 'has_relationship': {
        const withLabel = filter.with ? ` with ${filter.with}` : '';
        const direction = filter.direction ? ` [${filter.direction}]` : '';
        return `${filter.kind || '?'}${withLabel}${direction}`;
      }
      case 'lacks_relationship': {
        const withLabel = filter.with ? ` with ${filter.with}` : '';
        return `${filter.kind || '?'}${withLabel}`;
      }
      case 'exclude':
        return `${(filter.entities || []).length} excluded`;
      case 'shares_related':
        return `${filter.relationshipKind || '?'} with ${filter.with || '?'}`;
      case 'graph_path':
        return `graph path (${filter.assert?.check || 'exists'})`;
      default:
        return '';
    }
  };

  const summary = getSummary();

  const renderFilterFields = () => {
    switch (filter.type) {
      case 'has_tag':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Tag</label>
              <TagSelector
                value={filter.tag ? [filter.tag] : []}
                onChange={(v) => updateFilter('tag', v[0] || '')}
                tagRegistry={schema?.tagRegistry || []}
                placeholder="Select tag..."
                singleSelect
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Value (optional)</label>
              <input
                type="text"
                value={filter.value ?? ''}
                onChange={(e) => updateFilter('value', e.target.value || undefined)}
                className="input input-compact"
                placeholder="Any value"
              />
            </div>
          </div>
        );

      case 'has_tags':
        return (
          <div>
            <label className="label label-small">Tags (must have ALL)</label>
            <TagSelector
              value={filter.tags || []}
              onChange={(v) => updateFilter('tags', v)}
              tagRegistry={schema?.tagRegistry || []}
              placeholder="Select tags..."
            />
          </div>
        );

      case 'has_any_tag':
        return (
          <div>
            <label className="label label-small">Tags (must have at least ONE)</label>
            <TagSelector
              value={filter.tags || []}
              onChange={(v) => updateFilter('tags', v)}
              tagRegistry={schema?.tagRegistry || []}
              placeholder="Select tags..."
            />
          </div>
        );

      case 'lacks_tag':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Tag</label>
              <TagSelector
                value={filter.tag ? [filter.tag] : []}
                onChange={(v) => updateFilter('tag', v[0] || '')}
                tagRegistry={schema?.tagRegistry || []}
                placeholder="Select tag..."
                singleSelect
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Value (optional)</label>
              <input
                type="text"
                value={filter.value ?? ''}
                onChange={(e) => updateFilter('value', e.target.value || undefined)}
                className="input input-compact"
                placeholder="Any value"
              />
            </div>
          </div>
        );

      case 'lacks_any_tag':
        return (
          <div>
            <label className="label label-small">Tags (exclude if has ANY)</label>
            <TagSelector
              value={filter.tags || []}
              onChange={(v) => updateFilter('tags', v)}
              tagRegistry={schema?.tagRegistry || []}
              placeholder="Select tags..."
            />
          </div>
        );

      case 'has_culture':
        return (
          <div>
            <label className="label label-small">Culture</label>
            <ReferenceDropdown
              value={filter.culture || ''}
              onChange={(v) => updateFilter('culture', v)}
              options={(schema?.cultures || []).map((c) => ({
                value: c.id,
                label: c.name || c.id,
              }))}
              placeholder="Select culture..."
            />
          </div>
        );

      case 'matches_culture':
        return (
          <div>
            <label className="label label-small">Same Culture As</label>
            <ReferenceDropdown
              value={filter.with || ''}
              onChange={(v) => updateFilter('with', v)}
              options={refOptions}
              placeholder="Select variable..."
            />
          </div>
        );

      case 'has_status':
        return (
          <div>
            <label className="label label-small">Status</label>
            <input
              type="text"
              value={filter.status || ''}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="input input-compact"
              placeholder="e.g., active, historical"
            />
          </div>
        );

      case 'has_prominence':
        return (
          <div>
            <label className="label label-small">Minimum Prominence</label>
            <ReferenceDropdown
              value={filter.minProminence || ''}
              onChange={(v) => updateFilter('minProminence', v)}
              options={PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label }))}
              placeholder="Select prominence..."
            />
          </div>
        );

      case 'has_relationship':
      case 'lacks_relationship':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 140px' }}>
              <label className="label label-small">Relationship Kind</label>
              <ReferenceDropdown
                value={filter.kind || ''}
                onChange={(v) => updateFilter('kind', v)}
                options={relationshipKindOptions}
                placeholder="Select kind..."
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="label label-small">With Entity (optional)</label>
              <ReferenceDropdown
                value={filter.with || ''}
                onChange={(v) => updateFilter('with', v || undefined)}
                options={refOptions}
                placeholder="Any entity"
              />
            </div>
            {filter.type === 'has_relationship' && (
              <div style={{ flex: '1 1 100px' }}>
                <label className="label label-small">Direction</label>
                <ReferenceDropdown
                  value={filter.direction || 'both'}
                  onChange={(v) => updateFilter('direction', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'src', label: 'Outgoing' },
                    { value: 'dst', label: 'Incoming' },
                  ]}
                />
              </div>
            )}
          </div>
        );

      case 'exclude':
        return (
          <ChipSelect
            label="Entities to Exclude"
            value={filter.entities || []}
            onChange={(v) => updateFilter('entities', v)}
            options={refOptions}
            placeholder="+ Add variable..."
          />
        );

      case 'shares_related':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 140px' }}>
              <label className="label label-small">Via Relationship</label>
              <ReferenceDropdown
                value={filter.relationshipKind || ''}
                onChange={(v) => updateFilter('relationshipKind', v)}
                options={relationshipKindOptions}
                placeholder="Select kind..."
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="label label-small">With Entity</label>
              <ReferenceDropdown
                value={filter.with || ''}
                onChange={(v) => updateFilter('with', v)}
                options={refOptions}
                placeholder="Select variable..."
              />
            </div>
          </div>
        );

      case 'graph_path':
        return (
          <GraphPathEditor
            assert={filter.assert}
            onChange={(assert) => updateFilter('assert', assert)}
            schema={schema}
            availableRefs={availableRefs}
          />
        );

      default:
        return (
          <div className="text-muted">
            Unknown filter type: {filter.type}
          </div>
        );
    }
  };

  return (
    <div className="condition-card">
      <div className="condition-card-header" style={{ marginBottom: expanded ? undefined : 0 }}>
        <div className="condition-card-type">
          <span className="condition-card-icon" style={{ backgroundColor: `${typeConfig.color}20` }}>
            {typeConfig.icon}
          </span>
          <div>
            <div className="condition-card-label">{typeConfig.label}</div>
            {summary && <div className="condition-card-summary">{summary}</div>}
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? '^' : 'v'}
          </button>
          <button onClick={onRemove} className="btn-icon btn-icon-danger">
            x
          </button>
        </div>
      </div>
      {expanded && (
        <div className="condition-card-fields">
          {renderFilterFields()}
        </div>
      )}
    </div>
  );
}

export default SelectionFilterCard;
