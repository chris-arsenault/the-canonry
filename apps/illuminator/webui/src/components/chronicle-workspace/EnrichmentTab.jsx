import "./EnrichmentTab.css";
import React from "react";
import PropTypes from "prop-types";

export default function EnrichmentTab({
  item,
  isGenerating,
  refinements,
  onGenerateTitle,
  onGenerateSummary,
  onGenerateImageRefs,
}) {
  const titleState = refinements?.title || {};
  const summaryState = refinements?.summary || {};
  const imageRefsState = refinements?.imageRefs || {};
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const titleDisabled = isGenerating || titleState.running;
  const summaryDisabled = isGenerating || summaryState.running;
  const imageRefsDisabled = isGenerating || imageRefsState.running;

  return (
    <div>
      <div className="ilu-section enrtab-container">
        <div className="enrtab-heading">Post-Publish Enrichment</div>
        <div className="enrtab-sections">
          {/* Title */}
          {onGenerateTitle && (
            <div className="enrtab-row">
              <div>
                <div className="enrtab-label">Title</div>
                <div className="enrtab-hint">
                  Two-phase title generation: extract fragments, then shape candidates.
                </div>
                {item.titleGeneratedAt && (
                  <div className="enrtab-timestamp">
                    Last generated: {formatTimestamp(item.titleGeneratedAt)}
                  </div>
                )}
                {item.titleCandidates?.length > 0 && (
                  <div className="enrtab-candidates">
                    <span className="enrtab-candidate-selected">&#x25C6; {item.title}</span>
                    <br />
                    {item.titleCandidates.map((c, i) => (
                      <span key={i}>
                        <span className="enrtab-candidate-alt">&#x25C7;</span> {c}
                        {i < item.titleCandidates.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                )}
                {item.titleFragments?.length > 0 && (
                  <div className="enrtab-fragments">~ {item.titleFragments.join(" \u00b7 ")}</div>
                )}
              </div>
              <button
                onClick={onGenerateTitle}
                disabled={titleDisabled}
                className={`ilu-action-btn enrtab-button ${titleDisabled ? "enrtab-button-disabled" : ""}`}
              >
                {titleState.running ? "Generating..." : "Regenerate Title"}
              </button>
            </div>
          )}

          {/* Summary */}
          {onGenerateSummary && (
            <div className="enrtab-row">
              <div>
                <div className="enrtab-label">Summary</div>
                <div className="enrtab-hint">
                  Regenerate the short summary for chronicle listings.
                </div>
                {item.summaryGeneratedAt && (
                  <div className="enrtab-timestamp">
                    Last generated: {formatTimestamp(item.summaryGeneratedAt)}
                  </div>
                )}
              </div>
              <button
                onClick={onGenerateSummary}
                disabled={summaryDisabled}
                className={`ilu-action-btn enrtab-button ${summaryDisabled ? "enrtab-button-disabled" : ""}`}
              >
                {summaryState.running ? "Generating..." : "Regenerate Summary"}
              </button>
            </div>
          )}

          {/* Image Refs */}
          {onGenerateImageRefs && (
            <div className="enrtab-row">
              <div>
                <div className="enrtab-label">Image Refs</div>
                <div className="enrtab-hint">
                  Generate or regenerate scene image placement points throughout the chronicle.
                </div>
                {item.imageRefsGeneratedAt && (
                  <div className="enrtab-timestamp">
                    Last generated: {formatTimestamp(item.imageRefsGeneratedAt)}
                    {item.imageRefs?.refs?.length > 0 && (
                      <span> ({item.imageRefs.refs.length} refs)</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={onGenerateImageRefs}
                disabled={imageRefsDisabled}
                className={`ilu-action-btn enrtab-button ${imageRefsDisabled ? "enrtab-button-disabled" : ""}`}
              >
                {imageRefsState.running
                  ? "Generating..."
                  : item.imageRefs?.refs?.length > 0
                    ? "Regenerate Image Refs"
                    : "Generate Image Refs"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

EnrichmentTab.propTypes = {
  item: PropTypes.object,
  isGenerating: PropTypes.bool,
  refinements: PropTypes.object,
  onGenerateTitle: PropTypes.func,
  onGenerateSummary: PropTypes.func,
  onGenerateImageRefs: PropTypes.func,
};
