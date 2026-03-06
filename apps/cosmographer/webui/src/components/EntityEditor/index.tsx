/**
 * EntityEditor - Create and manage seed entities.
 */

import React, { useState, useCallback, useMemo } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { TagSelector, ToolUsageBadges as UsageBadges, getEntityKindUsageSummary, ErrorMessage } from "@the-canonry/shared-components";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import "./EntityEditor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityData {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  summary: Optional<string>;
  narrativeHint: Optional<string>;
  description: Optional<string>;
  status: string;
  prominence: number;
  culture: string;
  tags: Record<string, boolean>;
  links: unknown[];
  coordinates: { x: number; y: number; z: number };
  createdAt: number;
  updatedAt: number;
}

interface EntityKindData {
  kind: string;
  description: Optional<string>;
  subtypes: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; name: string }>;
}

interface CultureData {
  id: string;
  name: Optional<string>;
  color: Optional<string>;
  naming: Optional<{ profiles: Optional<unknown[]> }>;
}

interface EntityEditorProject {
  seedEntities: Optional<EntityData[]>;
  entityKinds: Optional<EntityKindData[]>;
  cultures: Optional<CultureData[]>;
  tagRegistry: Optional<unknown[]>;
}

interface EntityEditorProps {
  project: EntityEditorProject;
  onSave: (updates: Partial<EntityEditorProject>) => void;
  onAddTag: Optional<(tag: unknown) => void>;
  schemaUsage: Optional<Record<string, unknown>>;
}


function getCultureColor(cultures: CultureData[], cultureId: string): string {
  return cultures.find((c) => c.id === cultureId)?.color || "#707080";
}

function hasCultureNaming(entity: Optional<EntityData>, cultures: CultureData[]): boolean {
  if (!entity) return false;
  const culture = cultures.find((c) => c.id === entity.culture);
  return Boolean(culture?.naming?.profiles?.length);
}

function getGenerateTitle(entity: EntityData, canGenerate: boolean): string {
  if (!entity.culture) return "Select a culture first";
  if (!canGenerate) return "Configure naming in Name Forge first";
  return "Generate a culturally-appropriate name";
}

interface EntityListPanelProps {
  entities: EntityData[];
  filteredEntities: EntityData[];
  entityKinds: EntityKindData[];
  cultures: CultureData[];
  filterKind: string;
  selectedEntityId: string | null;
  onFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSelectEntity: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEntityKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onAddEntity: () => void;
  schemaUsage: Record<string, unknown>;
}

function EntityListPanel({
  entities, filteredEntities, entityKinds, cultures, filterKind,
  selectedEntityId, onFilterChange, onSelectEntity, onEntityKeyDown, onAddEntity, schemaUsage,
}: Readonly<EntityListPanelProps>) {
  return (
    <div className="ee-list-panel">
      <div className="ee-header">
        <div className="ee-title">Entities</div>
        <div className="ee-subtitle">Create seed entities to populate your world.</div>
      </div>

      <div className="ee-toolbar">
        <select className="ee-filter-select" value={filterKind} onChange={onFilterChange}>
          <option value="">All kinds ({entities.length})</option>
          {entityKinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({entities.filter((e) => e.kind === k.kind).length})
            </option>
          ))}
        </select>
        <button className="ee-add-button" onClick={onAddEntity}>+ Add</button>
      </div>

      <div className="ee-entity-list">
        {filteredEntities.length === 0 ? (
          <div className="viewer-empty-state">
            {entities.length === 0
              ? "No entities yet. Create one to get started."
              : "No entities match the filter."}
          </div>
        ) : (
          filteredEntities.map((entity) => (
            <div
              key={entity.id}
              data-entity-id={entity.id}
              className={`ee-entity-item${selectedEntityId === entity.id ? " ee-entity-item-selected" : ""}`}
              onClick={onSelectEntity}
              role="button"
              tabIndex={0}
              onKeyDown={onEntityKeyDown}
            >
              <div
                className="ee-entity-color"
                style={{ '--ee-entity-color-bg': getCultureColor(cultures, entity.culture) } as React.CSSProperties}
              />
              <div className="ee-entity-info">
                <div className="ee-entity-name">{entity.name}</div>
                <div className="ee-entity-meta-row">
                  <span className="ee-entity-meta">
                    {entity.kind} / {entity.subtype || "no subtype"}
                  </span>
                  <UsageBadges usage={getEntityKindUsageSummary(schemaUsage, entity.kind)} compact />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface EntityDetailFormProps {
  entity: EntityData;
  entityKinds: EntityKindData[];
  cultures: CultureData[];
  tagRegistry: unknown[];
  onUpdateEntity: (updates: Partial<EntityData>) => void;
  onDeleteEntity: () => void;
  onAddTag: Optional<(tag: unknown) => void>;
  generateError: string | null;
  onGenerateName: () => void;
}

// eslint-disable-next-line max-lines-per-function, complexity -- entity edit form with 9 controlled inputs (name, kind, subtype, status, culture, prominence, tags, summary, coordinates); complexity from Optional fallback expressions across many form fields
function EntityDetailForm({
  entity, entityKinds, cultures, tagRegistry,
  onUpdateEntity, onDeleteEntity, onAddTag,
  generateError, onGenerateName,
}: Readonly<EntityDetailFormProps>) {
  const selectedKindDef = entityKinds.find((k) => k.kind === entity.kind);
  const canGenerate = hasCultureNaming(entity, cultures);
  const generateTitle = getGenerateTitle(entity, canGenerate);

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateEntity({ [e.target.id]: e.target.value }),
    [onUpdateEntity],
  );
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdateEntity({ name: e.target.value }),
    [onUpdateEntity],
  );
  const handleProminenceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateEntity({ prominence: parseFloat(e.target.value) }),
    [onUpdateEntity],
  );
  const handleSummaryChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateEntity({ summary: e.target.value, narrativeHint: e.target.value }),
    [onUpdateEntity],
  );
  const handleTagsChange = useCallback(
    (tagArray: string[]) => {
      const tags: Record<string, boolean> = {};
      for (const tag of tagArray) tags[tag] = true;
      onUpdateEntity({ tags });
    },
    [onUpdateEntity],
  );

  return (
    <>
      <div className="ee-form-title">Edit Entity</div>

      <div className="ee-form-group">
        <span className="ee-label">Name</span>
        <div className="ee-name-row">
          <input className="ee-input ee-name-input" value={entity.name} onChange={handleNameChange} />
          <button
            className={`ee-generate-button${!canGenerate ? " ee-generate-button-disabled" : ""}`}
            onClick={onGenerateName}
            disabled={!canGenerate}
            title={generateTitle}
          >
            Generate
          </button>
        </div>
        {generateError && <ErrorMessage message={generateError} className="ee-generate-error" />}
      </div>

      <div className="ee-row">
        <div className="ee-form-group-flex">
          <label htmlFor="kind" className="ee-label">Kind</label>
          <select id="kind" className="ee-select" value={entity.kind} onChange={handleSelectChange}>
            {entityKinds.map((k) => (
              <option key={k.kind} value={k.kind}>{k.description || k.kind}</option>
            ))}
          </select>
        </div>
        <div className="ee-form-group-flex">
          <label htmlFor="subtype" className="ee-label">Subtype</label>
          <select id="subtype" className="ee-select" value={entity.subtype || ""} onChange={handleSelectChange}>
            <option value="">None</option>
            {selectedKindDef?.subtypes?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ee-row">
        <div className="ee-form-group-flex">
          <label htmlFor="status" className="ee-label">Status</label>
          <select id="status" className="ee-select" value={entity.status} onChange={handleSelectChange}>
            {selectedKindDef?.statuses?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="ee-form-group-flex">
          <label htmlFor="culture" className="ee-label">Culture</label>
          <select id="culture" className="ee-select" value={entity.culture || ""} onChange={handleSelectChange}>
            <option value="">None</option>
            {cultures.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ee-form-group">
        <label htmlFor="prominence" className="ee-label">Prominence</label>
        <select id="prominence" className="ee-select" value={entity.prominence ?? 2.0} onChange={handleProminenceChange}>
          <option value="0.5">Forgotten</option>
          <option value="1.5">Marginal</option>
          <option value="2.5">Recognized</option>
          <option value="3.5">Renowned</option>
          <option value="4.5">Mythic</option>
        </select>
      </div>

      <div className="ee-form-group">
        <label className="ee-label">Tags
        <TagSelector
          value={Object.keys(entity.tags || {})}
          onChange={handleTagsChange}
          tagRegistry={tagRegistry}
          placeholder="Select tags..."
          onAddToRegistry={onAddTag}
        />
        </label>
      </div>

      <div className="ee-form-group">
        <label htmlFor="summary" className="ee-label">Summary</label>
        <textarea
          id="summary"
          className="ee-textarea"
          value={entity.summary ?? entity.narrativeHint ?? entity.description ?? ""}
          onChange={handleSummaryChange}
          placeholder="Optional summary..."
        />
      </div>

      <div className="ee-form-group">
        <span className="ee-label">Coordinates</span>
        <div className="ee-coords-display">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="ee-coord-item">
              <span className="ee-coord-label">{axis.toUpperCase()}:</span>
              <span className="ee-coord-value">{entity.coordinates?.[axis] ?? 50}</span>
            </div>
          ))}
        </div>
        <div className="ee-coord-hint">Edit coordinates by dragging entities on the Semantic Planes view</div>
      </div>

      <button className="ee-delete-button" onClick={onDeleteEntity}>Delete Entity</button>
    </>
  );
}

// ---------------------------------------------------------------------------
// EntityEditor
// ---------------------------------------------------------------------------

const EMPTY_SCHEMA_USAGE: Record<string, unknown> = {};

// eslint-disable-next-line max-lines-per-function -- coordinator managing entity CRUD, selection state, filter state, and name generation; line count from useCallback definitions for stable form handlers
export default function EntityEditor({
  project, onSave, onAddTag, schemaUsage = EMPTY_SCHEMA_USAGE,
}: Readonly<EntityEditorProps>) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState("");
  const { error: generateError, setError: setGenerateError } = useAsyncAction();

  const entities = useMemo(() => project?.seedEntities || [], [project?.seedEntities]);
  const entityKinds = useMemo(() => project?.entityKinds || [], [project?.entityKinds]);
  const cultures = useMemo(() => project?.cultures || [], [project?.cultures]);
  const tagRegistry = useMemo(() => project?.tagRegistry || [], [project?.tagRegistry]);

  const filteredEntities = useMemo(
    () => filterKind ? entities.filter((e) => e.kind === filterKind) : entities,
    [filterKind, entities],
  );

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  const updateEntities = useCallback(
    (newEntities: EntityData[]) => onSave({ seedEntities: newEntities }),
    [onSave],
  );

  const addEntity = useCallback(() => {
    const defaultKind = entityKinds[0];
    if (!defaultKind) return;
    const newEntity: EntityData = {
      id: `entity_${Date.now()}`,
      kind: defaultKind.kind,
      subtype: defaultKind.subtypes[0]?.id || "",
      name: "New Entity",
      summary: "",
      narrativeHint: "",
      description: "",
      status: defaultKind.statuses[0]?.id || "active",
      prominence: 2.5,
      culture: cultures[0]?.id || "",
      tags: {},
      links: [],
      coordinates: { x: 50, y: 50, z: 50 },
      createdAt: 0,
      updatedAt: 0,
    };
    updateEntities([...entities, newEntity]);
    setSelectedEntityId(newEntity.id);
  }, [entityKinds, cultures, entities, updateEntities]);

  const updateEntity = useCallback(
    (updates: Partial<EntityData>) => {
      if (!selectedEntity) return;
      const resolved = { ...updates };
      if (resolved.kind && resolved.kind !== selectedEntity.kind) {
        const newKind = entityKinds.find((k) => k.kind === resolved.kind);
        resolved.subtype = newKind?.subtypes[0]?.id || "";
        resolved.status = newKind?.statuses[0]?.id || "active";
      }
      updateEntities(entities.map((e) => (e.id === selectedEntityId ? { ...e, ...resolved } : e)));
    },
    [selectedEntity, selectedEntityId, entityKinds, entities, updateEntities],
  );

  const deleteEntity = useCallback(() => {
    if (!selectedEntity) return;
    if (!confirm(`Delete "${selectedEntity.name}"?`)) return;
    updateEntities(entities.filter((e) => e.id !== selectedEntityId));
    setSelectedEntityId(null);
  }, [selectedEntity, selectedEntityId, entities, updateEntities]);

  const handleGenerateName = useCallback(() => {
    if (!selectedEntity) return;
    const culture = cultures.find((c) => c.id === selectedEntity.culture);
    if (!culture) { setGenerateError("Select a culture first"); return; }
    if (!culture.naming?.profiles?.length) {
      setGenerateError(`Culture "${culture.name || culture.id}" has no naming profiles. Configure naming in Name Forge first.`);
      return;
    }
    setGenerateError(null);
    // Name generation requires a naming engine integration (e.g. Name Forge)
    const placeholder = `${culture.name || culture.id}-Entity-${Date.now().toString(36).slice(-4)}`;
    updateEntity({ name: placeholder });
  }, [selectedEntity, cultures, updateEntity, setGenerateError]);

  const handleEntityClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const id = e.currentTarget.dataset.entityId;
    if (id) setSelectedEntityId(id);
  }, []);

  const handleEntityKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }, []);

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setFilterKind(e.target.value),
    [],
  );

  return (
    <div className="ee-container">
      <EntityListPanel
        entities={entities}
        filteredEntities={filteredEntities}
        entityKinds={entityKinds}
        cultures={cultures}
        filterKind={filterKind}
        selectedEntityId={selectedEntityId}
        onFilterChange={handleFilterChange}
        onSelectEntity={handleEntityClick}
        onEntityKeyDown={handleEntityKeyDown}
        onAddEntity={addEntity}
        schemaUsage={schemaUsage}
      />
      <div className="ee-form-panel">
        {!selectedEntity ? (
          <div className="ee-empty-form">Select an entity to edit, or create a new one.</div>
        ) : (
          <EntityDetailForm
            entity={selectedEntity}
            entityKinds={entityKinds}
            cultures={cultures}
            tagRegistry={tagRegistry}
            onUpdateEntity={updateEntity}
            onDeleteEntity={deleteEntity}
            onAddTag={onAddTag}
            generateError={generateError}
            onGenerateName={handleGenerateName}
          />
        )}
      </div>
    </div>
  );
}
