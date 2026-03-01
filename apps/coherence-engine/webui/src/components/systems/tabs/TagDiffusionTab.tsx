/**
 * TagDiffusionTab - Configuration for tag diffusion systems
 */

import React, { useCallback, useMemo } from "react";
import { DIRECTIONS } from "../constants";
import { ReferenceDropdown, NumberInput } from "../../shared";
import TagSelector from "@the-canonry/shared-components/TagSelector";

interface TagDiffusionConfig {
  connectionKind?: string;
  connectionDirection?: string;
  maxTags?: number;
  convergence?: {
    tags?: string[];
    minConnections?: number;
    probability?: number;
  };
  divergence?: {
    tags?: string[];
    maxConnections?: number;
    probability?: number;
  };
}

interface TagDiffusionSystem {
  config: TagDiffusionConfig;
  [key: string]: unknown;
}

interface RelationshipKind {
  kind: string;
  description?: string;
}

interface TagRegistryEntry {
  key: string;
  label?: string;
  [key: string]: unknown;
}

interface TagDiffusionSchema {
  relationshipKinds?: RelationshipKind[];
  tagRegistry?: TagRegistryEntry[];
}

interface TagDiffusionTabProps {
  system: TagDiffusionSystem;
  onChange: (system: TagDiffusionSystem) => void;
  schema?: TagDiffusionSchema;
}

interface ConnectionSectionProps {
  config: TagDiffusionConfig;
  relationshipKindOptions: Array<{ value: string; label: string }>;
  onUpdateConfig: (field: string, value: unknown) => void;
}

function ConnectionSection({ config, relationshipKindOptions, onUpdateConfig }: ConnectionSectionProps) {
  const handleConnectionKindChange = useCallback(
    (v: string) => onUpdateConfig("connectionKind", v),
    [onUpdateConfig],
  );
  const handleDirectionChange = useCallback(
    (v: string) => onUpdateConfig("connectionDirection", v),
    [onUpdateConfig],
  );
  const handleMaxTagsChange = useCallback(
    (v: number | undefined) => onUpdateConfig("maxTags", v),
    [onUpdateConfig],
  );

  return (
    <div className="section">
      <div className="section-title">Connection</div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Connection Kind"
          value={config.connectionKind}
          onChange={handleConnectionKindChange}
          options={relationshipKindOptions}
        />
        <ReferenceDropdown
          label="Direction"
          value={config.connectionDirection || "both"}
          onChange={handleDirectionChange}
          options={DIRECTIONS}
        />
        <div className="form-group">
          <label className="label">Max Tags
          <NumberInput
            value={config.maxTags}
            onChange={handleMaxTagsChange}
            min={1}
            integer
            allowEmpty
          />
          </label>
        </div>
      </div>
    </div>
  );
}

interface DiffusionBehaviorSectionProps {
  title: string;
  description: string;
  behavior: {
    tags?: string[];
    minConnections?: number;
    maxConnections?: number;
    probability?: number;
  } | undefined;
  connectionFieldLabel: string;
  connectionFieldKey: "minConnections" | "maxConnections";
  tagRegistry: TagRegistryEntry[];
  onUpdate: (field: string, value: unknown) => void;
}

function DiffusionBehaviorSection({
  title,
  description,
  behavior,
  connectionFieldLabel,
  connectionFieldKey,
  tagRegistry,
  onUpdate,
}: DiffusionBehaviorSectionProps) {
  const tagsValue = useMemo(() => behavior?.tags || [], [behavior?.tags]);

  const handleTagsChange = useCallback(
    (tags: string[]) => onUpdate("tags", tags),
    [onUpdate],
  );
  const handleConnectionChange = useCallback(
    (v: number | undefined) => onUpdate(connectionFieldKey, v),
    [onUpdate, connectionFieldKey],
  );
  const handleProbabilityChange = useCallback(
    (v: number | undefined) => onUpdate("probability", v),
    [onUpdate],
  );

  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <div className="section-desc">{description}</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="label">Tags
          <TagSelector
            value={tagsValue}
            onChange={handleTagsChange}
            tagRegistry={tagRegistry}
            placeholder="Select tags..."
          />
          </label>
        </div>
        <div className="form-group">
          <label className="label">{connectionFieldLabel}
          <NumberInput
            value={behavior?.[connectionFieldKey]}
            onChange={handleConnectionChange}
            min={0}
            integer
            allowEmpty
          />
          </label>
        </div>
        <div className="form-group">
          <label className="label">Probability
          <NumberInput
            value={behavior?.probability}
            onChange={handleProbabilityChange}
            min={0}
            max={1}
            allowEmpty
          />
          </label>
        </div>
      </div>
    </div>
  );
}

export function TagDiffusionTab({ system, onChange, schema }: TagDiffusionTabProps) {
  const config = system.config;
  const tagRegistry = useMemo(() => schema?.tagRegistry || [], [schema?.tagRegistry]);

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

  const updateConvergence = useCallback(
    (field: string, value: unknown) => {
      updateConfig("convergence", { ...config.convergence, [field]: value });
    },
    [updateConfig, config.convergence],
  );

  const updateDivergence = useCallback(
    (field: string, value: unknown) => {
      updateConfig("divergence", { ...config.divergence, [field]: value });
    },
    [updateConfig, config.divergence],
  );

  return (
    <div>
      <ConnectionSection
        config={config}
        relationshipKindOptions={relationshipKindOptions}
        onUpdateConfig={updateConfig}
      />
      <DiffusionBehaviorSection
        title="Convergence"
        description="Connected entities become more similar."
        behavior={config.convergence}
        connectionFieldLabel="Min Connections"
        connectionFieldKey="minConnections"
        tagRegistry={tagRegistry}
        onUpdate={updateConvergence}
      />
      <DiffusionBehaviorSection
        title="Divergence"
        description="Isolated entities become more unique."
        behavior={config.divergence}
        connectionFieldLabel="Max Connections"
        connectionFieldKey="maxConnections"
        tagRegistry={tagRegistry}
        onUpdate={updateDivergence}
      />
    </div>
  );
}
