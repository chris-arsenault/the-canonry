/**
 * EntityBrowserSelectionBar - Actions for selected entities
 *
 * Extracted from EntityBrowser to reduce file size and complexity.
 */

import React from "react";

interface EntityBrowserSelectionBarProps {
  selectedCount: number;
  onQueueSelectedDescriptions: () => void;
  onQueueSelectedImages: () => void;
  onRegenSelectedDescriptions: () => void;
  onRegenSelectedImages: () => void;
  onDownloadSelectedDebug: () => void;
  onDownloadSelectedEditions: () => void;
  onDownloadSelectedAnnotations: () => void;
  onClearSelection: () => void;
}

export function EntityBrowserSelectionBar({
  selectedCount,
  onQueueSelectedDescriptions,
  onQueueSelectedImages,
  onRegenSelectedDescriptions,
  onRegenSelectedImages,
  onDownloadSelectedDebug,
  onDownloadSelectedEditions,
  onDownloadSelectedAnnotations,
  onClearSelection,
}: Readonly<EntityBrowserSelectionBarProps>) {
  if (selectedCount === 0) return null;

  return (
    <div className="ilu-selection-bar eb-selection-bar">
      <span className="eb-selection-count">{selectedCount} selected</span>
      <button
        onClick={onQueueSelectedDescriptions}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Queue missing descriptions"
      >
        Queue Desc
      </button>
      <button
        onClick={onQueueSelectedImages}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Queue missing images"
      >
        Queue Img
      </button>
      <button
        onClick={onRegenSelectedDescriptions}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Regenerate existing descriptions"
      >
        Regen Desc
      </button>
      <button
        onClick={onRegenSelectedImages}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Regenerate existing images"
      >
        Regen Img
      </button>
      <button
        onClick={onDownloadSelectedDebug}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Download debug request/response data for selected entities"
      >
        Download Debug
      </button>
      <button
        onClick={onDownloadSelectedEditions}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Export pre-historian, legacy, and active description versions + annotations for selected entities"
      >
        Export Editions
      </button>
      <button
        onClick={onDownloadSelectedAnnotations}
        className="illuminator-button illuminator-button-secondary eb-selection-btn"
        title="Export historian annotations for selected entities (name, kind, prominence)"
      >
        Export Annotations
      </button>
      <button onClick={onClearSelection} className="illuminator-button-link eb-selection-clear">
        Clear
      </button>
    </div>
  );
}
