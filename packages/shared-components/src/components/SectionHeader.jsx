/**
 * SectionHeader - Section title with optional count badge and description
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} [props.description] - Optional description text
 * @param {string} [props.icon] - Optional emoji icon
 * @param {string} [props.count] - Optional count badge text (e.g. "3 active / 5 total")
 * @param {React.ReactNode} [props.actions] - Optional action buttons on the right
 * @param {string} [props.className] - Optional additional class names
 */
export function SectionHeader({
  title,
  description,
  icon,
  count,
  actions,
  className = '',
}) {
  return (
    <>
      <div className={`flex-between mb-lg ${className}`.trim()}>
        <div className="section-title mb-0">
          {icon && <span className="section-title-icon">{icon}</span>}
          {title}
          {count && <span className="badge-count">{count}</span>}
        </div>
        {actions}
      </div>
      {description && <div className="section-desc">{description}</div>}
    </>
  );
}

export default SectionHeader;
