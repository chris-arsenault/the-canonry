/**
 * ChroniclePanelToasts - Toast notifications for bulk operation results.
 */

import React, { useCallback } from "react";
import { ErrorMessage } from "@the-canonry/shared-components";
import type { OperationResult, ResetBackportResult, TertiaryDetectResult } from "./chroniclePanelTypes";

// ---------------------------------------------------------------------------
// Dismissable toast wrapper
// ---------------------------------------------------------------------------

interface ToastProps {
  variant: "success" | "error";
  onDismiss: () => void;
  children: React.ReactNode;
}

function Toast({ variant, onDismiss, children }: ToastProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onDismiss();
    },
    [onDismiss],
  );

  return (
    <div
      className={`chron-toast chron-toast-${variant}`}
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span>{children}</span>
      <button className="chron-toast-close">&times;</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EraSummaryRefreshToast
// ---------------------------------------------------------------------------

interface EraSummaryRefreshToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function EraSummaryRefreshToast({ result, onDismiss }: EraSummaryRefreshToastProps) {
  const variant = result.success ? "success" : "error";
  let message: React.ReactNode;

  if (!result.success) {
    message = <ErrorMessage message={result.error || "Unknown error"} />;
  } else if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Updated era summaries in ${result.count} chronicle${plural}`;
  } else {
    message = "All chronicle era summaries are already up to date";
  }

  return (
    <Toast variant={variant} onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// TemporalCheckToast
// ---------------------------------------------------------------------------

interface TemporalCheckToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function TemporalCheckToast({ result, onDismiss }: TemporalCheckToastProps) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Enqueued temporal checks for ${result.count} chronicle${plural}`;
  } else {
    message = "No eligible chronicles (need temporal narrative + assembled content)";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkSummaryToast
// ---------------------------------------------------------------------------

interface BulkSummaryToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkSummaryToast({ result, onDismiss }: BulkSummaryToastProps) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Enqueued summary generation for ${result.count} chronicle${plural}`;
  } else {
    message = "No chronicles with missing summaries";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// ResetBackportToast
// ---------------------------------------------------------------------------

interface ResetBackportToastProps {
  result: ResetBackportResult;
  onDismiss: () => void;
}

export function ResetBackportToast({ result, onDismiss }: ResetBackportToastProps) {
  const variant = result.success ? "success" : "error";
  let message: React.ReactNode;

  if (!result.success) {
    message = <ErrorMessage message={result.error || "Unknown error"} />;
  } else {
    const cPlural = result.chronicleCount !== 1 ? "s" : "";
    const ePlural = result.entityCount !== 1 ? "ies" : "y";
    message = `Reset ${result.chronicleCount} chronicle${cPlural}, restored ${result.entityCount} entit${ePlural}`;
  }

  return (
    <Toast variant={variant} onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// ReconcileBackportToast
// ---------------------------------------------------------------------------

interface ReconcileBackportToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function ReconcileBackportToast({ result, onDismiss }: ReconcileBackportToastProps) {
  const variant = result.success ? "success" : "error";
  let message: React.ReactNode;

  if (!result.success) {
    message = <ErrorMessage message={result.error || "Unknown error"} />;
  } else {
    const plural = result.count !== 1 ? "s" : "";
    message = `Reconciled ${result.count} chronicle${plural} from entity backrefs`;
  }

  return (
    <Toast variant={variant} onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// TertiaryDetectToast (re-export type for external use)
// ---------------------------------------------------------------------------

interface TertiaryDetectToastProps {
  result: TertiaryDetectResult;
  onDismiss: () => void;
}

export function TertiaryDetectToast({ result, onDismiss }: TertiaryDetectToastProps) {
  if (result.running) return null;

  const variant = result.success ? "success" : "error";
  let message: React.ReactNode;

  if (!result.success) {
    message = <ErrorMessage message={result.error || "Detection failed"} />;
  } else {
    const plural = result.count !== 1 ? "s" : "";
    message = `Re-detected tertiary cast on ${result.count} chronicle${plural}`;
  }

  return (
    <Toast variant={variant} onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}
