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

function Toast({ variant, onDismiss, children }: Readonly<ToastProps>) {
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

export function EraSummaryRefreshToast({ result, onDismiss }: Readonly<EraSummaryRefreshToastProps>) {
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

export function TemporalCheckToast({ result, onDismiss }: Readonly<TemporalCheckToastProps>) {
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

export function BulkSummaryToast({ result, onDismiss }: Readonly<BulkSummaryToastProps>) {
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
// BulkImageRefToast
// ---------------------------------------------------------------------------

interface BulkImageRefToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkImageRefToast({ result, onDismiss }: Readonly<BulkImageRefToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Enqueued image ref regeneration for ${result.count} chronicle${plural}`;
  } else {
    message = "No chronicles with image refs to regenerate";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkTagImageRefToast
// ---------------------------------------------------------------------------

interface BulkTagImageRefToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkTagImageRefToast({ result, onDismiss }: Readonly<BulkTagImageRefToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Enqueued image ref tagging for ${result.count} chronicle${plural}`;
  } else {
    message = "No chronicles with image refs to tag";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkClearImageRefToast
// ---------------------------------------------------------------------------

interface BulkClearImageRefToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkClearImageRefToast({ result, onDismiss }: Readonly<BulkClearImageRefToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Cleared image refs from ${result.count} chronicle${plural}`;
  } else {
    message = "No chronicles with image refs to clear";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// AssignImageStyleToast
// ---------------------------------------------------------------------------

interface AssignImageStyleToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function AssignImageStyleToast({ result, onDismiss }: Readonly<AssignImageStyleToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Assigned styles to ${result.count} image ref${plural}`;
  } else {
    message = "No image refs with ranked styles to assign";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// AssignCoverImageStyleToast
// ---------------------------------------------------------------------------

interface AssignCoverImageStyleToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function AssignCoverImageStyleToast({ result, onDismiss }: Readonly<AssignCoverImageStyleToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Assigned styles to ${result.count} cover image${plural}`;
  } else {
    message = "No cover images with ranked styles to assign";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// AssignSecondaryStyleToast
// ---------------------------------------------------------------------------

interface AssignSecondaryStyleToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function AssignSecondaryStyleToast({ result, onDismiss }: Readonly<AssignSecondaryStyleToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    const plural = result.count !== 1 ? "s" : "";
    message = `Assigned secondary styles to ${result.count} image${plural}`;
  } else {
    message = "No images with primary assignments + ranked styles to assign secondaries";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkGenerateSceneToast
// ---------------------------------------------------------------------------

interface BulkGenerateSceneToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkGenerateSceneToast({ result, onDismiss }: Readonly<BulkGenerateSceneToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    message = `Enqueued ${result.count} scene image${result.count !== 1 ? "s" : ""} for generation`;
  } else {
    message = "No eligible scene refs to generate (need assigned styles and no existing image)";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkGenerateCoverImageToast
// ---------------------------------------------------------------------------

interface BulkGenerateCoverImageToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkGenerateCoverImageToast({ result, onDismiss }: Readonly<BulkGenerateCoverImageToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    message = `Enqueued ${result.count} cover image${result.count !== 1 ? "s" : ""} for generation`;
  } else {
    message = "No eligible cover images to generate (need assigned styles and no existing image)";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkClearSceneImageToast
// ---------------------------------------------------------------------------

interface BulkClearSceneImageToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkClearSceneImageToast({ result, onDismiss }: Readonly<BulkClearSceneImageToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    message = `Cleared ${result.count} scene image${result.count !== 1 ? "s" : ""}`;
  } else {
    message = "No scene images to clear";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkGenerateCoverSceneToast
// ---------------------------------------------------------------------------

interface BulkGenerateCoverSceneToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkGenerateCoverSceneToast({ result, onDismiss }: Readonly<BulkGenerateCoverSceneToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    message = `Enqueued cover scene generation for ${result.count} chronicle${result.count !== 1 ? "s" : ""}`;
  } else {
    message = "No eligible chronicles for cover scene generation";
  }

  return (
    <Toast variant="success" onDismiss={onDismiss}>
      {message}
    </Toast>
  );
}

// ---------------------------------------------------------------------------
// BulkClearCoverImageToast
// ---------------------------------------------------------------------------

interface BulkClearCoverImageToastProps {
  result: OperationResult;
  onDismiss: () => void;
}

export function BulkClearCoverImageToast({ result, onDismiss }: Readonly<BulkClearCoverImageToastProps>) {
  let message: string;
  if (result.count && result.count > 0) {
    message = `Cleared cover images from ${result.count} chronicle${result.count !== 1 ? "s" : ""}`;
  } else {
    message = "No cover images to clear";
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

export function ResetBackportToast({ result, onDismiss }: Readonly<ResetBackportToastProps>) {
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

export function ReconcileBackportToast({ result, onDismiss }: Readonly<ReconcileBackportToastProps>) {
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

export function TertiaryDetectToast({ result, onDismiss }: Readonly<TertiaryDetectToastProps>) {
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
