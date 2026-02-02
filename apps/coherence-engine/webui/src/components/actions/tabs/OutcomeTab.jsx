/**
 * OutcomeTab - Action outcome configuration
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RELATIONSHIP_REFS, MUTATION_TYPE_OPTIONS } from '../constants';
import MutationCard, { DEFAULT_MUTATION_TYPES } from '../../shared/MutationCard';
import { NumberInput, LocalTextArea } from '../../shared';

const ACTION_MUTATION_TYPES = DEFAULT_MUTATION_TYPES;

export function OutcomeTab({ action, onChange, schema, pressures }) {
  const outcome = action.outcome || {};
  const mutations = outcome.mutations || [];
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const addButtonRef = useRef(null);

  const updateOutcome = (field, value) => {
    onChange({
      ...action,
      outcome: { ...outcome, [field]: value },
    });
  };

  const createMutation = (type) => {
    const defaultPressure = pressures?.[0]?.id || '';
    const defaultEntity = '$actor';
    const defaultTarget = '$target';
    const defaultOther = '$target2';

    switch (type) {
      case 'modify_pressure':
        return { type: 'modify_pressure', pressureId: defaultPressure, delta: 0 };
      case 'set_tag':
        return { type: 'set_tag', entity: defaultTarget, tag: '', value: true };
      case 'remove_tag':
        return { type: 'remove_tag', entity: defaultTarget, tag: '' };
      case 'change_status':
        return { type: 'change_status', entity: defaultTarget, newStatus: '' };
      case 'adjust_prominence':
        return { type: 'adjust_prominence', entity: defaultEntity, delta: 0.1 };
      case 'archive_relationship':
        return { type: 'archive_relationship', entity: defaultEntity, relationshipKind: '', with: defaultTarget, direction: 'both' };
      case 'archive_all_relationships':
        return { type: 'archive_all_relationships', entity: defaultEntity, relationshipKind: '', direction: 'both' };
      case 'adjust_relationship_strength':
        return { type: 'adjust_relationship_strength', kind: '', src: defaultEntity, dst: defaultTarget, delta: 0.1 };
      case 'update_rate_limit':
        return { type: 'update_rate_limit' };
      case 'create_relationship':
      default:
        return {
          type: 'create_relationship',
          kind: '',
          src: defaultEntity,
          dst: defaultTarget || defaultOther,
          strength: 0.5,
        };
    }
  };

  const addMutation = (type) => {
    updateOutcome('mutations', [...mutations, createMutation(type)]);
  };

  const updateMutation = (index, mutation) => {
    const next = [...mutations];
    next[index] = mutation;
    updateOutcome('mutations', next);
  };

  const removeMutation = (index) => {
    updateOutcome('mutations', mutations.filter((_, i) => i !== index));
  };

  useLayoutEffect(() => {
    if (showTypeMenu && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
  }, [showTypeMenu]);

  useEffect(() => {
    if (!showTypeMenu) return;
    const handleClickOutside = (event) => {
      if (addButtonRef.current && !addButtonRef.current.contains(event.target)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeMenu]);

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Action Outcome</div>
        <div className="info-box-text">
          Define what happens when this action succeeds. Create relationships, change statuses,
          modify pressures, or strengthen existing connections.
        </div>
      </div>

      <div className="section">
        <div className="section-title">⚙️ Mutations ({mutations.length})</div>
        <div className="section-desc">
          Apply mutations when the action succeeds. Each mutation uses the unified rules library.
        </div>

        {mutations.map((mutation, index) => (
          <MutationCard
            key={index}
            mutation={mutation}
            onChange={(updated) => updateMutation(index, updated)}
            onRemove={() => removeMutation(index)}
            schema={schema}
            pressures={pressures}
            entityOptions={RELATIONSHIP_REFS}
            typeOptions={ACTION_MUTATION_TYPES}
            createMutation={createMutation}
          />
        ))}

        <div ref={addButtonRef} style={{ position: 'relative', marginTop: '12px' }}>
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="btn-add-inline"
          >
            + Add Mutation
          </button>

          {showTypeMenu && (
            <div
              className="dropdown-menu"
              style={{
                position: 'fixed',
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 10000,
              }}
            >
              {MUTATION_TYPE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    addMutation(opt.value);
                    setShowTypeMenu(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <span className="dropdown-menu-icon" style={{ backgroundColor: `${opt.color}20` }}>
                    {opt.icon}
                  </span>
                  <span className="dropdown-menu-label">{opt.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">⭐ Prominence Changes</div>
        <div className="section-desc">
          Apply prominence changes to actor or target on action success/failure. Values are numeric deltas (e.g., 0.1 or -0.05).
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '8px' }}>Actor Prominence Delta</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="label-micro">On Success</label>
              <NumberInput
                value={outcome.actorProminenceDelta?.onSuccess}
                onChange={(v) => {
                  const current = outcome.actorProminenceDelta || {};
                  const updated = { ...current, onSuccess: v };
                  if (updated.onSuccess === undefined) delete updated.onSuccess;
                  updateOutcome('actorProminenceDelta', Object.keys(updated).length > 0 ? updated : undefined);
                }}
                placeholder="e.g., 0.1"
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label-micro">On Failure</label>
              <NumberInput
                value={outcome.actorProminenceDelta?.onFailure}
                onChange={(v) => {
                  const current = outcome.actorProminenceDelta || {};
                  const updated = { ...current, onFailure: v };
                  if (updated.onFailure === undefined) delete updated.onFailure;
                  updateOutcome('actorProminenceDelta', Object.keys(updated).length > 0 ? updated : undefined);
                }}
                placeholder="e.g., -0.05"
                allowEmpty
              />
            </div>
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: '8px' }}>Target Prominence Delta</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="label-micro">On Success</label>
              <NumberInput
                value={outcome.targetProminenceDelta?.onSuccess}
                onChange={(v) => {
                  const current = outcome.targetProminenceDelta || {};
                  const updated = { ...current, onSuccess: v };
                  if (updated.onSuccess === undefined) delete updated.onSuccess;
                  updateOutcome('targetProminenceDelta', Object.keys(updated).length > 0 ? updated : undefined);
                }}
                placeholder="e.g., 0.1"
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label-micro">On Failure</label>
              <NumberInput
                value={outcome.targetProminenceDelta?.onFailure}
                onChange={(v) => {
                  const current = outcome.targetProminenceDelta || {};
                  const updated = { ...current, onFailure: v };
                  if (updated.onFailure === undefined) delete updated.onFailure;
                  updateOutcome('targetProminenceDelta', Object.keys(updated).length > 0 ? updated : undefined);
                }}
                placeholder="e.g., -0.05"
                allowEmpty
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">📝 Description Template</div>
        <div className="section-desc">
          Template for generating occurrence descriptions. Use {'{actor.name}'}, {'{instigator.name}'}, {'{target.name}'}, etc.
        </div>
        <LocalTextArea
          value={outcome.descriptionTemplate || ''}
          onChange={(value) => updateOutcome('descriptionTemplate', value || undefined)}
          placeholder="e.g., declared war on {target.name}"
        />
      </div>

      <div className="section">
        <div className="section-title">📖 Narration Template</div>
        <div className="section-desc">
          Domain-controlled narrative text. Syntax: {'{entity.field}'}, {'{$var.field}'}, {'{field|fallback}'}, {'{list:entities}'}.
        </div>
        <LocalTextArea
          value={outcome.narrationTemplate || ''}
          onChange={(value) => updateOutcome('narrationTemplate', value || undefined)}
          placeholder="e.g., The {actor.subtype} {actor.name} declared war on {target.name}, shattering the fragile peace."
          rows={3}
        />
      </div>
    </div>
  );
}
