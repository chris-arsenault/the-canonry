/**
 * StatusBadge - Displays simulation status with icon
 */

import React from "react";
import "./StatusBadge.css";
import { STATUS_CONFIGS } from "./constants";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: Readonly<StatusBadgeProps>) {
  const config = STATUS_CONFIGS[status as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS.idle;

  return (
    <div className="lw-status-badge sb-badge" style={{ '--sb-badge-bg': config.bg, '--sb-badge-color': config.color } as React.CSSProperties}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}
