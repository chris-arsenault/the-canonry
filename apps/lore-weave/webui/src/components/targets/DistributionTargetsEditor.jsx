/**
 * DistributionTargetsEditor - Editor for per-subtype homeostatic targets
 *
 * Allows editing of per-subtype targets used to weight template selection.
 */

import React, { useCallback } from 'react';
import EntityTargets from './EntityTargets';

export default function DistributionTargetsEditor({
  distributionTargets,
  schema,
  onDistributionTargetsChange,
}) {
  // Create default targets if none exist
  const createDefaultTargets = useCallback(() => {
    const defaultTargets = {
      $schema: 'Per-subtype targets for homeostatic template weighting',
      version: '1.0.0',
      entities: {},
    };

    // Populate per-subtype targets from schema (default 0)
    if (schema?.entityKinds) {
      schema.entityKinds.forEach((ek) => {
        if (!defaultTargets.entities[ek.kind]) {
          defaultTargets.entities[ek.kind] = {};
        }
        ek.subtypes?.forEach((subtype) => {
          defaultTargets.entities[ek.kind][subtype.id] = { target: 0 };
        });
      });
    }

    onDistributionTargetsChange(defaultTargets);
  }, [schema, onDistributionTargetsChange]);

  // Update a nested path in the targets
  const updateTargets = useCallback((path, value) => {
    if (!distributionTargets) return;

    const newTargets = JSON.parse(JSON.stringify(distributionTargets));
    const parts = path.split('.');
    let current = newTargets;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    onDistributionTargetsChange(newTargets);
  }, [distributionTargets, onDistributionTargetsChange]);

  // If no targets exist, show empty state
  if (!distributionTargets || !distributionTargets.entities || Array.isArray(distributionTargets.entities)) {
    return (
      <div className="lw-container">
        <div className="lw-header">
          <h1 className="lw-title">Distribution Targets</h1>
          <p className="lw-subtitle">
            Configure per-subtype targets for homeostatic template weighting
          </p>
        </div>
        <div className="lw-empty-state" style={{ height: 'auto', padding: '40px 20px' }}>
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
      <div className="lw-section">
        <EntityTargets
          entities={distributionTargets.entities}
          updateTargets={updateTargets}
          distributionTargets={distributionTargets}
        />
      </div>
    </div>
  );
}
