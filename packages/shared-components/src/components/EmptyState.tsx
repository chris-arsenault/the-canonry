/**
 * EmptyState - Empty state display with icon, title, and description
 */

import React from 'react';

interface EmptyStateProps {
  readonly icon?: string;
  readonly title: string;
  readonly description?: string;
  readonly children?: React.ReactNode;
  readonly className?: string;
}

/**
 * @param {Object} props
 * @param {string} [props.icon] - Emoji icon to display
 * @param {string} props.title - Title text
 * @param {string} [props.description] - Description text
 * @param {React.ReactNode} [props.children] - Additional content (e.g., action button)
 * @param {string} [props.className] - Optional additional class names
 */
export function EmptyState({ icon, title, description, children, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {children}
    </div>
  );
}

export default EmptyState;

