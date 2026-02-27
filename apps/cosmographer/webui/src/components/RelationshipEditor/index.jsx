/**
 * RelationshipEditor - Create and manage relationships between seed entities.
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { NumberInput } from "@penguin-tales/shared-components";
import "./RelationshipEditor.css";

export default function RelationshipEditor({ project, onSave }) {
  const [showModal, setShowModal] = useState(false);
  const [filterKind, setFilterKind] = useState("");
  const [newRel, setNewRel] = useState({ kind: "", src: "", dst: "", strength: 1 });

  const relationships = project?.seedRelationships || [];
  const entities = project?.seedEntities || [];
  // Schema v2: relationshipKinds at project root
  const relationshipKinds = project?.relationshipKinds || [];

  const filteredRels = filterKind
    ? relationships.filter((r) => r.kind === filterKind)
    : relationships;

  const updateRelationships = (newRels) => {
    onSave({ seedRelationships: newRels });
  };

  const addRelationship = () => {
    if (!newRel.kind || !newRel.src || !newRel.dst) {
      alert("Please fill all required fields");
      return;
    }

    if (newRel.src === newRel.dst) {
      alert("Source and destination must be different");
      return;
    }

    const rel = {
      kind: newRel.kind,
      src: newRel.src,
      dst: newRel.dst,
      strength: parseFloat(newRel.strength) || 1,
    };

    updateRelationships([...relationships, rel]);
    setShowModal(false);
    setNewRel({ kind: "", src: "", dst: "", strength: 1 });
  };

  const deleteRelationship = (rel) => {
    if (!confirm("Delete this relationship?")) return;
    updateRelationships(
      relationships.filter((r) => !(r.kind === rel.kind && r.src === rel.src && r.dst === rel.dst))
    );
  };

  const getEntityName = (entityId) => {
    const entity = entities.find((e) => e.id === entityId);
    return entity?.name || entityId;
  };

  const getRelKindName = (kindId) => {
    const kind = relationshipKinds.find((k) => k.kind === kindId);
    return kind?.description || kind?.kind || kindId;
  };

  // Filter entities by allowed source/dest kinds for the selected relationship
  const selectedRelKind = relationshipKinds.find((k) => k.kind === newRel.kind);
  const allowedSrcEntities = selectedRelKind?.srcKinds?.length
    ? entities.filter((e) => selectedRelKind.srcKinds.includes(e.kind))
    : entities;
  const allowedDstEntities = selectedRelKind?.dstKinds?.length
    ? entities.filter((e) => selectedRelKind.dstKinds.includes(e.kind))
    : entities;

  return (
    <div className="re-container">
      <div className="re-header">
        <div className="re-title">Relationships</div>
        <div className="re-subtitle">Define connections between seed entities.</div>
      </div>

      <div className="re-toolbar">
        <select
          className="re-filter-select"
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
        >
          <option value="">All kinds ({relationships.length})</option>
          {relationshipKinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({relationships.filter((r) => r.kind === k.kind).length})
            </option>
          ))}
        </select>
        <button
          className="re-add-button"
          onClick={() => setShowModal(true)}
          disabled={entities.length < 2 || relationshipKinds.length === 0}
        >
          + Add Relationship
        </button>
        {entities.length < 2 && (
          <span className="re-hint">Need at least 2 entities</span>
        )}
        {relationshipKinds.length === 0 && (
          <span className="re-hint">
            Define relationship kinds in Schema first
          </span>
        )}
      </div>

      {filteredRels.length === 0 ? (
        <div className="re-empty-state">
          {relationships.length === 0
            ? "No relationships yet. Create one to connect entities."
            : "No relationships match the filter."}
        </div>
      ) : (
        <table className="re-table">
          <thead>
            <tr>
              <th className="re-th">Kind</th>
              <th className="re-th">Source</th>
              <th className="re-th"></th>
              <th className="re-th">Destination</th>
              <th className="re-th">Strength</th>
              <th className="re-th"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRels.map((rel, idx) => (
              <tr key={`${rel.kind}-${rel.src}-${rel.dst}-${idx}`}>
                <td className="re-td">
                  <span className="re-kind-badge">{getRelKindName(rel.kind)}</span>
                </td>
                <td className="re-td">
                  <span className="re-entity-link">{getEntityName(rel.src)}</span>
                </td>
                <td className="re-td-arrow">
                  <span className="re-arrow">→</span>
                </td>
                <td className="re-td">
                  <span className="re-entity-link">{getEntityName(rel.dst)}</span>
                </td>
                <td className="re-td">{rel.strength}</td>
                <td className="re-td-actions">
                  <button className="re-delete-button" onClick={() => deleteRelationship(rel)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Relationship Modal */}
      {showModal && (
        <div className="re-modal" onClick={() => setShowModal(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          <div className="re-modal-content" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
            <div className="re-modal-title">Add Relationship</div>

            <div className="re-form-group">
              <label htmlFor="relationship-kind" className="re-label">Relationship Kind</label>
              <select id="relationship-kind"
                className="re-select"
                value={newRel.kind}
                onChange={(e) => setNewRel({ ...newRel, kind: e.target.value, src: "", dst: "" })}
              >
                <option value="">Select kind...</option>
                {relationshipKinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.description || k.kind}
                  </option>
                ))}
              </select>
            </div>

            <div className="re-form-group">
              <label htmlFor="source-entity" className="re-label">Source Entity</label>
              <select id="source-entity"
                className="re-select"
                value={newRel.src}
                onChange={(e) => setNewRel({ ...newRel, src: e.target.value })}
                disabled={!newRel.kind}
              >
                <option value="">Select source...</option>
                {allowedSrcEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.kind})
                  </option>
                ))}
              </select>
            </div>

            <div className="re-form-group">
              <label htmlFor="destination-entity" className="re-label">Destination Entity</label>
              <select id="destination-entity"
                className="re-select"
                value={newRel.dst}
                onChange={(e) => setNewRel({ ...newRel, dst: e.target.value })}
                disabled={!newRel.kind}
              >
                <option value="">Select destination...</option>
                {allowedDstEntities
                  .filter((e) => e.id !== newRel.src)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.kind})
                    </option>
                  ))}
              </select>
            </div>

            <div className="re-form-group">
              <label className="re-label">Strength (0-1)
              <NumberInput
                className="re-input"
                min={0}
                max={1}
                step={0.1}
                value={newRel.strength}
                onChange={(v) => setNewRel({ ...newRel, strength: v ?? 0.5 })}
              />
              </label>
            </div>

            <div className="re-modal-actions">
              <button className="re-button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="re-add-button" onClick={addRelationship}>
                Add Relationship
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

RelationshipEditor.propTypes = {
  project: PropTypes.object,
  onSave: PropTypes.func.isRequired,
};
