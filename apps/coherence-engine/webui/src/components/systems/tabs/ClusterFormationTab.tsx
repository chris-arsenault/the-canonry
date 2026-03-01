/**
 * ClusterFormationTab - Configuration for cluster formation systems
 */

import React, { useCallback, useMemo } from "react";
import { CLUSTERING_CRITERIA_TYPES } from "../constants";
import { ReferenceDropdown, NumberInput, LocalTextArea } from "../../shared";

interface ClusterCriterion {
  type: string;
  weight: number;
  relationshipKind?: string;
}

interface ClusterFormationConfig {
  clustering?: {
    minSize?: number;
    maxSize?: number;
    minimumScore?: number;
    criteria?: ClusterCriterion[];
  };
  metaEntity?: {
    kind?: string;
    status?: string;
    descriptionTemplate?: string;
  };
  narrationTemplate?: string;
}

interface ClusterFormationSystem {
  config: ClusterFormationConfig;
  [key: string]: unknown;
}

interface EntityKind {
  kind: string;
  description?: string;
}

interface RelationshipKind {
  kind: string;
  description?: string;
}

interface ClusterFormationSchema {
  entityKinds?: EntityKind[];
  relationshipKinds?: RelationshipKind[];
}

interface ClusterFormationTabProps {
  system: ClusterFormationSystem;
  onChange: (system: ClusterFormationSystem) => void;
  schema?: ClusterFormationSchema;
}

interface ClusteringSizeSectionProps {
  clustering: ClusterFormationConfig["clustering"];
  onUpdateClustering: (field: string, value: unknown) => void;
}

function ClusteringSizeSection({ clustering, onUpdateClustering }: ClusteringSizeSectionProps) {
  const handleMinSize = useCallback(
    (v: number | undefined) => onUpdateClustering("minSize", v),
    [onUpdateClustering],
  );
  const handleMaxSize = useCallback(
    (v: number | undefined) => onUpdateClustering("maxSize", v),
    [onUpdateClustering],
  );
  const handleMinScore = useCallback(
    (v: number | undefined) => onUpdateClustering("minimumScore", v),
    [onUpdateClustering],
  );

  return (
    <div className="form-grid">
      <div className="form-group">
        <label className="label">Min Size
        <NumberInput
          value={clustering?.minSize}
          onChange={handleMinSize}
          min={2}
          integer
          allowEmpty
        />
        </label>
      </div>
      <div className="form-group">
        <label className="label">Max Size
        <NumberInput
          value={clustering?.maxSize}
          onChange={handleMaxSize}
          min={2}
          integer
          allowEmpty
        />
        </label>
      </div>
      <div className="form-group">
        <label className="label">Minimum Score
        <NumberInput
          value={clustering?.minimumScore}
          onChange={handleMinScore}
          min={0}
          allowEmpty
        />
        </label>
      </div>
    </div>
  );
}

interface CriterionRowProps {
  crit: ClusterCriterion;
  index: number;
  relationshipKindOptions: Array<{ value: string; label: string }>;
  onUpdate: (index: number, crit: ClusterCriterion) => void;
  onRemove: (index: number) => void;
}

function CriterionRow({ crit, index, relationshipKindOptions, onUpdate, onRemove }: CriterionRowProps) {
  const handleTypeChange = useCallback(
    (v: string) => onUpdate(index, { ...crit, type: v }),
    [onUpdate, index, crit],
  );
  const handleWeightChange = useCallback(
    (v: number | undefined) => onUpdate(index, { ...crit, weight: v ?? 0 }),
    [onUpdate, index, crit],
  );
  const handleRelKindChange = useCallback(
    (v: string) => onUpdate(index, { ...crit, relationshipKind: v }),
    [onUpdate, index, crit],
  );
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div className="item-card">
      <div className="py-lg px-xl">
        <div className="form-row-with-delete">
          <div className="form-row-fields">
            <ReferenceDropdown
              label="Type"
              value={crit.type}
              onChange={handleTypeChange}
              options={CLUSTERING_CRITERIA_TYPES}
            />
            <div className="form-group">
              <label className="label">Weight
              <NumberInput
                value={crit.weight}
                onChange={handleWeightChange}
                min={0}
              />
              </label>
            </div>
            {crit.type === "shared_relationship" && (
              <ReferenceDropdown
                label="Relationship Kind"
                value={crit.relationshipKind}
                onChange={handleRelKindChange}
                options={relationshipKindOptions}
              />
            )}
          </div>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>
            x
          </button>
        </div>
      </div>
    </div>
  );
}

interface MetaEntitySectionProps {
  metaEntity: ClusterFormationConfig["metaEntity"];
  entityKindOptions: Array<{ value: string; label: string }>;
  onUpdateMetaEntity: (field: string, value: unknown) => void;
}

function MetaEntitySection({ metaEntity, entityKindOptions, onUpdateMetaEntity }: MetaEntitySectionProps) {
  const handleKindChange = useCallback(
    (v: string) => onUpdateMetaEntity("kind", v),
    [onUpdateMetaEntity],
  );
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdateMetaEntity("status", e.target.value),
    [onUpdateMetaEntity],
  );
  const handleDescriptionChange = useCallback(
    (value: string) => onUpdateMetaEntity("descriptionTemplate", value),
    [onUpdateMetaEntity],
  );

  return (
    <div className="section">
      <div className="section-title">Meta Entity</div>
      <div className="section-desc">Configuration for the meta-entity created from clusters.</div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Kind"
          value={metaEntity?.kind}
          onChange={handleKindChange}
          options={entityKindOptions}
        />
        <div className="form-group">
          <label htmlFor="status" className="label">Status</label>
          <input id="status"
            type="text"
            value={metaEntity?.status || ""}
            onChange={handleStatusChange}
            className="input"
          />
        </div>
      </div>
      <div className="mt-xl">
        <div className="form-group">
          <label className="label">Description Template
          <LocalTextArea
            value={metaEntity?.descriptionTemplate || ""}
            onChange={handleDescriptionChange}
            placeholder="Use {names}, {count} placeholders"
          />
          </label>
        </div>
      </div>
    </div>
  );
}

export function ClusterFormationTab({ system, onChange, schema }: ClusterFormationTabProps) {
  const config = system.config;

  const entityKindOptions = useMemo(
    () =>
      (schema?.entityKinds || []).map((ek) => ({
        value: ek.kind,
        label: ek.description || ek.kind,
      })),
    [schema?.entityKinds],
  );

  const relationshipKindOptions = useMemo(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const updateConfig = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...system, config: { ...config, [field]: value } });
    },
    [system, config, onChange],
  );

  const updateClustering = useCallback(
    (field: string, value: unknown) => {
      updateConfig("clustering", { ...config.clustering, [field]: value });
    },
    [updateConfig, config.clustering],
  );

  const updateMetaEntity = useCallback(
    (field: string, value: unknown) => {
      updateConfig("metaEntity", { ...config.metaEntity, [field]: value });
    },
    [updateConfig, config.metaEntity],
  );

  const criteria = config.clustering?.criteria || [];

  const addCriterion = useCallback(() => {
    updateClustering("criteria", [...criteria, { type: "same_culture", weight: 1.0 }]);
  }, [updateClustering, criteria]);

  const updateCriterion = useCallback(
    (index: number, crit: ClusterCriterion) => {
      const newCriteria = [...criteria];
      newCriteria[index] = crit;
      updateClustering("criteria", newCriteria);
    },
    [updateClustering, criteria],
  );

  const removeCriterion = useCallback(
    (index: number) => {
      updateClustering(
        "criteria",
        criteria.filter((_, i) => i !== index),
      );
    },
    [updateClustering, criteria],
  );

  const handleNarrationChange = useCallback(
    (value: string) => updateConfig("narrationTemplate", value || undefined),
    [updateConfig],
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">Clustering Configuration</div>
        <ClusteringSizeSection
          clustering={config.clustering}
          onUpdateClustering={updateClustering}
        />

        <div className="mt-xl">
          <label className="label">Clustering Criteria ({criteria.length})</label>
        </div>

        {criteria.map((crit, index) => (
          <CriterionRow
            key={index}
            crit={crit}
            index={index}
            relationshipKindOptions={relationshipKindOptions}
            onUpdate={updateCriterion}
            onRemove={removeCriterion}
          />
        ))}

        <button className="btn-add" onClick={addCriterion}>
          + Add Criterion
        </button>
      </div>

      <MetaEntitySection
        metaEntity={config.metaEntity}
        entityKindOptions={entityKindOptions}
        onUpdateMetaEntity={updateMetaEntity}
      />

      <div className="section">
        <div className="section-title">Narration Template</div>
        <div className="section-desc mb-md text-xs">
          Syntax: {"{list:members}"}, {"{count}"}, {"{field|fallback}"}.
        </div>
        <LocalTextArea
          value={config.narrationTemplate || ""}
          onChange={handleNarrationChange}
          placeholder="e.g., {list:members} united to form a new alliance."
          rows={2}
        />
      </div>
    </div>
  );
}
