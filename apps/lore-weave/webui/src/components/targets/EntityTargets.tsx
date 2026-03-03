/**
 * EntityTargets - Per-subtype population targets editor
 */

import React from "react";
import { NumberInput } from "@the-canonry/shared-components";
import "./EntityTargets.css";

interface SubtypeConfig {
  target: number;
  comment: string;
}

interface DistributionTargets {
  entities: Record<string, Record<string, SubtypeConfig>>;
}

interface EntityTargetsProps {
  entities: Record<string, Record<string, SubtypeConfig>>;
  updateTargets: (key: string, value: Record<string, Record<string, SubtypeConfig>>) => void;
  distributionTargets: DistributionTargets;
}

export default function EntityTargets({ entities, updateTargets, distributionTargets }: Readonly<EntityTargetsProps>) {
  // Group by entity kind
  const kindGroups: Record<string, Record<string, SubtypeConfig>> = {};
  Object.entries(entities).forEach(([key, value]) => {
    if (key === "comment") return;
    if (typeof value === "object") {
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
              <div className="et-controls">
                <label className="lw-label et-label-inline">
                  Target:
                <NumberInput
                  className="lw-input-small"
                  value={config.target || 0}
                  onChange={(v: number | null) => {
                    const currentEntities = distributionTargets.entities;
                    const newEntities = JSON.parse(JSON.stringify(currentEntities)) as Record<string, Record<string, SubtypeConfig>>;
                    if (!newEntities[kind]) newEntities[kind] = {};
                    newEntities[kind][subtype] = { ...config, target: v ?? 0 };
                    updateTargets("entities", newEntities);
                  }}
                  integer
                />
                </label>
              </div>
              {config.comment && (
                <span className="lw-comment et-comment">
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
