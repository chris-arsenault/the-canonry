/**
 * EntityTargets - Per-subtype population targets editor
 */

import React from 'react';
import { NumberInput } from '@penguin-tales/shared-components';

export default function EntityTargets({ entities, updateTargets, distributionTargets }) {
  // Group by entity kind
  const kindGroups = {};
  Object.entries(entities).forEach(([key, value]) => {
    if (key === 'comment') return;
    if (typeof value === 'object') {
      kindGroups[key] = value;
    }
  });

  return (
    <>
      <p className="lw-section-description">
        Per-subtype population targets for homeostatic control
      </p>
      {Object.entries(kindGroups).map(([kind, subtypes]) => (
        <div key={kind} className="lw-card">
          <div className="lw-card-title">{kind}</div>
          {Object.entries(subtypes).map(([subtype, config]) => (
            <div key={subtype} className="lw-row">
              <span className="lw-row-label">{subtype}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="lw-label" style={{ marginBottom: 0 }}>Target:</label>
                <NumberInput
                  className="lw-input-small"
                  value={config.target || 0}
                  onChange={(v) => {
                    const currentEntities = distributionTargets.entities;
                    const newEntities = JSON.parse(JSON.stringify(currentEntities));
                    if (!newEntities[kind]) newEntities[kind] = {};
                    newEntities[kind][subtype] = { ...config, target: v ?? 0 };
                    updateTargets('entities', newEntities);
                  }}
                  integer
                />
              </div>
              {config.comment && (
                <span className="lw-comment" style={{ marginTop: 0, marginLeft: '8px' }}>
                  {config.comment}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
