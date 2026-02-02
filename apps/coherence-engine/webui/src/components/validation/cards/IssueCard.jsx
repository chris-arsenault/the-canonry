/**
 * IssueCard - Expandable card for displaying a validation issue
 */

import React, { useState } from 'react';
import '../validation.css';

export function IssueCard({ issue, onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  const severityClass = issue.severity === 'error'
    ? 'validation-issue-severity validation-status-error'
    : 'validation-issue-severity validation-status-warning';

  const icons = {
    error: '❌',
    warning: '⚠️',
  };

  return (
    <div className="validation-issue-card">
      <div
        className="validation-issue-header"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <span className="validation-issue-icon">{icons[issue.severity]}</span>
        <span className="validation-issue-title">{issue.title}</span>
        <span className="validation-issue-count">{issue.affectedItems.length}</span>
        <span className={severityClass}>
          {issue.severity.toUpperCase()}
        </span>
        <span className="validation-issue-expand-icon" style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </div>
      {expanded && (
        <div className="validation-issue-content">
          <div className="validation-issue-message">{issue.message}</div>
          <div className="validation-affected-items">
            {issue.affectedItems.map(item => (
              <div key={item.id} className="flex-col" style={{ gap: '2px' }}>
                <span
                  className="validation-affected-item"
                  title={item.detail}
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick?.(item.id);
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {item.label}
                </span>
                {item.detail && (
                  <span className="validation-detail-row">{item.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
