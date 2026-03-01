/**
 * IssueCard - Expandable card for displaying a validation issue
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import "../validation.css";
import "./IssueCard.css";

export function IssueCard({ issue, onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const [, setHovering] = useState(false);
  const [, setHoveredItem] = useState(null);

  const severityClass =
    issue.severity === "error"
      ? "validation-issue-severity validation-status-error"
      : "validation-issue-severity validation-status-warning";

  const icons = {
    error: "❌",
    warning: "⚠️",
  };

  return (
    <div className="validation-issue-card">
      <div
        className="validation-issue-header"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        <span className="validation-issue-icon">{icons[issue.severity]}</span>
        <span className="validation-issue-title">{issue.title}</span>
        <span className="validation-issue-count">{issue.affectedItems.length}</span>
        <span className={severityClass}>{issue.severity.toUpperCase()}</span>
        <span
          className={`validation-issue-expand-icon ${expanded ? "ic-expand-rotated" : ""}`}
        >
          ▼
        </span>
      </div>
      {expanded && (
        <div className="validation-issue-content">
          <div className="validation-issue-message">{issue.message}</div>
          <div className="validation-affected-items">
            {issue.affectedItems.map((item) => (
              <div key={item.id} className="flex-col ic-affected-item-row">
                <span
                  className="validation-affected-item"
                  title={item.detail}
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick?.(item.id);
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  {item.label}
                </span>
                {item.detail && <span className="validation-detail-row">{item.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

IssueCard.propTypes = {
  issue: PropTypes.object.isRequired,
  onItemClick: PropTypes.func,
};
