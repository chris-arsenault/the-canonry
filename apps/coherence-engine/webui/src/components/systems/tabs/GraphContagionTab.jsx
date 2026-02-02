/**
 * GraphContagionTab - Configuration for graph contagion systems
 */

import React from 'react';
import { DIRECTIONS } from '../constants';
import { ReferenceDropdown, NumberInput, LocalTextArea } from '../../shared';
import TagSelector from '@penguin-tales/shared-components/TagSelector';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function GraphContagionTab({ system, onChange, schema }) {
  const config = system.config;

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateContagion = (field, value) => {
    updateConfig('contagion', { ...config.contagion, [field]: value });
  };

  const updateTransmission = (field, value) => {
    updateConfig('transmission', { ...config.transmission, [field]: value });
  };

  const updateInfectionAction = (field, value) => {
    updateConfig('infectionAction', { ...config.infectionAction, [field]: value });
  };

  // Vectors
  const vectors = config.vectors || [];

  const addVector = () => {
    updateConfig('vectors', [...vectors, { relationshipKind: '', direction: 'both', minStrength: 0.5 }]);
  };

  const updateVector = (index, field, value) => {
    const newVectors = [...vectors];
    newVectors[index] = { ...newVectors[index], [field]: value };
    updateConfig('vectors', newVectors);
  };

  const removeVector = (index) => {
    updateConfig('vectors', vectors.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Contagion Source</div>
        <div className="section-desc">
          What is being spread through the network.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Type"
            value={config.contagion?.type || 'relationship'}
            onChange={(v) => updateContagion('type', v)}
            options={[
              { value: 'relationship', label: 'Relationship' },
              { value: 'tag', label: 'Tag' },
            ]}
          />
          {config.contagion?.type === 'relationship' && (
            <ReferenceDropdown
              label="Relationship Kind"
              value={config.contagion?.relationshipKind}
              onChange={(v) => updateContagion('relationshipKind', v)}
              options={relationshipKindOptions}
            />
          )}
          {config.contagion?.type === 'tag' && (
            <div className="form-group">
              <label className="label">Tag</label>
              <input
                type="text"
                value={config.contagion?.tagPattern || ''}
                onChange={(e) => updateContagion('tagPattern', e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Transmission Vectors ({vectors.length})</div>
        <div className="section-desc">
          Relationships through which the contagion spreads.
        </div>

        {vectors.map((vector, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '16px' }}>
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={vector.relationshipKind}
                    onChange={(v) => updateVector(index, 'relationshipKind', v)}
                    options={relationshipKindOptions}
                  />
                  <ReferenceDropdown
                    label="Direction"
                    value={vector.direction || 'both'}
                    onChange={(v) => updateVector(index, 'direction', v)}
                    options={DIRECTIONS}
                  />
                  <div className="form-group">
                    <label className="label">Min Strength</label>
                    <NumberInput
                      value={vector.minStrength}
                      onChange={(v) => updateVector(index, 'minStrength', v)}
                      className="input"
                      step={0.1}
                      min={0}
                      max={1}
                      allowEmpty
                    />
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => removeVector(index)}>×</button>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addVector}
        >
          + Add Vector
        </button>
      </div>

      <div className="section">
        <div className="section-title">Transmission Rates</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Base Rate</label>
            <NumberInput
              value={config.transmission?.baseRate}
              onChange={(v) => updateTransmission('baseRate', v)}
              className="input"
              step={0.05}
              min={0}
              max={1}
              allowEmpty
            />
          </div>
          <div className="form-group">
            <label className="label">Contact Multiplier</label>
            <NumberInput
              value={config.transmission?.contactMultiplier}
              onChange={(v) => updateTransmission('contactMultiplier', v)}
              className="input"
              step={0.05}
              min={0}
              allowEmpty
            />
          </div>
          <div className="form-group">
            <label className="label">Max Probability</label>
            <NumberInput
              value={config.transmission?.maxProbability}
              onChange={(v) => updateTransmission('maxProbability', v)}
              className="input"
              step={0.05}
              min={0}
              max={1}
              allowEmpty
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Infection Action</div>
        <div className="section-desc">
          What happens when an entity gets infected.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Action Type"
            value={config.infectionAction?.type || 'create_relationship'}
            onChange={(v) => updateInfectionAction('type', v)}
            options={[
              { value: 'create_relationship', label: 'Create Relationship' },
              { value: 'set_tag', label: 'Set Tag' },
            ]}
          />
          {config.infectionAction?.type === 'create_relationship' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={config.infectionAction?.kind}
                onChange={(v) => updateInfectionAction('kind', v)}
                options={relationshipKindOptions}
              />
              <ReferenceDropdown
                label="Source"
                value={config.infectionAction?.src || '$self'}
                onChange={(v) => updateInfectionAction('src', v)}
                options={[
                  { value: '$self', label: '$self' },
                  { value: '$source', label: '$source' },
                  { value: '$contagion_source', label: '$contagion_source' },
                ]}
              />
              <ReferenceDropdown
                label="Destination"
                value={config.infectionAction?.dst || '$source'}
                onChange={(v) => updateInfectionAction('dst', v)}
                options={[
                  { value: '$self', label: '$self' },
                  { value: '$source', label: '$source' },
                  { value: '$contagion_source', label: '$contagion_source' },
                ]}
              />
              <div className="form-group">
                <label className="label">Strength</label>
                <NumberInput
                  value={config.infectionAction?.strength}
                  onChange={(v) => updateInfectionAction('strength', v)}
                  className="input"
                  step={0.1}
                  min={0}
                  max={1}
                  allowEmpty
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.infectionAction?.bidirectional || false}
                    onChange={(e) => updateInfectionAction('bidirectional', e.target.checked || undefined)}
                    className="checkbox"
                  />
                  Bidirectional
                </label>
              </div>
            </>
          )}
          {config.infectionAction?.type === 'set_tag' && (
            <>
              <ReferenceDropdown
                label="Entity"
                value={config.infectionAction?.entity || '$self'}
                onChange={(v) => updateInfectionAction('entity', v)}
                options={[
                  { value: '$self', label: '$self' },
                  { value: '$source', label: '$source' },
                  { value: '$contagion_source', label: '$contagion_source' },
                ]}
              />
              <div className="form-group">
                <label className="label">Tag</label>
                <TagSelector
                  value={config.infectionAction?.tag ? [config.infectionAction.tag] : []}
                  onChange={(tags) => updateInfectionAction('tag', tags[0] || '')}
                  tagRegistry={schema?.tagRegistry || []}
                  placeholder="Select tag..."
                  singleSelect
                />
              </div>
              <div className="form-group">
                <label className="label">Value (optional)</label>
                <input
                  type="text"
                  value={config.infectionAction?.value !== undefined ? String(config.infectionAction.value) : ''}
                  onChange={(e) => updateInfectionAction('value', e.target.value || undefined)}
                  className="input"
                  placeholder="true"
                />
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Narration Template</label>
          <div className="section-desc" style={{ marginBottom: '4px', fontSize: '11px' }}>
            Syntax: {'{$self.field}'}, {'{$source.field}'}, {'{$contagion_source.field}'}, {'{field|fallback}'}.
          </div>
          <LocalTextArea
            value={config.narrationTemplate || ''}
            onChange={(value) => updateConfig('narrationTemplate', value || undefined)}
            placeholder="e.g., {$self.name} fell under the influence of {$source.name}."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
