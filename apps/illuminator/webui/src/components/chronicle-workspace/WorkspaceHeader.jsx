import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import "./WorkspaceHeader.css";

export default function WorkspaceHeader({
  item,
  wordCount,
  isGenerating,
  isComplete,
  onAccept,
  onRegenerate,
  onExport,
  onUnpublish,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div className="chronicle-workspace-header">
      <div className="chronicle-workspace-header-info">
        <h3>{item.title || item.name || "Untitled Chronicle"}</h3>
        <div className="chronicle-workspace-header-stats">
          {wordCount.toLocaleString()} words
          {item.selectionSummary && (
            <span>
              {" "}
              &middot; {item.selectionSummary.entityCount} entities,{" "}
              {item.selectionSummary.eventCount} events
            </span>
          )}
          {item.focusType && (
            <span> &middot; {item.focusType === "single" ? "Single focus" : "Ensemble"}</span>
          )}
          <span> &middot; sampling {item.generationSampling ?? "unspecified"}</span>
        </div>
      </div>
      <div className="chronicle-workspace-header-actions">
        {!isComplete && onAccept && (
          <button onClick={onAccept} disabled={isGenerating} className="wsh-btn-accept">
            Accept &#x2713;
          </button>
        )}
        {isComplete && onUnpublish && (
          <button
            onClick={onUnpublish}
            className="wsh-btn-unpublish"
            title="Revert to assembly review without discarding content"
          >
            Unpublish
          </button>
        )}
        <button onClick={onRegenerate} disabled={isGenerating} className="wsh-btn-regenerate">
          &#x27F3; {isComplete ? "Restart" : "Regenerate"}
        </button>
        <div className="workspace-overflow-menu" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="wsh-btn-overflow">
            &hellip;
          </button>
          {menuOpen && (
            <div className="workspace-overflow-dropdown">
              {onExport && (
                <button
                  className="workspace-overflow-item"
                  onClick={() => {
                    onExport();
                    setMenuOpen(false);
                  }}
                  title="Export chronicle with full generation context as JSON"
                >
                  Export
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

WorkspaceHeader.propTypes = {
  item: PropTypes.object,
  wordCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isGenerating: PropTypes.bool,
  isComplete: PropTypes.bool,
  onAccept: PropTypes.func,
  onRegenerate: PropTypes.func,
  onExport: PropTypes.func,
  onUnpublish: PropTypes.func,
};
