/**
 * ExpandableCard - A collapsible card with header and body sections
 *
 * Used for list items that expand to show detailed content.
 */

import React, { useCallback } from 'react';

interface ExpandableCardProps {
  readonly expanded: boolean;
  readonly onToggle: (id?: string) => void;
  readonly toggleId?: string;
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly className?: string;
}

/**
 * @param {Object} props
 * @param {boolean} props.expanded - Whether the card is expanded
 * @param {Function} props.onToggle - Called when header is clicked. If toggleId is provided, calls onToggle(toggleId).
 * @param {string} [props.toggleId] - Optional ID passed back to onToggle, enabling stable callbacks in list renders
 * @param {React.ReactNode} props.title - Main title content
 * @param {React.ReactNode} [props.subtitle] - Optional subtitle/ID display
 * @param {React.ReactNode} [props.actions] - Right-side header content (badges, summary)
 * @param {React.ReactNode} props.children - Body content (shown when expanded)
 * @param {string} [props.className] - Additional class for the container
 */
export function ExpandableCard({
  expanded,
  onToggle,
  toggleId,
  title,
  subtitle,
  actions,
  children,
  className = '',
}: ExpandableCardProps) {
  const handleToggle = useCallback(() => {
    if (toggleId !== undefined) {
      onToggle(toggleId);
    } else {
      onToggle();
    }
  }, [onToggle, toggleId]);

  return (
    <div className={`expandable-card ${className}`.trim()}>
      <div className="expandable-card-header" onClick={handleToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleToggle(); }} >
        <div className="expandable-card-left">
          <span
            className={`expand-icon ${expanded ? 'expand-icon-expanded' : 'expand-icon-collapsed'}`}
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
