/**
 * WorldContextEditor - Configure world context for LLM prompts
 *
 * Exposes:
 * - World name and description
 * - Canon facts (for perspective synthesis)
 * - Tone fragments (core + culture/kind overlays)
 * - Legacy: simple canon facts and tone (for backwards compatibility)
 */

import { useState, useCallback } from 'react';
import { LocalTextArea } from '@penguin-tales/shared-components';

const DESCRIPTION_TEXTAREA_STYLE = Object.freeze({ minHeight: '100px', resize: 'vertical' });
const TONE_TEXTAREA_STYLE = Object.freeze({ minHeight: '80px', resize: 'vertical' });
const COMPACT_TEXTAREA_STYLE = Object.freeze({ minHeight: '60px', resize: 'vertical', fontSize: '12px' });

// ============================================================================
// Canon Facts Editor
// ============================================================================

function FactCard({ fact, onUpdate, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = (field, value) => {
    const next = { ...fact, [field]: value };
    if (field === 'type' && value === 'generation_constraint') {
      next.required = false;
    }
    if (field === 'disabled' && value) {
      next.required = false;
    }
    onUpdate(next);
  };

  const isConstraint = fact.type === 'generation_constraint';
  const isDisabled = Boolean(fact.disabled);

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        marginBottom: '8px',
        overflow: 'hidden',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            minWidth: '120px',
          }}
        >
          {fact.id}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fact.text}
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: isConstraint ? 'var(--warning-bg, #4a3f00)' : 'var(--bg-secondary)',
            borderRadius: '4px',
            color: isConstraint ? 'var(--warning, #ffc107)' : 'var(--text-muted)',
          }}
          title={isConstraint ? 'Meta-instruction (always verbatim)' : 'World truth (faceted by perspective)'}
        >
          {isConstraint ? 'constraint' : 'truth'}
        </span>
        {fact.required && !isConstraint && !isDisabled && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              color: 'var(--accent-color)',
            }}
            title="Required fact (must be included in perspective facets)"
          >
            required
          </span>
        )}
        {isDisabled && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
            }}
            title="Disabled — excluded from perspective synthesis and generation"
          >
            disabled
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '14px',
          }}
        >
          ×
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Text
            </label>
            <LocalTextArea
              value={fact.text || ''}
              onChange={(value) => updateField('text', value)}
              className="illuminator-input"
              style={COMPACT_TEXTAREA_STYLE}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Fact Type
              </label>
              <select
                value={fact.type || 'world_truth'}
                onChange={(e) => updateField('type', e.target.value)}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              >
                <option value="world_truth">World Truth (faceted by perspective)</option>
                <option value="generation_constraint">Generation Constraint (always verbatim)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Required
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(fact.required) && !isConstraint && !isDisabled}
                  onChange={(e) => updateField('required', e.target.checked)}
                  disabled={isConstraint || isDisabled}
                />
                <span style={{ color: 'var(--text-secondary)' }}>
                  Always include in facets
                </span>
              </label>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Disabled
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={isDisabled}
                  onChange={(e) => {
                    const next = { ...fact, disabled: e.target.checked };
                    if (e.target.checked) next.required = false;
                    onUpdate(next);
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>
                  Exclude from prompts
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FactsEditor({ facts, onChange }) {
  const [newFactId, setNewFactId] = useState('');

  const normalizeFact = (fact) => ({
    id: fact.id,
    text: fact.text || '',
    type: fact.type || 'world_truth',
    required: fact.type === 'generation_constraint' || fact.disabled ? false : Boolean(fact.required),
    disabled: Boolean(fact.disabled),
  });

  const handleAddFact = () => {
    if (!newFactId.trim()) return;
    const newFact = normalizeFact({
      id: newFactId.trim().toLowerCase().replace(/\s+/g, '-'),
      text: '',
      type: 'world_truth',
      required: false,
    });
    onChange([...facts, newFact]);
    setNewFactId('');
  };

  const handleUpdateFact = (index, updatedFact) => {
    const newFacts = [...facts];
    newFacts[index] = normalizeFact(updatedFact);
    onChange(newFacts.map(normalizeFact));
  };

  const handleRemoveFact = (index) => {
    onChange(facts.filter((_, i) => i !== index).map(normalizeFact));
  };

  return (
    <div>
      {facts.map((fact, index) => (
        <FactCard
          key={fact.id || index}
          fact={fact}
          onUpdate={(updated) => handleUpdateFact(index, updated)}
          onRemove={() => handleRemoveFact(index)}
        />
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          value={newFactId}
          onChange={(e) => setNewFactId(e.target.value)}
          placeholder="new-fact-id"
          className="illuminator-input"
          style={{ flex: 1, fontSize: '12px' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
        />
        <button
          onClick={handleAddFact}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newFactId.trim()}
        >
          Add Fact
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// World Dynamics Editor
// ============================================================================

function WorldDynamicCard({ dynamic, onUpdate, onRemove, eras }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newOverrideEraId, setNewOverrideEraId] = useState('');

  const updateField = (field, value) => {
    onUpdate({ ...dynamic, [field]: value });
  };

  const formatArray = (arr) => (arr || []).filter((s) => s !== '*').join(', ');
  const parseArray = (str) => {
    const items = str.split(',').map((s) => s.trim()).filter(Boolean);
    return items.length === 0 ? [] : items;
  };

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            minWidth: '120px',
          }}
        >
          {dynamic.id}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dynamic.text}
        </span>
        {dynamic.cultures?.length > 0 && dynamic.cultures[0] !== '*' && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
            }}
          >
            {dynamic.cultures.length} culture{dynamic.cultures.length !== 1 ? 's' : ''}
          </span>
        )}
        {dynamic.kinds?.length > 0 && dynamic.kinds[0] !== '*' && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
            }}
          >
            {dynamic.kinds.length} kind{dynamic.kinds.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '14px',
          }}
        >
          ×
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Dynamic Statement
            </label>
            <LocalTextArea
              value={dynamic.text || ''}
              onChange={(value) => updateField('text', value)}
              className="illuminator-input"
              style={COMPACT_TEXTAREA_STYLE}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Cultures (comma-separated, empty = always)
              </label>
              <input
                type="text"
                value={formatArray(dynamic.cultures)}
                onChange={(e) => updateField('cultures', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
                placeholder="e.g., nightshelf, aurora_stack"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Kinds (comma-separated, empty = always)
              </label>
              <input
                type="text"
                value={formatArray(dynamic.kinds)}
                onChange={(e) => updateField('kinds', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
                placeholder="e.g., artifact, npc"
              />
            </div>
          </div>

          {/* Era Overrides */}
          {eras && eras.length > 0 && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Era Overrides (optional — adjust this dynamic for specific eras)
              </label>
              {Object.entries(dynamic.eraOverrides || {}).map(([eraId, override]) => {
                const eraName = eras.find((e) => e.id === eraId)?.name || eraId;
                return (
                  <div
                    key={eraId}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      marginBottom: '6px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--accent-color)' }}>
                        {eraName}
                      </span>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                        <input
                          type="checkbox"
                          checked={override.replace}
                          onChange={(e) => {
                            const newOverrides = { ...dynamic.eraOverrides };
                            newOverrides[eraId] = { ...override, replace: e.target.checked };
                            updateField('eraOverrides', newOverrides);
                          }}
                        />
                        Replace (instead of append)
                      </label>
                      <button
                        onClick={() => {
                          const newOverrides = { ...dynamic.eraOverrides };
                          delete newOverrides[eraId];
                          updateField('eraOverrides', Object.keys(newOverrides).length > 0 ? newOverrides : undefined);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '13px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <LocalTextArea
                      value={override.text || ''}
                      onChange={(value) => {
                        const newOverrides = { ...dynamic.eraOverrides };
                        newOverrides[eraId] = { ...override, text: value };
                        updateField('eraOverrides', newOverrides);
                      }}
                      className="illuminator-input"
                      style={{ ...COMPACT_TEXTAREA_STYLE, minHeight: '40px' }}
                      placeholder={override.replace ? 'Replacement text for this era...' : 'Additional context for this era (appended)...'}
                    />
                  </div>
                );
              })}
              {/* Add new era override */}
              {(() => {
                const existingEraIds = new Set(Object.keys(dynamic.eraOverrides || {}));
                const availableEras = eras.filter((e) => !existingEraIds.has(e.id));
                if (availableEras.length === 0) return null;
                return (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <select
                      value={newOverrideEraId}
                      onChange={(e) => setNewOverrideEraId(e.target.value)}
                      className="illuminator-input"
                      style={{ flex: 1, fontSize: '12px' }}
                    >
                      <option value="">Select era...</option>
                      {availableEras.map((era) => (
                        <option key={era.id} value={era.id}>{era.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!newOverrideEraId) return;
                        const newOverrides = { ...(dynamic.eraOverrides || {}), [newOverrideEraId]: { text: '', replace: false } };
                        updateField('eraOverrides', newOverrides);
                        setNewOverrideEraId('');
                      }}
                      className="illuminator-button illuminator-button-secondary"
                      disabled={!newOverrideEraId}
                      style={{ fontSize: '12px' }}
                    >
                      Add Override
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorldDynamicsEditor({ dynamics, onChange, eras }) {
  const [newDynamicId, setNewDynamicId] = useState('');

  const handleAddDynamic = () => {
    if (!newDynamicId.trim()) return;
    const newDynamic = {
      id: newDynamicId.trim().toLowerCase().replace(/\s+/g, '-'),
      text: '',
      cultures: [],
      kinds: [],
    };
    onChange([...dynamics, newDynamic]);
    setNewDynamicId('');
  };

  const handleUpdateDynamic = (index, updated) => {
    const newDynamics = [...dynamics];
    newDynamics[index] = updated;
    onChange(newDynamics);
  };

  const handleRemoveDynamic = (index) => {
    onChange(dynamics.filter((_, i) => i !== index));
  };

  return (
    <div>
      {dynamics.map((dynamic, index) => (
        <WorldDynamicCard
          key={dynamic.id || index}
          dynamic={dynamic}
          onUpdate={(updated) => handleUpdateDynamic(index, updated)}
          onRemove={() => handleRemoveDynamic(index)}
          eras={eras}
        />
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          value={newDynamicId}
          onChange={(e) => setNewDynamicId(e.target.value)}
          placeholder="new-dynamic-id"
          className="illuminator-input"
          style={{ flex: 1, fontSize: '12px' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddDynamic()}
        />
        <button
          onClick={handleAddDynamic}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newDynamicId.trim()}
        >
          Add Dynamic
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Tone Fragments Editor
// ============================================================================

function ToneFragmentsEditor({ fragments, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...fragments, [field]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Core Tone */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Core Tone (always included)
        </label>
        <LocalTextArea
          value={fragments?.core || ''}
          onChange={(value) => updateField('core', value)}
          placeholder="Core style principles that apply to all chronicles..."
          className="illuminator-input"
          style={{ minHeight: '200px', resize: 'vertical', fontSize: '12px' }}
        />
      </div>

      {/* Note about where other guidance lives */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        padding: '10px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)'
      }}>
        <strong>Note:</strong> Culture-specific prose guidance is now in{' '}
        <em>Identity → Descriptive → PROSE_STYLE</em>.{' '}
        Entity kind prose guidance is in <em>Guidance → [kind] → proseHint</em>.{' '}
        These are automatically assembled during perspective synthesis based on the chronicle's entity constellation.
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="illuminator-input"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleAdd}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newItem.trim()}
        >
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <span style={{ flex: 1 }}>{item}</span>
            <button
              onClick={() => handleRemove(index)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorldContextEditor({ worldContext, onWorldContextChange, eras, onGenerateDynamics, isGeneratingDynamics }) {
  const updateField = useCallback(
    (field, value) => {
      onWorldContextChange({ [field]: value });
    },
    [onWorldContextChange]
  );

  return (
    <div>
      {/* Info Banner */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--accent-color)',
        }}
      >
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
          Entity context is built automatically
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Relationships, cultural peers, faction members, and entity age are extracted from the
          simulation data. This panel only configures world-level context that applies to all
          entities.
        </div>
      </div>

      {/* World Identity */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Identity</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Name</label>
          <input
            type="text"
            value={worldContext.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Description</label>
          <LocalTextArea
            value={worldContext.description || ''}
            onChange={(value) => updateField('description', value)}
            placeholder="Brief description of your world's setting, themes, and what makes it unique..."
            className="illuminator-input"
            style={DESCRIPTION_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* Species Constraint */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Species Constraint</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Rule for what species can appear in generated images. This is added as a SPECIES REQUIREMENT
          at the top of image prompts to ensure all depicted figures match your world's inhabitants.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.speciesConstraint || ''}
            onChange={(value) => updateField('speciesConstraint', value)}
            placeholder="e.g., All depicted figures must be penguins or orcas. No humans exist in this world."
            className="illuminator-input"
            style={TONE_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* World Context Configuration */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '2px solid var(--accent-color)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Chronicle Generation
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tone and facts for chronicle generation. Chronicles use perspective synthesis
            to create focused, faceted views based on each chronicle's entity constellation.
          </p>
        </div>

        {/* Canon Facts */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Canon Facts</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            World truths and generation constraints. Required facts must appear in perspective
            facets. Generation constraints are always included verbatim and never faceted.
          </p>
          <div className="illuminator-form-group" style={{ marginBottom: '16px' }}>
            <label className="illuminator-label">Facet Range (optional)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                step="1"
                value={worldContext.factSelection?.minCount ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  const parsed =
                    raw === ''
                      ? undefined
                      : Number.isFinite(num)
                        ? Math.max(1, Math.floor(num))
                        : undefined;
                  updateField('factSelection', { ...(worldContext.factSelection || {}), minCount: parsed });
                }}
                placeholder="min (4)"
                className="illuminator-input"
                style={{ maxWidth: '100px' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="number"
                min="1"
                step="1"
                value={worldContext.factSelection?.maxCount ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  const parsed =
                    raw === ''
                      ? undefined
                      : Number.isFinite(num)
                        ? Math.max(1, Math.floor(num))
                        : undefined;
                  updateField('factSelection', { ...(worldContext.factSelection || {}), maxCount: parsed });
                }}
                placeholder="max (6)"
                className="illuminator-input"
                style={{ maxWidth: '100px' }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Range of world-truth facts to facet. Required facts count toward this; min is raised
              to match required count if needed.
            </div>
          </div>
          <FactsEditor
            facts={worldContext.canonFactsWithMetadata || []}
            onChange={(facts) => updateField('canonFactsWithMetadata', facts)}
          />
        </div>

        {/* World Dynamics */}
        <div className="illuminator-card">
          <div className="illuminator-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="illuminator-card-title">World Dynamics</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const parsed = JSON.parse(ev.target.result);
                        if (!Array.isArray(parsed)) {
                          alert('Invalid dynamics file: expected a JSON array.');
                          return;
                        }
                        const valid = parsed.every((d) => d && typeof d.id === 'string' && typeof d.text === 'string');
                        if (!valid) {
                          alert('Invalid dynamics file: each entry must have id and text strings.');
                          return;
                        }
                        updateField('worldDynamics', parsed);
                      } catch (err) {
                        alert(`Failed to parse dynamics JSON: ${err.message}`);
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                Import JSON
              </button>
              {(worldContext.worldDynamics?.length > 0) && (
                <button
                  onClick={() => {
                    const json = JSON.stringify(worldContext.worldDynamics, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `dynamics-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="illuminator-button illuminator-button-secondary"
                  style={{ padding: '4px 12px', fontSize: '11px' }}
                >
                  Export JSON
                </button>
              )}
              {onGenerateDynamics && (
                <button
                  onClick={onGenerateDynamics}
                  disabled={isGeneratingDynamics}
                  className="illuminator-button illuminator-button-secondary"
                  style={{ padding: '4px 12px', fontSize: '11px' }}
                >
                  {isGeneratingDynamics ? 'Generating...' : 'Generate from Lore'}
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Higher-level narrative context about inter-group forces and behaviors.
            These statements describe macro-level dynamics that individual relationships are expressions of.
            Optionally filter by culture or entity kind so they only appear in relevant chronicles.
          </p>
          <WorldDynamicsEditor
            dynamics={worldContext.worldDynamics || []}
            onChange={(dynamics) => updateField('worldDynamics', dynamics)}
            eras={eras}
          />
        </div>

        {/* Tone Fragments */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Tone Fragments</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Composable tone guidance. Core is always included; culture and kind overlays
            are added based on the chronicle's entity constellation.
          </p>
          <ToneFragmentsEditor
            fragments={worldContext.toneFragments || {}}
            onChange={(fragments) => updateField('toneFragments', fragments)}
          />
        </div>
      </div>
    </div>
  );
}
