/**
 * EffectsTab - Configure state updates (pressure modifications, tags, status changes, etc.)
 *
 * Supports all mutation types used by templates:
 * - modify_pressure: Change pressure values
 * - archive_relationship: End existing relationships
 * - change_status: Change entity status
 * - set_tag: Add/update tags on entities
 * - remove_tag: Remove tags from entities
 * - update_rate_limit: Track template execution for rate limiting
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MutationCard, { DEFAULT_MUTATION_TYPES } from '../../shared/MutationCard';
import { MUTATION_TYPE_OPTIONS } from '../../actions/constants';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Object} props.schema - Domain schema
 */
export function EffectsTab({ generator, onChange, pressures, schema }) {
  const stateUpdates = generator.stateUpdates || [];
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const addButtonRef = useRef(null);

  // Build available entity references from target + variables + created entities
  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => { if (c.entityRef) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, generator.creation]);

  const createMutation = (type) => {
    let newUpdate;
    switch (type) {
      case 'modify_pressure':
        newUpdate = { type: 'modify_pressure', pressureId: pressures?.[0]?.id || '', delta: 0 };
        break;
      case 'archive_relationship':
        newUpdate = { type: 'archive_relationship', entity: '$target', relationshipKind: '', direction: 'both' };
        break;
      case 'change_status':
        newUpdate = { type: 'change_status', entity: '$target', newStatus: '' };
        break;
      case 'set_tag':
        newUpdate = { type: 'set_tag', entity: '$target', tag: '', value: true };
        break;
      case 'remove_tag':
        newUpdate = { type: 'remove_tag', entity: '$target', tag: '' };
        break;
      case 'update_rate_limit':
        newUpdate = { type: 'update_rate_limit' };
        break;
      default:
        return null;
    }
    return newUpdate;
  };

  const addMutation = (type) => {
    const next = createMutation(type);
    if (!next) return;
    onChange({ ...generator, stateUpdates: [...stateUpdates, next] });
  };

  const updateMutation = (index, updated) => {
    const newUpdates = [...stateUpdates];
    newUpdates[index] = updated;
    onChange({ ...generator, stateUpdates: newUpdates });
  };

  const removeMutation = (index) => {
    onChange({ ...generator, stateUpdates: stateUpdates.filter((_, i) => i !== index) });
  };

  const knownTypes = new Set(DEFAULT_MUTATION_TYPES.map((type) => type.value));
  const unrecognizedUpdates = stateUpdates
    .map((update, index) => (knownTypes.has(update.type) ? null : { update, index }))
    .filter(Boolean);

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
      {/* Unrecognized Effects - shown first to draw attention */}
      {unrecognizedUpdates.length > 0 && (
        <div className="section" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#f87171' }}><span>⚠️</span> Unrecognized Effects</div>
          <div className="section-desc" style={{ marginBottom: '12px' }}>
            These state updates have unrecognized types and may be from an older version.
            Remove them to clear validation errors.
          </div>

          {unrecognizedUpdates.map((entry) => {
            const globalIdx = entry.index;
            const update = entry.update;
            return (
              <div key={globalIdx} className="item-card" style={{ borderColor: 'rgba(248, 113, 113, 0.4)' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', color: '#f87171' }}>
                        Unknown type: "{update.type || '(no type)'}"
                      </div>
                      <pre style={{
                        fontSize: '11px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        padding: '8px',
                        borderRadius: '4px',
                        overflow: 'auto',
                        margin: 0,
                      }}>
                        {JSON.stringify(update, null, 2)}
                      </pre>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => removeMutation(globalIdx)}
                      style={{ flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section">
        <div className="section-title">⚡ Effects ({stateUpdates.length})</div>
        <div className="section-desc">
          Apply state updates when this generator runs. Effects use the unified mutation library.
        </div>

        {stateUpdates.map((update, index) => {
          if (!knownTypes.has(update.type)) return null;
          return (
            <MutationCard
              key={index}
              mutation={update}
              onChange={(updated) => updateMutation(index, updated)}
              onRemove={() => removeMutation(index)}
              schema={schema}
              pressures={pressures}
              entityOptions={availableRefs}
              typeOptions={DEFAULT_MUTATION_TYPES}
              createMutation={createMutation}
            />
          );
        })}

        <div ref={addButtonRef} style={{ position: 'relative', marginTop: '12px' }}>
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="btn-add-inline"
          >
            + Add Effect
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
    </div>
  );
}

export default EffectsTab;
