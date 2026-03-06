/**
 * DistributionTargetsEditor - Editor for per-subtype homeostatic targets
 *
 * Allows editing of per-subtype targets used to weight template selection.
 */

import React, { useCallback } from "react";
import "./DistributionTargetsEditor.css";
import EntityTargets from "./EntityTargets";

interface SubtypeConfig {
  target: number;
  comment: string;
}

interface DistributionTargetsData {
  $schema: string;
  version: string;
  entities: Record<string, Record<string, SubtypeConfig>>;
}

interface EntityKindSchema {
  kind: string;
  subtypes: Array<{ id: string }>;
}

interface Schema {
  entityKinds: EntityKindSchema[];
}

interface DistributionTargetsEditorProps {
  distributionTargets: DistributionTargetsData | null;
  schema: Schema;
  onDistributionTargetsChange: (targets: DistributionTargetsData) => void;
}

export default function DistributionTargetsEditor({
  distributionTargets,
  schema,
  onDistributionTargetsChange,
}: Readonly<DistributionTargetsEditorProps>) {
  // Create default targets if none exist
  const createDefaultTargets = useCallback(() => {
    const entities: Record<string, Record<string, SubtypeConfig>> = {};

    // Populate per-subtype targets from schema (default 0)
    for (const ek of schema.entityKinds) {
      if (!entities[ek.kind]) {
        entities[ek.kind] = {};
      }
      for (const subtype of ek.subtypes) {
        entities[ek.kind][subtype.id] = { target: 0 };
      }
    }

    onDistributionTargetsChange({
      $schema: "Per-subtype targets for homeostatic template weighting",
      version: "1.0.0",
      entities,
    });
  }, [schema, onDistributionTargetsChange]);

  // Update a nested path in the targets
  const updateTargets = useCallback(
    (path: string, value: Record<string, Record<string, SubtypeConfig>>) => {
      if (!distributionTargets) return;

      const newTargets = JSON.parse(JSON.stringify(distributionTargets)) as DistributionTargetsData;
      const parts = path.split(".");
      let current = newTargets as Record<string, unknown>;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
      onDistributionTargetsChange(newTargets);
    },
    [distributionTargets, onDistributionTargetsChange]
  );

  // If no targets exist, show empty state
  if (
    !distributionTargets ||
    !distributionTargets.entities ||
    Array.isArray(distributionTargets.entities)
  ) {
    return (
      <div className="lw-container">
        <div className="lw-header">
          <h1 className="lw-title">Distribution Targets</h1>
          <p className="lw-subtitle">
            Configure per-subtype targets for homeostatic template weighting
          </p>
        </div>
        <div className="viewer-empty-state viewer-empty-state">
          <div className="lw-empty-title">No Distribution Targets Configured</div>
          <div className="lw-empty-text">
            Set per-subtype targets used for homeostatic template weighting.
          </div>
          <button className="lw-btn lw-btn-primary" onClick={createDefaultTargets}>
            Create Default Targets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Distribution Targets</h1>
        <p className="lw-subtitle">
          Configure per-subtype targets for homeostatic template weighting
        </p>
      </div>

      {/* Content */}
      <div className="viewer-section">
        <EntityTargets
          entities={distributionTargets.entities}
          updateTargets={updateTargets}
          distributionTargets={distributionTargets}
        />
      </div>
    </div>
  );
}
