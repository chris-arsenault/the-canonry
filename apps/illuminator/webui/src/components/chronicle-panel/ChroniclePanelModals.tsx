/**
 * ChroniclePanelModals - Restart and Reset Backport confirmation modals.
 */

import React, { useCallback } from "react";

// ---------------------------------------------------------------------------
// RestartModal
// ---------------------------------------------------------------------------

interface RestartModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestartModal({ onConfirm, onCancel }: RestartModalProps) {
  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onCancel();
    },
    [onCancel],
  );

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }, []);

  return (
    <div
      className="chron-modal-overlay"
      onClick={onCancel}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="chron-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={0}
        onKeyDown={handleModalKeyDown}
      >
        <h3 className="chron-modal-title">Restart Chronicle?</h3>
        <p className="chron-modal-body">
          This will delete the current chronicle and open the wizard with the same settings. You can
          modify the settings before regenerating.
        </p>
        <div className="chron-modal-actions">
          <button onClick={onCancel} className="chron-modal-cancel-btn">
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            className="chron-modal-danger-btn chron-modal-danger-btn-red"
          >
            Delete &amp; Restart
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResetBackportModal
// ---------------------------------------------------------------------------

interface ResetBackportModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetBackportModal({ onConfirm, onCancel }: ResetBackportModalProps) {
  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onCancel();
    },
    [onCancel],
  );

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }, []);

  return (
    <div
      className="chron-modal-overlay"
      onClick={onCancel}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="chron-modal chron-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={0}
        onKeyDown={handleModalKeyDown}
      >
        <h3 className="chron-modal-title">Reset All Backports?</h3>
        <p className="chron-modal-body-mb16">This will:</p>
        <ul className="chron-modal-list">
          <li>Clear per-entity backport status on all chronicles</li>
          <li>Restore entity descriptions to their pre-backport state</li>
          <li>Clear chronicle backref links from entities</li>
        </ul>
        <p className="chron-modal-hint">
          Use this when you plan to regenerate chronicles and re-run backporting from scratch. Entity
          descriptions will be reverted to what they were before any lore backport was applied.
        </p>
        <div className="chron-modal-actions">
          <button onClick={onCancel} className="chron-modal-cancel-btn">
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            className="chron-modal-danger-btn chron-modal-danger-btn-amber"
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
