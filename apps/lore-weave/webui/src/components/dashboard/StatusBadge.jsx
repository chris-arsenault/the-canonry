/**
 * StatusBadge - Displays simulation status with icon
 */

import React from "react";
import PropTypes from "prop-types";
import "./StatusBadge.css";
import { STATUS_CONFIGS } from "./constants";

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.idle;

  return (
    <div className="lw-status-badge sb-badge" style={{ '--sb-badge-bg': config.bg, '--sb-badge-color': config.color }}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string,
};
