/**
 * CreateEntityModal - Manual entity creation and editing form
 *
 * Writes a new entity directly to IndexedDB with no LLM involvement.
 * Two use cases: creating entries for factions that emerged in lore,
 * and creating entity entries for NPCs from the name bank.
 *
 * In edit mode (editEntity provided), all fields except name are editable.
 * Edit mode is only available for manually-created entities (id starts with manual_).
 */

import React, { useState, useMemo, useCallback } from "react";
import type { WorldEntity, EntityKindDefinition, CultureDefinition } from "@canonry/world-schema";
import "./CreateEntityModal.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EraInfo {
  id: string;
  name: string;
  startTick: number;
  endTick: number | null;
}

interface CreateEntityDefaults {
  name?: string;
  kind?: string;
  subtype?: string;
  eraId?: string;
  startTick?: number;
  endTick?: number;
  culture?: string;
}

interface CreateEntityModalProps {
  worldSchema: {
    entityKinds: EntityKindDefinition[];
    cultures: CultureDefinition[];
  };
  eras: EraInfo[];
  /** When provided, the modal opens in edit mode with fields pre-filled. */
  editEntity?: WorldEntity;
  /** Pre-populate fields in create mode (ignored when editEntity is set). */
  defaults?: CreateEntityDefaults;
  onSubmit: (entity: Omit<WorldEntity, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}

const PROMINENCE_OPTIONS = [
  { value: 0, label: "Forgotten" },
  { value: 1, label: "Marginal" },
  { value: 2, label: "Recognized" },
  { value: 3, label: "Renowned" },
  { value: 4, label: "Mythic" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert EntityTags (string | boolean values) to Record<string, string> for the form. */
function tagsToStringRecord(
  tags: Record<string, string | boolean> | undefined
): Record<string, string> {
  if (!tags) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    result[k] = String(v);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateEntityModal({
  worldSchema,
  eras,
  editEntity,
  defaults,
  onSubmit,
  onClose,
}: Readonly<CreateEntityModalProps>) {
  const isEdit = Boolean(editEntity);
  const entityKinds = useMemo(
    () => (worldSchema.entityKinds || []).filter((k) => !k.isFramework),
    [worldSchema.entityKinds]
  );
  const cultures = worldSchema.cultures || [];
  const d = isEdit ? undefined : defaults; // ignore defaults in edit mode

  // Form state — initialized from editEntity (edit mode) or defaults (create mode)
  const [kind, setKind] = useState(() => editEntity?.kind || d?.kind || entityKinds[0]?.kind || "");
  const [name] = useState(() => editEntity?.name || "");
  const [nameInput, setNameInput] = useState(() => editEntity?.name || d?.name || "");
  const [culture, setCulture] = useState(
    () => editEntity?.culture || d?.culture || cultures[0]?.id || ""
  );
  const [prominence, setProminence] = useState(() => editEntity?.prominence ?? 1);
  const [description, setDescription] = useState(() => editEntity?.description || "");
  const [eraId, setEraId] = useState(() => editEntity?.eraId || d?.eraId || "");
  const [startTick, setStartTick] = useState(() => {
    if (editEntity?.temporal?.startTick != null) return String(editEntity.temporal.startTick);
    if (d?.startTick != null) return String(d.startTick);
    return "";
  });
  const [endTick, setEndTick] = useState(() => {
    if (editEntity?.temporal?.endTick != null) return String(editEntity.temporal.endTick);
    if (d?.endTick != null) return String(d.endTick);
    return "";
  });
  const [tags, setTags] = useState<Record<string, string>>(() =>
    tagsToStringRecord(editEntity?.tags)
  );
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");

  // Derived from selected kind
  const kindDef = useMemo(() => entityKinds.find((k) => k.kind === kind), [entityKinds, kind]);
  const subtypes = kindDef?.subtypes || [];
  const statuses = kindDef?.statuses || [];
  const defaultStatus = kindDef?.defaultStatus || statuses[0]?.id || "active";

  const [subtype, setSubtype] = useState(
    () => editEntity?.subtype || d?.subtype || subtypes[0]?.id || ""
  );
  const [status, setStatus] = useState(() => editEntity?.status || defaultStatus);

  // Cascade subtype and status when kind changes (only in create mode or explicit change)
  const handleKindChange = useCallback(
    (newKind: string) => {
      setKind(newKind);
      const def = entityKinds.find((k) => k.kind === newKind);
      setSubtype(def?.subtypes[0]?.id || "");
      setStatus(def?.defaultStatus || def?.statuses[0]?.id || "active");
    },
    [entityKinds]
  );

  // Tag management
  const addTag = useCallback(() => {
    const k = tagKey.trim();
    if (!k) return;
    setTags((prev) => ({ ...prev, [k]: tagValue }));
    setTagKey("");
    setTagValue("");
  }, [tagKey, tagValue]);

  const removeTag = useCallback((key: string) => {
    setTags((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Submit
  const effectiveName = isEdit ? name : nameInput;
  const canSubmit = effectiveName.trim().length > 0 && kind;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const entity: Omit<WorldEntity, "id" | "createdAt" | "updatedAt"> = {
      kind,
      subtype,
      name: effectiveName.trim(),
      culture,
      status,
      prominence,
      description,
      tags,
      coordinates: editEntity?.coordinates || { x: 0, y: 0, z: 0 },
    };
    if (eraId) entity.eraId = eraId;
    const parsedStart = Number(startTick);
    const parsedEnd = endTick ? Number(endTick) : null;
    if (Number.isFinite(parsedStart)) {
      entity.temporal = { startTick: parsedStart, endTick: parsedEnd };
    }
    onSubmit(entity);
  }, [
    canSubmit,
    kind,
    subtype,
    effectiveName,
    culture,
    status,
    prominence,
    description,
    tags,
    eraId,
    startTick,
    endTick,
    editEntity,
    onSubmit,
  ]);

  const title = isEdit ? "Edit Entity" : "Create Entity";
  const submitLabel = isEdit ? "Save Changes" : "Create Entity";

  if (entityKinds.length === 0) {
    return (
      <div className="cem-backdrop">
        <div className="cem-card">
          <div className="cem-header">
            <h2 className="cem-title">{title}</h2>
          </div>
          <div className="cem-empty-body">
            No entity kinds available in the schema.
          </div>
          <div className="cem-footer">
            <button onClick={onClose} className="illuminator-button illuminator-button-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cem-backdrop">
      <div className="cem-card">
        {/* Header */}
        <div className="cem-header">
          <h2 className="cem-title">{title}</h2>
          {isEdit && (
            <p className="cem-edit-subtitle">
              {name}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="cem-body">
          {/* Kind + Subtype row */}
          <div
            className="cem-two-column-grid"
          >
            <div>
              <label htmlFor="kind" className="cem-label">Kind</label>
              <select id="kind"
                value={kind}
                onChange={(e) => handleKindChange(e.target.value)}
                className="illuminator-select cem-full-width"
              >
                {entityKinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.description || k.kind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subtype" className="cem-label">Subtype</label>
              <select id="subtype"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                className="illuminator-select cem-full-width"
                disabled={subtypes.length === 0}
              >
                {subtypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id}
                  </option>
                ))}
                {subtypes.length === 0 && <option value="">None</option>}
              </select>
            </div>
          </div>

          {/* Name — only editable in create mode */}
          {!isEdit && (
            <div className="cem-field-group">
              <label htmlFor="name" className="cem-label">Name *</label>
              <input id="name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Entity name"
                className="illuminator-select cem-full-width-box"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>
          )}

          {/* Culture + Status row */}
          <div
            className="cem-two-column-grid"
          >
            <div>
              <label htmlFor="culture" className="cem-label">Culture</label>
              <select id="culture"
                value={culture}
                onChange={(e) => setCulture(e.target.value)}
                className="illuminator-select cem-full-width"
              >
                {cultures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="cem-label">Status</label>
              <select id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="illuminator-select cem-full-width"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prominence */}
          <div className="cem-field-group">
            <label htmlFor="prominence" className="cem-label">Prominence</label>
            <select id="prominence"
              value={prominence}
              onChange={(e) => setProminence(Number(e.target.value))}
              className="illuminator-select cem-full-width"
            >
              {PROMINENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Era */}
          {eras.length > 0 && (
            <div className="cem-field-group">
              <label htmlFor="era" className="cem-label">Era</label>
              <select id="era"
                value={eraId}
                onChange={(e) => setEraId(e.target.value)}
                className="illuminator-select cem-full-width"
              >
                <option value="">None</option>
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name || era.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Temporal */}
          <div
            className="cem-two-column-grid"
          >
            <div>
              <label htmlFor="start-tick" className="cem-label">Start Tick</label>
              <input id="start-tick"
                type="number"
                value={startTick}
                onChange={(e) => setStartTick(e.target.value)}
                placeholder="Optional"
                className="illuminator-select cem-full-width-box"
              />
            </div>
            <div>
              <label htmlFor="end-tick" className="cem-label">End Tick</label>
              <input id="end-tick"
                type="number"
                value={endTick}
                onChange={(e) => setEndTick(e.target.value)}
                placeholder="Ongoing"
                className="illuminator-select cem-full-width-box"
              />
            </div>
          </div>

          {/* Description */}
          <div className="cem-field-group">
            <label htmlFor="description" className="cem-label">Description</label>
            <textarea id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="illuminator-select cem-textarea"
            />
          </div>

          {/* Tags */}
          <div>
            <span className="cem-label">Tags</span>
            {Object.entries(tags).length > 0 && (
              <div className="cem-tags-container">
                {Object.entries(tags).map(([k, v]) => (
                  <div
                    key={k}
                    className="cem-tag-row"
                  >
                    <span className="cem-tag-key">{k}:</span>
                    <span className="cem-tag-value">{v}</span>
                    <button
                      onClick={() => removeTag(k)}
                      className="cem-remove-tag-btn"
                      title="Remove tag"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="cem-tag-input-row">
              <input
                type="text"
                value={tagKey}
                onChange={(e) => setTagKey(e.target.value)}
                placeholder="key"
                className="illuminator-select cem-tag-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <input
                type="text"
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                placeholder="value"
                className="illuminator-select cem-tag-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                onClick={addTag}
                disabled={!tagKey.trim()}
                className="illuminator-button illuminator-button-secondary cem-add-tag-btn"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cem-footer">
          <button onClick={onClose} className="illuminator-button illuminator-button-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="illuminator-button"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

