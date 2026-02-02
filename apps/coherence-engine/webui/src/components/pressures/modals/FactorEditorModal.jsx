/**
 * FactorEditorModal - Modal for editing feedback factors
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FACTOR_TYPES } from '../constants';
import { ReferenceDropdown, ChipSelect, NumberInput } from '../../shared';
import TagSelector from '@penguin-tales/shared-components/TagSelector';

export function FactorEditorModal({
  isOpen,
  onClose,
  factor,
  onChange,
  feedbackType,
  schema,
}) {
  const [localFactor, setLocalFactor] = useState(factor || { type: 'entity_count' });
  const [selectedType, setSelectedType] = useState(factor?.type || 'entity_count');

  // Build options from schema
  const entityKindOptions = useMemo(() => {
    return (schema?.entityKinds || []).map(ek => ({
      value: ek.kind,
      label: ek.description || ek.kind,
    }));
  }, [schema]);

  const getSubtypeOptions = useCallback((kind) => {
    const ek = (schema?.entityKinds || []).find(e => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map(st => ({
      value: st.id,
      label: st.name || st.id,
    }));
  }, [schema]);

  const getStatusOptions = useCallback((kind) => {
    const ek = (schema?.entityKinds || []).find(e => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map(st => ({
      value: st.id,
      label: st.name || st.id,
      meta: st.isTerminal ? 'terminal' : '',
    }));
  }, [schema]);

  const relationshipKindOptions = useMemo(() => {
    return (schema?.relationshipKinds || []).map(rk => ({
      value: rk.kind,
      label: rk.description || rk.kind,
    }));
  }, [schema]);

  useEffect(() => {
    if (factor) {
      setLocalFactor(factor);
      setSelectedType(factor.type);
    } else {
      setLocalFactor({ type: 'entity_count', coefficient: 1 });
      setSelectedType('entity_count');
    }
  }, [factor, isOpen]);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    // Reset factor to defaults for new type
    const defaults = { type, coefficient: 1 };
    if (type === 'ratio') {
      defaults.numerator = { type: 'entity_count' };
      defaults.denominator = { type: 'entity_count' };
      defaults.fallbackValue = 0;
    }
    setLocalFactor(defaults);
  };

  const updateField = (field, value) => {
    setLocalFactor(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onChange(localFactor);
    onClose();
  };

  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const typeConfig = FACTOR_TYPES[selectedType];

  // Render numerator/denominator editor for ratio type
  const renderCountEditor = (countObj, onCountChange, label) => {
    const countType = countObj?.type || 'entity_count';
    return (
      <div className="nested-section">
        <div className="nested-title">{label}</div>
        <div className="input-grid">
          <ReferenceDropdown
            label="Count Type"
            value={countType}
            onChange={(v) => onCountChange({ ...countObj, type: v })}
            options={[
              { value: 'entity_count', label: 'Entity Count' },
              { value: 'relationship_count', label: 'Relationship Count' },
              { value: 'total_entities', label: 'Total Entities' },
            ]}
          />
          {countType === 'entity_count' && (
            <>
              <ReferenceDropdown
                label="Entity Kind"
                value={countObj?.kind || ''}
                onChange={(v) => onCountChange({ ...countObj, kind: v, subtype: undefined })}
                options={entityKindOptions}
                placeholder="Select kind..."
              />
              {countObj?.kind && (
                <ReferenceDropdown
                  label="Subtype (optional)"
                  value={countObj?.subtype || ''}
                  onChange={(v) => onCountChange({ ...countObj, subtype: v || undefined })}
                  options={getSubtypeOptions(countObj.kind)}
                  placeholder="Any subtype"
                />
              )}
            </>
          )}
          {countType === 'relationship_count' && (
            <ChipSelect
              label="Relationship Kinds"
              value={countObj?.relationshipKinds || []}
              onChange={(v) => onCountChange({ ...countObj, relationshipKinds: v })}
              options={relationshipKindOptions}
              placeholder="Select relationships..."
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <span>{typeConfig?.icon}</span>
            {factor ? 'Edit Factor' : 'Add Factor'}
            <span style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: feedbackType === 'positive' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: feedbackType === 'positive' ? '#86efac' : '#fca5a5',
            }}>
              {feedbackType === 'positive' ? '+ Positive' : '− Negative'}
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {/* Type selector - compact pills */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">Factor Type</label>
            <div className="type-selector">
              {Object.entries(FACTOR_TYPES).map(([type, config]) => (
                <div
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`type-pill ${selectedType === type ? 'type-pill-selected' : ''}`}
                >
                  <span className="type-pill-icon">{config.icon}</span>
                  <span>{config.label}</span>
                </div>
              ))}
            </div>
            {typeConfig && (
              <div className="type-description">
                {typeConfig.description}
              </div>
            )}
          </div>

          {/* Type-specific fields */}
          <div className="input-grid">
            {/* Entity Count fields */}
            {selectedType === 'entity_count' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={localFactor.kind || ''}
                  onChange={(v) => updateField('kind', v)}
                  options={entityKindOptions}
                  placeholder="Select kind..."
                />
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Subtype (optional)"
                    value={localFactor.subtype || ''}
                    onChange={(v) => updateField('subtype', v || undefined)}
                    options={getSubtypeOptions(localFactor.kind)}
                    placeholder="Any subtype"
                  />
                )}
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Status (optional)"
                    value={localFactor.status || ''}
                    onChange={(v) => updateField('status', v || undefined)}
                    options={getStatusOptions(localFactor.kind)}
                    placeholder="Any status"
                  />
                )}
              </>
            )}

            {/* Relationship Count fields */}
            {selectedType === 'relationship_count' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <ChipSelect
                  label="Relationship Kinds"
                  value={localFactor.relationshipKinds || []}
                  onChange={(v) => updateField('relationshipKinds', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship types..."
                />
              </div>
            )}

            {/* Tag Count fields */}
            {selectedType === 'tag_count' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">Tags</label>
                <TagSelector
                  value={localFactor.tags || []}
                  onChange={(v) => updateField('tags', v)}
                  tagRegistry={schema?.tagRegistry || []}
                  placeholder="Select tags..."
                />
              </div>
            )}

            {/* Status Ratio fields */}
            {selectedType === 'status_ratio' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={localFactor.kind || ''}
                  onChange={(v) => {
                    updateField('kind', v);
                    updateField('subtype', undefined);
                    updateField('aliveStatus', undefined);
                  }}
                  options={entityKindOptions}
                  placeholder="Select kind..."
                />
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Subtype (optional)"
                    value={localFactor.subtype || ''}
                    onChange={(v) => updateField('subtype', v || undefined)}
                    options={getSubtypeOptions(localFactor.kind)}
                    placeholder="Any subtype"
                  />
                )}
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Alive Status"
                    value={localFactor.aliveStatus || ''}
                    onChange={(v) => updateField('aliveStatus', v)}
                    options={getStatusOptions(localFactor.kind)}
                    placeholder="Select status..."
                  />
                )}
              </>
            )}

            {/* Cross-Culture Ratio fields */}
            {selectedType === 'cross_culture_ratio' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <ChipSelect
                  label="Relationship Kinds"
                  value={localFactor.relationshipKinds || []}
                  onChange={(v) => updateField('relationshipKinds', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship types..."
                />
              </div>
            )}

            {/* Common numeric fields */}
            <div className="input-group">
              <label className="label">Coefficient</label>
              <NumberInput
                value={localFactor.coefficient ?? 1}
                onChange={(v) => updateField('coefficient', v ?? 0)}
              />
            </div>

            {(selectedType === 'entity_count' || selectedType === 'relationship_count' || selectedType === 'ratio') && (
              <div className="input-group">
                <label className="label">Cap (optional)</label>
                <NumberInput
                  value={localFactor.cap}
                  onChange={(v) => updateField('cap', v)}
                  allowEmpty
                  placeholder="No cap"
                />
              </div>
            )}

            {selectedType === 'ratio' && (
              <div className="input-group">
                <label className="label">Fallback Value</label>
                <NumberInput
                  value={localFactor.fallbackValue ?? 0}
                  onChange={(v) => updateField('fallbackValue', v ?? 0)}
                />
              </div>
            )}
          </div>

          {/* Ratio type: numerator and denominator */}
          {selectedType === 'ratio' && (
            <>
              {renderCountEditor(
                localFactor.numerator,
                (v) => updateField('numerator', v),
                'Numerator'
              )}
              {renderCountEditor(
                localFactor.denominator,
                (v) => updateField('denominator', v),
                'Denominator'
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
          >
            {factor ? 'Save Changes' : 'Add Factor'}
          </button>
        </div>
      </div>
    </div>
  );
}
