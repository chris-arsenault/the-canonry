/**
 * RelationshipEditor - Create and manage relationships between seed entities.
 */

import React, { useState, useCallback, useMemo } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { NumberInput } from "@the-canonry/shared-components";
import "./RelationshipEditor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationshipData {
  kind: string;
  src: string;
  dst: string;
  strength: number;
}

interface EntityData {
  id: string;
  kind: string;
  name: string;
}

interface RelKindData {
  kind: string;
  description: Optional<string>;
  srcKinds: Optional<string[]>;
  dstKinds: Optional<string[]>;
}

interface RelEditorProject {
  seedRelationships: Optional<RelationshipData[]>;
  seedEntities: Optional<EntityData[]>;
  relationshipKinds: Optional<RelKindData[]>;
}

interface NewRelForm {
  kind: string;
  src: string;
  dst: string;
  strength: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntityName(entities: EntityData[], entityId: string): string {
  const entity = entities.find((e) => e.id === entityId);
  return entity?.name || entityId;
}

function getRelKindName(relationshipKinds: RelKindData[], kindId: string): string {
  const kind = relationshipKinds.find((k) => k.kind === kindId);
  return kind?.description || kind?.kind || kindId;
}

// ---------------------------------------------------------------------------
// AddRelationshipModal
// ---------------------------------------------------------------------------

interface AddRelModalProps {
  newRel: NewRelForm;
  relationshipKinds: RelKindData[];
  allowedSrcEntities: EntityData[];
  allowedDstEntities: EntityData[];
  onNewRelChange: (rel: NewRelForm) => void;
  onAdd: () => void;
  onClose: () => void;
}

// eslint-disable-next-line max-lines-per-function -- modal form with 4 controlled inputs (kind, source, destination, strength); splitting fragments a single logical form
function AddRelationshipModal({
  newRel,
  relationshipKinds,
  allowedSrcEntities,
  allowedDstEntities,
  onNewRelChange,
  onAdd,
  onClose,
}: Readonly<AddRelModalProps>) {
  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClose(); },
    [onClose],
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  const handleStrengthChange = useCallback(
    (v: number | null) => onNewRelChange({ ...newRel, strength: v ?? 0.5 }),
    [onNewRelChange, newRel],
  );

  return (
    <div className="cosmo-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={handleBackdropKeyDown}>
      <div className="cosmo-modal-content" onClick={handleContentClick} role="presentation">
        <div className="cosmo-modal-title">Add Relationship</div>

        <div className="cosmo-form-group">
          <label htmlFor="relationship-kind" className="cosmo-label">Relationship Kind</label>
          <select id="relationship-kind"
            className="cosmo-select"
            value={newRel.kind}
            onChange={(e) => onNewRelChange({ ...newRel, kind: e.target.value, src: "", dst: "" })}
          >
            <option value="">Select kind...</option>
            {relationshipKinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.description || k.kind}
              </option>
            ))}
          </select>
        </div>

        <div className="cosmo-form-group">
          <label htmlFor="source-entity" className="cosmo-label">Source Entity</label>
          <select id="source-entity"
            className="cosmo-select"
            value={newRel.src}
            onChange={(e) => onNewRelChange({ ...newRel, src: e.target.value })}
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

        <div className="cosmo-form-group">
          <label htmlFor="destination-entity" className="cosmo-label">Destination Entity</label>
          <select id="destination-entity"
            className="cosmo-select"
            value={newRel.dst}
            onChange={(e) => onNewRelChange({ ...newRel, dst: e.target.value })}
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

        <div className="cosmo-form-group">
          <label className="cosmo-label">Strength (0-1)
          <NumberInput
            className="cosmo-input"
            min={0}
            max={1}
            step={0.1}
            value={newRel.strength}
            onChange={handleStrengthChange}
          />
          </label>
        </div>

        <div className="cosmo-modal-actions">
          <button className="cosmo-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="cosmo-add-btn" onClick={onAdd}>
            Add Relationship
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelationshipEditor
// ---------------------------------------------------------------------------

interface RelationshipEditorProps {
  project: RelEditorProject;
  onSave: (updates: Partial<RelEditorProject>) => void;
}

const EMPTY_REL: NewRelForm = { kind: "", src: "", dst: "", strength: 1 };

// eslint-disable-next-line max-lines-per-function, complexity -- editor managing relationship list with filter, table display, and add modal; line count from table JSX structure, complexity from CRUD validation guards, kind-constraint entity filtering, and conditional empty states
export default function RelationshipEditor({ project, onSave }: Readonly<RelationshipEditorProps>) {
  const [showModal, setShowModal] = useState(false);
  const [filterKind, setFilterKind] = useState("");
  const [newRel, setNewRel] = useState<NewRelForm>(EMPTY_REL);

  const relationships = useMemo(() => project?.seedRelationships || [], [project?.seedRelationships]);
  const entities = useMemo(() => project?.seedEntities || [], [project?.seedEntities]);
  const relationshipKinds = useMemo(() => project?.relationshipKinds || [], [project?.relationshipKinds]);

  const filteredRels = useMemo(
    () => filterKind ? relationships.filter((r) => r.kind === filterKind) : relationships,
    [filterKind, relationships],
  );

  const addRelationship = useCallback(() => {
    if (!newRel.kind || !newRel.src || !newRel.dst) return;
    if (newRel.src === newRel.dst) return;

    const rel: RelationshipData = {
      kind: newRel.kind,
      src: newRel.src,
      dst: newRel.dst,
      strength: newRel.strength || 1,
    };

    onSave({ seedRelationships: [...relationships, rel] });
    setShowModal(false);
    setNewRel(EMPTY_REL);
  }, [newRel, relationships, onSave]);

  const deleteRelationship = useCallback(
    (rel: RelationshipData) => {
      onSave({
        seedRelationships: relationships.filter(
          (r) => !(r.kind === rel.kind && r.src === rel.src && r.dst === rel.dst),
        ),
      });
    },
    [relationships, onSave],
  );

  const selectedRelKind = relationshipKinds.find((k) => k.kind === newRel.kind);
  const allowedSrcEntities = selectedRelKind?.srcKinds?.length
    ? entities.filter((e) => selectedRelKind.srcKinds.includes(e.kind))
    : entities;
  const allowedDstEntities = selectedRelKind?.dstKinds?.length
    ? entities.filter((e) => selectedRelKind.dstKinds.includes(e.kind))
    : entities;

  const handleOpenModal = useCallback(() => setShowModal(true), []);
  const handleCloseModal = useCallback(() => setShowModal(false), []);
  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setFilterKind(e.target.value),
    [],
  );

  return (
    <div className="cosmo-editor-container">
      <div className="cosmo-editor-header">
        <div className="cosmo-editor-title">Relationships</div>
        <div className="cosmo-editor-subtitle">Define connections between seed entities.</div>
      </div>

      <div className="cosmo-toolbar">
        <select
          className="re-filter-select"
          value={filterKind}
          onChange={handleFilterChange}
        >
          <option value="">All kinds ({relationships.length})</option>
          {relationshipKinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({relationships.filter((r) => r.kind === k.kind).length})
            </option>
          ))}
        </select>
        <button
          className="cosmo-add-btn"
          onClick={handleOpenModal}
          disabled={entities.length < 2 || relationshipKinds.length === 0}
        >
          + Add Relationship
        </button>
        {entities.length < 2 && (
          <span className="cosmo-hint">Need at least 2 entities</span>
        )}
        {relationshipKinds.length === 0 && (
          <span className="cosmo-hint">
            Define relationship kinds in Schema first
          </span>
        )}
      </div>

      {filteredRels.length === 0 ? (
        <div className="viewer-empty-state">
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
                  <span className="re-kind-badge">{getRelKindName(relationshipKinds, rel.kind)}</span>
                </td>
                <td className="re-td">
                  <span className="re-entity-link">{getEntityName(entities, rel.src)}</span>
                </td>
                <td className="re-td-arrow">
                  <span className="cosmo-arrow">→</span>
                </td>
                <td className="re-td">
                  <span className="re-entity-link">{getEntityName(entities, rel.dst)}</span>
                </td>
                <td className="re-td">{rel.strength}</td>
                <td className="re-td-actions">
                  <button className="cosmo-delete-btn" onClick={() => deleteRelationship(rel)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <AddRelationshipModal
          newRel={newRel}
          relationshipKinds={relationshipKinds}
          allowedSrcEntities={allowedSrcEntities}
          allowedDstEntities={allowedDstEntities}
          onNewRelChange={setNewRel}
          onAdd={addRelationship}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
