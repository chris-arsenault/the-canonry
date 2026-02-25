/**
 * RevisionFilterModal - Pre-revision entity filter
 *
 * Shows entity counts and lets the user exclude entities that have been
 * used in chronicle casts, preventing inconsistency between rewritten
 * summaries and already-generated chronicle text.
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import "./RevisionFilterModal.css";

export default function RevisionFilterModal({
  isOpen,
  totalEligible,
  usedInChronicles,
  onStart,
  onCancel,
}) {
  const [excludeChronicle, setExcludeChronicle] = useState(true);

  if (!isOpen) return null;

  const available = excludeChronicle ? totalEligible - usedInChronicles : totalEligible;

  return (
    <div className="rfm-overlay">
      <div className="rfm-dialog">
        {/* Header */}
        <div className="rfm-header">
          <h2 className="rfm-title">Revise Entity Summaries</h2>
          <p className="rfm-subtitle">
            Rewrite summaries and descriptions with full world context.
          </p>
        </div>

        {/* Body */}
        <div className="rfm-body">
          {/* Counts */}
          <div className="rfm-counts-grid">
            <span className="rfm-count-label">Total eligible entities</span>
            <span className="rfm-count-value">{totalEligible}</span>

            <span className="rfm-count-label">Used in chronicles</span>
            <span
              className={`rfm-count-value ${usedInChronicles > 0 ? "rfm-count-value-warning" : "rfm-count-value-muted"}`}
            >
              {usedInChronicles}
            </span>

            <span className="rfm-count-label rfm-count-label-total">Available for revision</span>
            <span className="rfm-count-value">{available}</span>
          </div>

          {/* Chronicle filter toggle */}
          {usedInChronicles > 0 && (
            <label className="rfm-filter-toggle">
              <input
                type="checkbox"
                checked={excludeChronicle}
                onChange={(e) => setExcludeChronicle(e.target.checked)}
                className="rfm-filter-checkbox"
              />
              <div>
                <div className="rfm-filter-title">Exclude entities used in chronicles</div>
                <div className="rfm-filter-description">
                  Recommended. Prevents inconsistency between rewritten descriptions and existing
                  chronicle text.
                </div>
              </div>
            </label>
          )}

          {available === 0 && (
            <div className="rfm-warning">
              No entities available for revision with current filters.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="rfm-footer">
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary rfm-footer-btn"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(excludeChronicle)}
            disabled={available === 0}
            className="illuminator-button illuminator-button-primary rfm-footer-btn"
          >
            Start Revision ({available} entities)
          </button>
        </div>
      </div>
    </div>
  );
}

RevisionFilterModal.propTypes = {
  isOpen: PropTypes.bool,
  totalEligible: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  usedInChronicles: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onStart: PropTypes.func,
  onCancel: PropTypes.func,
};
