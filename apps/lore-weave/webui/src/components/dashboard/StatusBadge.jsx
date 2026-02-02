/**
 * StatusBadge - Displays simulation status with icon
 */

import React from 'react';
import { STATUS_CONFIGS } from './constants';

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.idle;

  return (
    <div
      className="lw-status-badge"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}
