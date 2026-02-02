/**
 * ValidationPopover - Compact validation status indicator with popover
 *
 * Shows a button with error/warning count that opens a stay-open popover
 * displaying the top validation errors. Allows users to reference errors
 * while working in other tabs.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { colors } from '../theme';

const styles = {
  container: {
    position: 'relative',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  buttonValid: {
    borderColor: 'rgba(74, 222, 128, 0.4)',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    color: 'rgb(74, 222, 128)',
  },
  buttonWarning: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'rgb(245, 158, 11)',
  },
  buttonError: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    color: 'rgb(248, 113, 113)',
  },
  popover: {
    position: 'fixed',
    top: '60px',
    right: '16px',
    width: '420px',
    maxHeight: 'calc(100vh - 100px)',
    backgroundColor: colors.bgPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  popoverHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
  },
  popoverTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.textPrimary,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: colors.textMuted,
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
  },
  popoverBody: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
    backgroundColor: colors.bgPrimary,
  },
  validMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    color: colors.success,
    fontSize: '14px',
  },
  errorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  errorCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: '6px',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  errorHeader: {
    padding: '8px 12px',
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderBottom: `1px solid ${colors.border}`,
  },
  warningHeader: {
    padding: '8px 12px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottom: `1px solid ${colors.border}`,
  },
  errorPath: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: colors.textMuted,
    marginBottom: '2px',
  },
  errorMessage: {
    fontSize: '13px',
    fontWeight: 500,
    color: colors.textPrimary,
  },
  errorBody: {
    padding: '8px 12px',
    fontSize: '12px',
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
  },
  errorRow: {
    display: 'flex',
    marginBottom: '4px',
  },
  errorLabel: {
    width: '60px',
    color: colors.textMuted,
    flexShrink: 0,
  },
  errorValue: {
    fontFamily: 'monospace',
    backgroundColor: colors.bgTertiary,
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '11px',
    wordBreak: 'break-all',
    color: colors.textPrimary,
  },
  moreCount: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: colors.textMuted,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
  },
  navLink: {
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  removeButton: {
    marginTop: '8px',
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    borderRadius: '4px',
    color: 'rgb(248, 113, 113)',
    cursor: 'pointer',
    fontWeight: 500,
  },
};

const MAX_ERRORS_SHOWN = 5;

function ErrorCard({ error, isWarning, onRemoveProperty }) {
  const headerStyle = isWarning ? styles.warningHeader : styles.errorHeader;

  // Check if this is an "additional properties" error that can be auto-fixed
  const isAdditionalPropError = error.expected?.startsWith('no additional property:');
  const additionalProp = isAdditionalPropError
    ? error.expected.replace('no additional property: ', '').trim()
    : null;

  return (
    <div style={styles.errorCard}>
      <div style={headerStyle}>
        <div style={styles.errorPath}>{error.path}</div>
        <div style={styles.errorMessage}>{error.message}</div>
      </div>
      <div style={styles.errorBody}>
        <div style={styles.errorRow}>
          <span style={styles.errorLabel}>Expected:</span>
          <code style={styles.errorValue}>{error.expected}</code>
        </div>
        {error.suggestion && (
          <div style={styles.errorRow}>
            <span style={styles.errorLabel}>Fix:</span>
            <span>{error.suggestion}</span>
          </div>
        )}
        {isAdditionalPropError && onRemoveProperty && (
          <button
            style={styles.removeButton}
            onClick={() => onRemoveProperty(error.path, additionalProp)}
          >
            Remove "{additionalProp}"
          </button>
        )}
      </div>
    </div>
  );
}

export default function ValidationPopover({
  validationResult,
  onNavigateToValidation,
  onRemoveProperty,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  const { valid, errors, warnings } = validationResult || { valid: true, errors: [], warnings: [] };
  const totalIssues = errors.length + warnings.length;

  // Determine button state
  const buttonStyle = useMemo(() => {
    if (errors.length > 0) return { ...styles.button, ...styles.buttonError };
    if (warnings.length > 0) return { ...styles.button, ...styles.buttonWarning };
    return { ...styles.button, ...styles.buttonValid };
  }, [errors.length, warnings.length]);

  // Get button label
  const buttonLabel = useMemo(() => {
    if (errors.length > 0) return `${errors.length} error${errors.length !== 1 ? 's' : ''}`;
    if (warnings.length > 0) return `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`;
    return 'Valid';
  }, [errors.length, warnings.length]);

  // Get icon
  const icon = useMemo(() => {
    if (errors.length > 0) return '✗';
    if (warnings.length > 0) return '⚠';
    return '✓';
  }, [errors.length, warnings.length]);

  // Combined and limited list
  const displayItems = useMemo(() => {
    const items = [
      ...errors.map(e => ({ ...e, isWarning: false })),
      ...warnings.map(w => ({ ...w, isWarning: true })),
    ];
    return items.slice(0, MAX_ERRORS_SHOWN);
  }, [errors, warnings]);

  const remainingCount = totalIssues - displayItems.length;

  const handleNavigate = () => {
    setIsOpen(false);
    onNavigateToValidation?.();
  };

  return (
    <div style={styles.container}>
      <button
        style={buttonStyle}
        onClick={() => setIsOpen(!isOpen)}
        title={valid ? 'Configuration is valid' : 'Click to see validation issues'}
      >
        <span>{icon}</span>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div style={styles.popover} ref={popoverRef}>
          <div style={styles.popoverHeader}>
            <span style={styles.popoverTitle}>
              Structure Validation
            </span>
            <button style={styles.closeButton} onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div style={styles.popoverBody}>
            {valid && warnings.length === 0 ? (
              <div style={styles.validMessage}>
                <span>✓</span>
                <span>All configuration files are valid</span>
              </div>
            ) : (
              <div style={styles.errorList}>
                {displayItems.map((item, i) => (
                  <ErrorCard key={i} error={item} isWarning={item.isWarning} onRemoveProperty={onRemoveProperty} />
                ))}
              </div>
            )}
          </div>

          {remainingCount > 0 && (
            <div style={styles.moreCount}>
              +{remainingCount} more issue{remainingCount !== 1 ? 's' : ''}.{' '}
              <span style={styles.navLink} onClick={handleNavigate}>
                View all in Validation tab
              </span>
            </div>
          )}

          {totalIssues > 0 && remainingCount === 0 && onNavigateToValidation && (
            <div style={styles.moreCount}>
              <span style={styles.navLink} onClick={handleNavigate}>
                View full details in Validation tab
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
