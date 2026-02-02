/**
 * ClusterFormationTab - Configuration for cluster formation systems
 */

import React from 'react';
import { CLUSTERING_CRITERIA_TYPES } from '../constants';
import { ReferenceDropdown, NumberInput, LocalTextArea } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function ClusterFormationTab({ system, onChange, schema }) {
  const config = system.config;

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };


  const updateClustering = (field, value) => {
    updateConfig('clustering', { ...config.clustering, [field]: value });
  };

  const updateMetaEntity = (field, value) => {
    updateConfig('metaEntity', { ...config.metaEntity, [field]: value });
  };

  // Criteria
  const criteria = config.clustering?.criteria || [];

  const addCriterion = () => {
    updateClustering('criteria', [...criteria, { type: 'same_culture', weight: 1.0 }]);
  };

  const updateCriterion = (index, crit) => {
    const newCriteria = [...criteria];
    newCriteria[index] = crit;
    updateClustering('criteria', newCriteria);
  };

  const removeCriterion = (index) => {
    updateClustering('criteria', criteria.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Clustering Configuration</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Min Size</label>
            <NumberInput
              value={config.clustering?.minSize}
              onChange={(v) => updateClustering('minSize', v)}
              min={2}
              integer
              allowEmpty
            />
          </div>
          <div className="form-group">
            <label className="label">Max Size</label>
            <NumberInput
              value={config.clustering?.maxSize}
              onChange={(v) => updateClustering('maxSize', v)}
              min={2}
              integer
              allowEmpty
            />
          </div>
          <div className="form-group">
            <label className="label">Minimum Score</label>
            <NumberInput
              value={config.clustering?.minimumScore}
              onChange={(v) => updateClustering('minimumScore', v)}
              min={0}
              allowEmpty
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Clustering Criteria ({criteria.length})</label>
        </div>

        {criteria.map((crit, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '12px 16px' }}>
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <ReferenceDropdown
                    label="Type"
                    value={crit.type}
                    onChange={(v) => updateCriterion(index, { ...crit, type: v })}
                    options={CLUSTERING_CRITERIA_TYPES}
                  />
                  <div className="form-group">
                    <label className="label">Weight</label>
                    <NumberInput
                      value={crit.weight}
                      onChange={(v) => updateCriterion(index, { ...crit, weight: v ?? 0 })}
                      min={0}
                    />
                  </div>
                  {crit.type === 'shared_relationship' && (
                    <ReferenceDropdown
                      label="Relationship Kind"
                      value={crit.relationshipKind}
                      onChange={(v) => updateCriterion(index, { ...crit, relationshipKind: v })}
                      options={relationshipKindOptions}
                    />
                  )}
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => removeCriterion(index)}>×</button>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addCriterion}
        >
          + Add Criterion
        </button>
      </div>

      <div className="section">
        <div className="section-title">Meta Entity</div>
        <div className="section-desc">
          Configuration for the meta-entity created from clusters.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Kind"
            value={config.metaEntity?.kind}
            onChange={(v) => updateMetaEntity('kind', v)}
            options={entityKindOptions}
          />
          <div className="form-group">
            <label className="label">Status</label>
            <input
              type="text"
              value={config.metaEntity?.status || ''}
              onChange={(e) => updateMetaEntity('status', e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="label">Description Template</label>
            <LocalTextArea
              value={config.metaEntity?.descriptionTemplate || ''}
              onChange={(value) => updateMetaEntity('descriptionTemplate', value)}
              placeholder="Use {names}, {count} placeholders"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Narration Template</div>
        <div className="section-desc" style={{ marginBottom: '8px', fontSize: '11px' }}>
          Syntax: {'{list:members}'}, {'{count}'}, {'{field|fallback}'}.
        </div>
        <LocalTextArea
          value={config.narrationTemplate || ''}
          onChange={(value) => updateConfig('narrationTemplate', value || undefined)}
          placeholder="e.g., {list:members} united to form a new alliance."
          rows={2}
        />
      </div>
    </div>
  );
}
