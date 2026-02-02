/**
 * ValidationBadge - Displays error count or orphan indicator
 */

import React from 'react';

/**
 * Badge for showing error counts
 * @param {Object} props
 * @param {number} props.count - Number of errors
 * @param {string} [props.className] - Additional class names
 */
export function ErrorBadge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span className={`badge badge-validation badge-error ${className}`.trim()}>
      {count} error{count !== 1 ? 's' : ''}
    </span>
  );
}

/**
 * Badge for showing orphan status (not in any era)
 * @param {Object} props
 * @param {boolean} props.isOrphan - Whether the item is orphaned
 * @param {string} [props.className] - Additional class names
 */
export function OrphanBadge({ isOrphan, className = '' }) {
  if (!isOrphan) return null;
  return (
    <span className={`badge badge-validation badge-orphan ${className}`.trim()}>
      Not in any era
    </span>
  );
}

/**
 * Badge for showing validation count in tabs
 * @param {Object} props
 * @param {number} props.count - Number of validation issues
 * @param {string} [props.className] - Additional class names
 */
export function TabValidationBadge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span className={`badge badge-validation badge-error ${className}`.trim()}>
      {count}
    </span>
  );
}
