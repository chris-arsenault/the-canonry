/**
 * ValidationPopover - Compact validation status indicator with popover
 *
 * Shows a button with error/warning count that opens a stay-open popover
 * displaying the top validation errors. Allows users to reference errors
 * while working in other tabs.
 */

import React, { useState, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import "./ValidationPopover.css";

const MAX_ERRORS_SHOWN = 5;

function ErrorCard({ error, isWarning, onRemoveProperty }) {
  const headerClassName = isWarning ? "vp-warning-header" : "vp-error-header";

  // Check if this is an "additional properties" error that can be auto-fixed
  const isAdditionalPropError = error.expected?.startsWith("no additional property:");
  const additionalProp = isAdditionalPropError
    ? error.expected.replace("no additional property: ", "").trim()
    : null;

  return (
    <div className="vp-issue-card">
      <div className={headerClassName}>
        <div className="vp-issue-path">{error.path}</div>
        <div className="vp-error-message">{error.message}</div>
      </div>
      <div className="vp-issue-body">
        <div className="vp-issue-row">
          <span className="vp-error-label">Expected:</span>
          <code className="vp-error-value">{error.expected}</code>
        </div>
        {error.suggestion && (
          <div className="vp-issue-row">
            <span className="vp-error-label">Fix:</span>
            <span>{error.suggestion}</span>
          </div>
        )}
        {isAdditionalPropError && onRemoveProperty && (
          <button
            className="vp-remove-button"
            onClick={() => onRemoveProperty(error.path, additionalProp)}
          >
            Remove &quot;{additionalProp}&quot;
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

  // Determine button class
  const buttonClassName = useMemo(() => {
    if (errors.length > 0) return "vp-button vp-button-error";
    if (warnings.length > 0) return "vp-button vp-button-warning";
    return "vp-button vp-button-valid";
  }, [errors.length, warnings.length]);

  // Get button label
  const buttonLabel = useMemo(() => {
    if (errors.length > 0) return `${errors.length} error${errors.length !== 1 ? "s" : ""}`;
    if (warnings.length > 0) return `${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`;
    return "Valid";
  }, [errors.length, warnings.length]);

  // Get icon
  const icon = useMemo(() => {
    if (errors.length > 0) return "✗";
    if (warnings.length > 0) return "⚠";
    return "✓";
  }, [errors.length, warnings.length]);

  // Combined and limited list
  const displayItems = useMemo(() => {
    const items = [
      ...errors.map((e) => ({ ...e, isWarning: false })),
      ...warnings.map((w) => ({ ...w, isWarning: true })),
    ];
    return items.slice(0, MAX_ERRORS_SHOWN);
  }, [errors, warnings]);

  const remainingCount = totalIssues - displayItems.length;

  const handleNavigate = () => {
    setIsOpen(false);
    onNavigateToValidation?.();
  };

  return (
    <div className="vp-container">
      <button
        className={buttonClassName}
        onClick={() => setIsOpen(!isOpen)}
        title={valid ? "Configuration is valid" : "Click to see validation issues"}
      >
        <span>{icon}</span>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="vp-popover" ref={popoverRef}>
          <div className="vp-popover-header">
            <span className="vp-popover-title">Structure Validation</span>
            <button className="vp-close-button" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="vp-popover-body">
            {valid && warnings.length === 0 ? (
              <div className="vp-valid-message">
                <span>✓</span>
                <span>All configuration files are valid</span>
              </div>
            ) : (
              <div className="vp-issue-list">
                {displayItems.map((item, i) => (
                  <ErrorCard
                    key={i}
                    error={item}
                    isWarning={item.isWarning}
                    onRemoveProperty={onRemoveProperty}
                  />
                ))}
              </div>
            )}
          </div>

          {remainingCount > 0 && (
            <div className="vp-more-count">
              +{remainingCount} more issue{remainingCount !== 1 ? "s" : ""}.{" "}
              <span className="vp-nav-link" onClick={handleNavigate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNavigate(); }} >
                View all in Validation tab
              </span>
            </div>
          )}

          {totalIssues > 0 && remainingCount === 0 && onNavigateToValidation && (
            <div className="vp-more-count">
              <span className="vp-nav-link" onClick={handleNavigate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNavigate(); }} >
                View full details in Validation tab
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ErrorCard.propTypes = {
  error: PropTypes.object.isRequired,
  isWarning: PropTypes.bool,
  onRemoveProperty: PropTypes.func,
};

ValidationPopover.propTypes = {
  validationResult: PropTypes.object,
  onNavigateToValidation: PropTypes.func,
  onRemoveProperty: PropTypes.func,
};
