/**
 * ExpandableCard - A collapsible card with header and body sections
 *
 * Used for list items that expand to show detailed content.
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.expanded - Whether the card is expanded
 * @param {Function} props.onToggle - Called when header is clicked
 * @param {React.ReactNode} props.title - Main title content
 * @param {React.ReactNode} [props.subtitle] - Optional subtitle/ID display
 * @param {React.ReactNode} [props.actions] - Right-side header content (badges, summary)
 * @param {React.ReactNode} props.children - Body content (shown when expanded)
 * @param {string} [props.className] - Additional class for the container
 */
export function ExpandableCard({
  expanded,
  onToggle,
  title,
  subtitle,
  actions,
  children,
  className = '',
}) {
  return (
    <div className={`expandable-card ${className}`.trim()}>
      <div className="expandable-card-header" onClick={onToggle}>
        <div className="expandable-card-left">
          <span
            className="expand-icon"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
          <div className="expandable-card-title">
            <span className="expandable-card-name">{title}</span>
            {subtitle && <span className="expandable-card-id">{subtitle}</span>}
          </div>
        </div>
        {actions && <div className="expandable-card-actions">{actions}</div>}
      </div>
      {expanded && (
        <div className="expandable-card-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default ExpandableCard;
