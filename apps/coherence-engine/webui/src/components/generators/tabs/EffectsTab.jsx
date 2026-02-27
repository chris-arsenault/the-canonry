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

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import MutationCard, { DEFAULT_MUTATION_TYPES } from "../../shared/MutationCard";
import { MUTATION_TYPE_OPTIONS } from "../../actions/constants";
import "./EffectsTab.css";

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
    const refs = ["$target"];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => {
      if (c.entityRef) refs.push(c.entityRef);
    });
    return refs;
  }, [generator.variables, generator.creation]);

  const createMutation = (type) => {
    let newUpdate;
    switch (type) {
      case "modify_pressure":
        newUpdate = { type: "modify_pressure", pressureId: pressures?.[0]?.id || "", delta: 0 };
        break;
      case "archive_relationship":
        newUpdate = {
          type: "archive_relationship",
          entity: "$target",
          relationshipKind: "",
          direction: "both",
        };
        break;
      case "change_status":
        newUpdate = { type: "change_status", entity: "$target", newStatus: "" };
        break;
      case "set_tag":
        newUpdate = { type: "set_tag", entity: "$target", tag: "", value: true };
        break;
      case "remove_tag":
        newUpdate = { type: "remove_tag", entity: "$target", tag: "" };
        break;
      case "update_rate_limit":
        newUpdate = { type: "update_rate_limit" };
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTypeMenu]);

  return (
    <div>
      {/* Unrecognized Effects - shown first to draw attention */}
      {unrecognizedUpdates.length > 0 && (
        <div className="section et-unrecognized-section">
          <div className="section-title et-unrecognized-title">
            <span>⚠️</span> Unrecognized Effects
          </div>
          <div className="section-desc mb-lg">
            These state updates have unrecognized types and may be from an older version. Remove
            them to clear validation errors.
          </div>

          {unrecognizedUpdates.map((entry) => {
            const globalIdx = entry.index;
            const update = entry.update;
            return (
              <div
                key={globalIdx}
                className="item-card et-unrecognized-card"
              >
                <div className="et-unrecognized-body">
                  <div className="et-unrecognized-layout">
                    <div className="flex-1">
                      <div className="et-unrecognized-type">
                        Unknown type: &quot;{update.type || "(no type)"}&quot;
                      </div>
                      <pre className="et-unrecognized-json">
                        {JSON.stringify(update, null, 2)}
                      </pre>
                    </div>
                    <button
                      className="btn btn-danger flex-shrink-0"
                      onClick={() => removeMutation(globalIdx)}
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

        <div ref={addButtonRef} className="relative mt-lg">
          <button onClick={() => setShowTypeMenu(!showTypeMenu)} className="btn-add-inline">
            + Add Effect
          </button>

          {showTypeMenu && (
            <div
              className="dropdown-menu et-dropdown-fixed"
              // eslint-disable-next-line local/no-inline-styles -- dynamic position from measured DOM rect
              style={{ '--et-dd-top': `${dropdownPos.top}px`, '--et-dd-left': `${dropdownPos.left}px`, '--et-dd-width': `${dropdownPos.width}px`, top: 'var(--et-dd-top)', left: 'var(--et-dd-left)', width: 'var(--et-dd-width)' }}
            >
              {MUTATION_TYPE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    addMutation(opt.value);
                    setShowTypeMenu(false);
                  }}
                  className="dropdown-menu-item"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <span
                    className="dropdown-menu-icon"
                    // eslint-disable-next-line local/no-inline-styles -- dynamic color per mutation type
                    style={{ '--et-icon-bg': `${opt.color}20`, backgroundColor: 'var(--et-icon-bg)' }}
                  >
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

EffectsTab.propTypes = {
  generator: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  pressures: PropTypes.array,
  schema: PropTypes.object,
};

export default EffectsTab;
