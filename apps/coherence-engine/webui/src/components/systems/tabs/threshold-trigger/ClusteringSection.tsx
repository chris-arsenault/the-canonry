/**
 * ClusteringSection - Clustering configuration for threshold trigger systems
 */

import React, { useCallback } from "react";
import { CLUSTER_MODES } from "../../constants";
import { ReferenceDropdown, NumberInput } from "../../../shared";
import type { SystemConfig } from "./types";

interface ClusteringSectionProps {
  readonly config: SystemConfig;
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: ReadonlyArray<{ value: string; label: string }>;
}

export function ClusteringSection({
  config,
  onUpdate,
  relationshipKindOptions,
}: ClusteringSectionProps) {
  const handleClusterModeChange = useCallback(
    (v: string | undefined) => onUpdate("clusterMode", v),
    [onUpdate],
  );

  const handleClusterRelChange = useCallback(
    (v: string | undefined) => onUpdate("clusterRelationshipKind", v),
    [onUpdate],
  );

  const handleMinClusterSizeChange = useCallback(
    (v: number | undefined) => onUpdate("minClusterSize", v),
    [onUpdate],
  );

  return (
    <div className="section">
      <div className="section-title">Clustering</div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Cluster Mode"
          value={config.clusterMode || "individual"}
          onChange={handleClusterModeChange}
          options={CLUSTER_MODES}
        />
        {config.clusterMode === "by_relationship" && (
          <>
            <ReferenceDropdown
              label="Cluster Relationship"
              value={config.clusterRelationshipKind}
              onChange={handleClusterRelChange}
              options={relationshipKindOptions}
            />
            <div className="form-group">
              <label className="label">Min Cluster Size
              <NumberInput
                value={config.minClusterSize}
                onChange={handleMinClusterSizeChange}
                min={1}
                integer
                allowEmpty
              />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
