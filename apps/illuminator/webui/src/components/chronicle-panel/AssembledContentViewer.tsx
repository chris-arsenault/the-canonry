/**
 * AssembledContentViewer - Displays assembled chronicle content with word count and copy action.
 */

import React from "react";

interface AssembledContentViewerProps {
  content: React.ReactNode;
  wordCount: number;
  onCopy: () => void;
}

export function AssembledContentViewer({ content, wordCount, onCopy }: AssembledContentViewerProps) {
  return (
    <div>
      <div className="chron-assembled-header">
        <div className="chron-assembled-word-count">{wordCount.toLocaleString()} words</div>
        <div className="chron-assembled-actions">
          <button onClick={onCopy} className="chron-assembled-copy-btn">
            Copy
          </button>
        </div>
      </div>
      <div className="chron-assembled-content">{content}</div>
    </div>
  );
}

export default AssembledContentViewer;
