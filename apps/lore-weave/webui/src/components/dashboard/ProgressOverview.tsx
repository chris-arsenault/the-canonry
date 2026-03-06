/**
 * ProgressOverview - Shows progress bar and key stats
 */

import React from "react";
import "./ProgressOverview.css";
import StatusBadge from "./StatusBadge";

interface ProgressData {
  tick: number;
  maxTicks: number;
  epoch: number;
  totalEpochs: number;
  entityCount: number;
  relationshipCount: number;
}

interface ProgressOverviewProps {
  progress: ProgressData | null;
  status: string;
}

export default function ProgressOverview({ progress, status }: Readonly<ProgressOverviewProps>) {
  if (!progress) {
    return (
      <div className="lw-overview-bar">
        <StatusBadge status={status} />
        <div className="viewer-section">
          <div className="lw-progress-bar">
            <div className="lw-progress-fill po-progress-fill" style={{ '--po-progress-width': '0%' } as React.CSSProperties} />
          </div>
          <div className="lw-progress-text">
            <span>Waiting to start...</span>
            <span>0%</span>
          </div>
        </div>
        <div className="lw-stats-row">
          <div className="lw-stat-item">
            <div className="lw-stat-value">0</div>
            <div className="lw-stat-label">Entities</div>
          </div>
          <div className="lw-stat-item">
            <div className="lw-stat-value">0</div>
            <div className="lw-stat-label">Relations</div>
          </div>
        </div>
      </div>
    );
  }

  // Progress based on completed epochs (0-100%)
  const epochProgress =
    progress.totalEpochs > 0 ? (progress.epoch / progress.totalEpochs) * 100 : 0;

  let percent: number;
  if (status === "complete") percent = 100;
  else if (status === "initializing" || status === "validating") percent = 0;
  else if (status === "finalizing") percent = 99;
  else percent = Math.round(epochProgress);

  return (
    <div className="lw-overview-bar">
      <StatusBadge status={status} />
      <div className="viewer-section">
        <div className="lw-progress-bar">
          <div className="lw-progress-fill po-progress-fill" style={{ '--po-progress-width': `${percent}%` } as React.CSSProperties} />
        </div>
        <div className="lw-progress-text">
          <span>
            Tick {progress.tick} / {progress.maxTicks} • Epoch {progress.epoch} /{" "}
            {progress.totalEpochs}
          </span>
          <span>{Math.round(percent)}%</span>
        </div>
      </div>
      <div className="lw-stats-row">
        <div className="lw-stat-item">
          <div className="lw-stat-value">{progress.entityCount.toLocaleString()}</div>
          <div className="lw-stat-label">Entities</div>
        </div>
        <div className="lw-stat-item">
          <div className="lw-stat-value">{progress.relationshipCount.toLocaleString()}</div>
          <div className="lw-stat-label">Relations</div>
        </div>
      </div>
    </div>
  );
}
