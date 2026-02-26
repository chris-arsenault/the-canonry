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
      <div style={backdropStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
          </div>
          <div style={emptyBodyStyle}>
            No entity kinds available in the schema.
          </div>
          <div style={footerStyle}>
            <button onClick={onClose} className="illuminator-button illuminator-button-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={backdropStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          {isEdit && (
            <p style={editSubtitleStyle}>
              {name}
            </p>
          )}
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* Kind + Subtype row */}
          <div
            style={twoColumnGrid}
          >
            <div>
              <label htmlFor="kind" style={labelStyle}>Kind</label>
              <select id="kind"
                value={kind}
                onChange={(e) => handleKindChange(e.target.value)}
                className="illuminator-select"
                style={fullWidthStyle}
              >
                {entityKinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.description || k.kind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subtype" style={labelStyle}>Subtype</label>
              <select id="subtype"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                className="illuminator-select"
                style={fullWidthStyle}
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
            <div style={fieldGroupStyle}>
              <label htmlFor="name" style={labelStyle}>Name *</label>
              <input id="name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Entity name"
                className="illuminator-select"
                style={fullWidthBoxStyle}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>
          )}

          {/* Culture + Status row */}
          <div
            style={twoColumnGrid}
          >
            <div>
              <label htmlFor="culture" style={labelStyle}>Culture</label>
              <select id="culture"
                value={culture}
                onChange={(e) => setCulture(e.target.value)}
                className="illuminator-select"
                style={fullWidthStyle}
              >
                {cultures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" style={labelStyle}>Status</label>
              <select id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="illuminator-select"
                style={fullWidthStyle}
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
          <div style={fieldGroupStyle}>
            <label htmlFor="prominence" style={labelStyle}>Prominence</label>
            <select id="prominence"
              value={prominence}
              onChange={(e) => setProminence(Number(e.target.value))}
              className="illuminator-select"
              style={fullWidthStyle}
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
            <div style={fieldGroupStyle}>
              <label htmlFor="era" style={labelStyle}>Era</label>
              <select id="era"
                value={eraId}
                onChange={(e) => setEraId(e.target.value)}
                className="illuminator-select"
                style={fullWidthStyle}
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
            style={twoColumnGrid}
          >
            <div>
              <label htmlFor="start-tick" style={labelStyle}>Start Tick</label>
              <input id="start-tick"
                type="number"
                value={startTick}
                onChange={(e) => setStartTick(e.target.value)}
                placeholder="Optional"
                className="illuminator-select"
                style={fullWidthBoxStyle}
              />
            </div>
            <div>
              <label htmlFor="end-tick" style={labelStyle}>End Tick</label>
              <input id="end-tick"
                type="number"
                value={endTick}
                onChange={(e) => setEndTick(e.target.value)}
                placeholder="Ongoing"
                className="illuminator-select"
                style={fullWidthBoxStyle}
              />
            </div>
          </div>

          {/* Description */}
          <div style={fieldGroupStyle}>
            <label htmlFor="description" style={labelStyle}>Description</label>
            <textarea id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="illuminator-select"
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            {Object.entries(tags).length > 0 && (
              <div style={{ marginBottom: "8px" }}>
                {Object.entries(tags).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "3px 0",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{k}:</span>
                    <span style={{ flex: 1, color: "var(--text-primary)" }}>{v}</span>
                    <button
                      onClick={() => removeTag(k)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "0 4px",
                      }}
                      title="Remove tag"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                value={tagKey}
                onChange={(e) => setTagKey(e.target.value)}
                placeholder="key"
                className="illuminator-select"
                style={{ flex: 1, boxSizing: "border-box", fontSize: "12px" }}
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
                className="illuminator-select"
                style={{ flex: 1, boxSizing: "border-box", fontSize: "12px" }}
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
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: "4px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
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

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.6)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-primary)",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  width: "500px",
  maxWidth: "95vw",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
};

const headerStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border-color)",
  flexShrink: 0,
};

const footerStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderTop: "1px solid var(--border-color)",
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontWeight: 600,
  marginBottom: "4px",
};

const titleStyle: React.CSSProperties = { margin: 0, fontSize: "16px" };

const editSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "11px",
  color: "var(--text-muted)",
};

const bodyStyle: React.CSSProperties = {
  padding: "16px 20px",
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const twoColumnGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
  marginBottom: "12px",
};

const fullWidthStyle: React.CSSProperties = { width: "100%" };

const fullWidthBoxStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};

const fieldGroupStyle: React.CSSProperties = { marginBottom: "12px" };

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
};

const emptyBodyStyle: React.CSSProperties = {
  padding: "20px",
  fontSize: "13px",
  color: "var(--text-muted)",
};

const tagsContainer: React.CSSProperties = { marginBottom: "8px" };

const tagRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "3px 0",
  fontSize: "12px",
};

const tagKeyStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontWeight: 500,
};

const tagValueStyle: React.CSSProperties = {
  flex: 1,
  color: "var(--text-primary)",
};

const removeTagButton: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "14px",
  padding: "0 4px",
};

const tagInputRow: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
};

const tagInputStyle: React.CSSProperties = {
  flex: 1,
  boxSizing: "border-box",
  fontSize: "12px",
};

const addTagButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: "11px",
  whiteSpace: "nowrap",
};
