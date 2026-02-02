/**
 * PlaneDiffusionTab - Configuration for plane diffusion systems
 *
 * True time-evolving 2D diffusion field simulation.
 * Uses a 100x100 grid matching the semantic coordinate space.
 * Sources SET values at their positions (Dirichlet boundary).
 * Values diffuse via heat equation. Simulation is uncapped internally.
 * Output (tags) is clamped to -100 to 100.
 */

import React from 'react';
import { NumberInput } from '../../shared';
import TagSelector from '@penguin-tales/shared-components/TagSelector';

const styles = {
  hint: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
    lineHeight: '1.4',
  },
  sectionHint: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
};

const FALLOFF_OPTIONS = [
  { value: 'absolute', label: 'Absolute (100→99→98...)' },
  { value: 'none', label: 'None (full strength in radius)' },
  { value: 'linear', label: 'Linear % (1 - d/r)' },
  { value: 'inverse_square', label: 'Inverse Square % (1/(1+d²))' },
  { value: 'sqrt', label: 'Square Root % (1 - √(d/r))' },
  { value: 'exponential', label: 'Exponential % (e^(-3d/r))' },
];

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema (for tag registry)
 */
export function PlaneDiffusionTab({ system, onChange, schema }) {
  const config = system.config;
  const tagRegistry = schema?.tagRegistry || [];

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateSources = (field, value) => {
    updateConfig('sources', { ...config.sources, [field]: value });
  };

  const updateSinks = (field, value) => {
    updateConfig('sinks', { ...config.sinks, [field]: value });
  };

  const updateDiffusion = (field, value) => {
    updateConfig('diffusion', { ...config.diffusion, [field]: value });
  };

  // Output tags
  const outputTags = config.outputTags || [];

  const addOutputTag = () => {
    updateConfig('outputTags', [...outputTags, { tag: '', minValue: 0 }]);
  };

  const updateOutputTag = (index, tag) => {
    const newTags = [...outputTags];
    newTags[index] = tag;
    updateConfig('outputTags', newTags);
  };

  const removeOutputTag = (index) => {
    updateConfig('outputTags', outputTags.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Sources</div>
        <div style={styles.sectionHint}>
          Entities that SET values into the diffusion field. Values are maintained at source positions each tick (Dirichlet boundary condition).
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tag Filter</label>
            <TagSelector
              value={config.sources?.tagFilter ? [config.sources.tagFilter] : []}
              onChange={(tags) => updateSources('tagFilter', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
            <div style={styles.hint}>Tag that marks an entity as a source</div>
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <NumberInput
              value={config.sources?.defaultStrength}
              onChange={(v) => updateSources('defaultStrength', v)}
              allowEmpty
            />
            <div style={styles.hint}>Any number. Simulation is uncapped. Output tags clamp to -100/100.</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Sinks</div>
        <div style={styles.sectionHint}>
          Entities that SET negative values into the diffusion field.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tag Filter</label>
            <TagSelector
              value={config.sinks?.tagFilter ? [config.sinks.tagFilter] : []}
              onChange={(tags) => updateSinks('tagFilter', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
            <div style={styles.hint}>Tag that marks an entity as a sink</div>
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <NumberInput
              value={config.sinks?.defaultStrength}
              onChange={(v) => updateSinks('defaultStrength', v)}
              allowEmpty
            />
            <div style={styles.hint}>Will be negated. Any number - simulation is uncapped.</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Diffusion</div>
        <div style={styles.sectionHint}>
          Heat equation parameters. Each tick: sources/sinks SET values (fixed boundary), then diffusion runs N iterations to spread values.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Rate</label>
            <NumberInput
              value={config.diffusion?.rate}
              onChange={(v) => updateDiffusion('rate', v)}
              min={0}
              max={1}
              allowEmpty
            />
            <div style={styles.hint}>0-1. Recommended 0.1-0.25. Above 0.25 may cause oscillations.</div>
          </div>
          <div className="form-group">
            <label className="label">Source Radius</label>
            <NumberInput
              value={config.diffusion?.sourceRadius}
              onChange={(v) => updateDiffusion('sourceRadius', v)}
              min={0}
              max={50}
              integer
              allowEmpty
            />
            <div style={styles.hint}>Grid cells where source/sink SET values. Default: 1.</div>
          </div>
          <div className="form-group">
            <label className="label">Falloff Type</label>
            <select
              className="input"
              value={config.diffusion?.falloffType || 'absolute'}
              onChange={(e) => updateDiffusion('falloffType', e.target.value)}
            >
              {FALLOFF_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={styles.hint}>How strength decreases within source radius.</div>
          </div>
          <div className="form-group">
            <label className="label">Decay Rate</label>
            <NumberInput
              value={config.diffusion?.decayRate}
              onChange={(v) => updateDiffusion('decayRate', v)}
              min={0}
              max={1}
              allowEmpty
            />
            <div style={styles.hint}>0-1. Default: 0 (no decay). Decay fights diffusion spreading.</div>
          </div>
          <div className="form-group">
            <label className="label">Iterations Per Tick</label>
            <NumberInput
              value={config.diffusion?.iterationsPerTick}
              onChange={(v) => updateDiffusion('iterationsPerTick', v)}
              min={1}
              max={200}
              integer
              allowEmpty
            />
            <div style={styles.hint}>Default: 20. Higher = faster spreading. 20 achieves ~50 cells in 15 ticks.</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Output Tags ({outputTags.length})</div>
        <div style={styles.sectionHint}>
          Tags assigned to entities based on sampled field value (clamped to -100 to 100).
        </div>

        {outputTags.map((tag, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '12px 16px' }}>
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <div className="form-group">
                    <label className="label">Tag</label>
                    <TagSelector
                      value={tag.tag ? [tag.tag] : []}
                      onChange={(tags) => updateOutputTag(index, { ...tag, tag: tags[0] || '' })}
                      tagRegistry={tagRegistry}
                      placeholder="Select tag..."
                      singleSelect
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Min Value</label>
                    <NumberInput
                      value={tag.minValue}
                      onChange={(v) => updateOutputTag(index, { ...tag, minValue: v })}
                      min={-100}
                      max={100}
                      allowEmpty
                    />
                    <div style={styles.hint}>-100 to 100</div>
                  </div>
                  <div className="form-group">
                    <label className="label">Max Value</label>
                    <NumberInput
                      value={tag.maxValue}
                      onChange={(v) => updateOutputTag(index, { ...tag, maxValue: v })}
                      min={-100}
                      max={100}
                      allowEmpty
                    />
                    <div style={styles.hint}>-100 to 100</div>
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => removeOutputTag(index)}>×</button>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addOutputTag}
        >
          + Add Output Tag
        </button>

        <div style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="label">Value Tag</label>
            <TagSelector
              value={config.valueTag ? [config.valueTag] : []}
              onChange={(tags) => updateConfig('valueTag', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
            <div style={styles.hint}>Optional: Store clamped field value as tag (e.g., "field_value:25.5")</div>
          </div>
        </div>
      </div>
    </div>
  );
}
