/**
 * ProgressOverview - Shows progress bar and key stats
 */

import React from 'react';
import StatusBadge from './StatusBadge';

export default function ProgressOverview({ progress, status }) {
  if (!progress) {
    return (
      <div className="lw-overview-bar">
        <StatusBadge status={status} />
        <div className="lw-progress-section">
          <div className="lw-progress-bar">
            <div className="lw-progress-fill" style={{ width: '0%' }} />
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
  const epochProgress = progress.totalEpochs > 0
    ? (progress.epoch / progress.totalEpochs) * 100
    : 0;

  const percent = status === 'complete' ? 100 :
    status === 'initializing' ? 0 :
    status === 'validating' ? 0 :
    status === 'finalizing' ? 99 :
    Math.round(epochProgress);

  return (
    <div className="lw-overview-bar">
      <StatusBadge status={status} />
      <div className="lw-progress-section">
        <div className="lw-progress-bar">
          <div className="lw-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="lw-progress-text">
          <span>Tick {progress.tick} / {progress.maxTicks} • Epoch {progress.epoch} / {progress.totalEpochs}</span>
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
