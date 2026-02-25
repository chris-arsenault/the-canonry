/**
 * HistoryCompressionPreviewModal - Shows description archive compression
 * effects before dispatching a historian edition (copy edit) LLM call.
 *
 * Displayed when an entity has enough history versions that compression
 * applies (>8 entries). Shows what the LLM will receive: which versions
 * were consolidated and which were kept as distinct milestones.
 */

import "./HistoryCompressionPreviewModal.css";

export default function HistoryCompressionPreviewModal({
  entityName,
  originalCount,
  compressed,
  onProceed,
  onCancel,
}) {
  if (!compressed || compressed.length === 0) return null;

  const removedCount = originalCount - compressed.length;

  return (
    <div className="hcpm-overlay">
      <div className="hcpm-dialog">
        {/* Header */}
        <div className="hcpm-header">
          <div>
            <h2 className="hcpm-heading">
              Description Archive
              <span className="hcpm-entity-name">{entityName}</span>
            </h2>
            <p className="hcpm-subtitle">
              {removedCount > 0
                ? `${originalCount} versions → ${compressed.length} milestones (${removedCount} near-duplicate passes consolidated)`
                : `${originalCount} versions — no compression needed`}
            </p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="hcpm-content">
          {compressed.map((entry, i) => {
            const date = new Date(entry.replacedAt).toISOString().split("T")[0];
            const isConsolidated = entry.consolidatedCount > 1;
            const earliestDate = entry.earliestDate
              ? new Date(entry.earliestDate).toISOString().split("T")[0]
              : null;

            return (
              <div
                key={i}
                className={`hcpm-entry ${isConsolidated ? "hcpm-entry--consolidated" : "hcpm-entry--normal"}`}
              >
                {/* Header */}
                <div className="hcpm-entry-header">
                  <div className="hcpm-entry-header-left">
                    <span className="hcpm-entry-index">[{i + 1}]</span>
                    <span className="hcpm-entry-source">{entry.source}</span>
                    {isConsolidated && (
                      <span className="hcpm-entry-consolidated-label">
                        {entry.consolidatedCount} passes consolidated
                      </span>
                    )}
                  </div>
                  <span className="hcpm-entry-date">
                    {isConsolidated && earliestDate ? `${earliestDate} → ${date}` : date}
                  </span>
                </div>

                {/* Preview */}
                <div className="hcpm-entry-preview">{entry.description.slice(0, 300)}</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="hcpm-footer">
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary hcpm-footer-btn"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="illuminator-button illuminator-button-primary hcpm-footer-btn"
          >
            Proceed with Copy Edit
          </button>
        </div>
      </div>
    </div>
  );
}
