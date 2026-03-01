/**
 * ExportModal - Modal for choosing slot export format.
 *
 * Extracted from App.jsx to reduce component size and complexity.
 */

import React, { useCallback } from "react";

interface ExportBundleStatus {
  state: "idle" | "working" | "error";
  detail: string;
}

interface ExportModalProps {
  slotIndex: number;
  title: string;
  bundleStatus: ExportBundleStatus;
  onClose: () => void;
  onExportSlotDownload: (slotIndex: number) => void;
  onExportBundle: (slotIndex: number) => void;
  onCancelExport: () => void;
  useS3Images: boolean;
}

export default function ExportModal({
  slotIndex,
  title,
  bundleStatus,
  onClose,
  onExportSlotDownload,
  onExportBundle,
  onCancelExport,
  useS3Images,
}: ExportModalProps) {
  const mouseDownRef = React.useRef(false);
  const isWorking = bundleStatus.state === "working";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownRef.current = e.target === e.currentTarget;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isWorking) return;
      if (mouseDownRef.current && e.target === e.currentTarget) {
        onClose();
      }
    },
    [isWorking, onClose],
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick(e as unknown as React.MouseEvent);
    },
    [handleClick],
  );

  const handleStandardExport = useCallback(() => {
    onExportSlotDownload(slotIndex);
    onClose();
  }, [onExportSlotDownload, slotIndex, onClose]);

  const handleBundleExport = useCallback(() => {
    onExportBundle(slotIndex);
  }, [onExportBundle, slotIndex]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="modal modal-simple">
        <div className="modal-header" role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
        }}>
          <div className="modal-title">Export {title}</div>
          {!isWorking && (
            <button className="btn-close" onClick={onClose}>
              x
            </button>
          )}
        </div>
        <div className="modal-body">
          {isWorking ? (
            <div className="modal-status">
              <div className="modal-spinner" aria-hidden="true" />
              <div>
                <div className="modal-status-title">Building viewer bundle</div>
                <div className="modal-status-subtitle">
                  {bundleStatus.detail ||
                    "This can take a few minutes for large image sets."}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="inline-extracted-7">
                Choose the export format for this run slot.
              </div>
              <div className="inline-extracted-8">
                Viewer bundles include chronicles, static pages, and referenced images.
              </div>
              {useS3Images && (
                <div className="inline-extracted-9">
                  S3 image sync enabled: bundle will reference remote images and skip
                  embedding them.
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-actions">
          {isWorking ? (
            <button className="btn-sm" onClick={onCancelExport}>
              Cancel Export
            </button>
          ) : (
            <>
              <button className="btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-sm" onClick={handleStandardExport}>
                Standard Export
              </button>
              <button className="btn-sm btn-sm-primary" onClick={handleBundleExport}>
                Viewer Bundle
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
