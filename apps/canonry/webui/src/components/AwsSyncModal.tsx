/**
 * AwsSyncModal - Modal for AWS Cognito auth, S3 image sync, and data snapshots.
 *
 * Extracted from App.jsx to reduce component size and complexity.
 */

import React, { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AwsConfig {
  region: string;
  identityPoolId: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  imageBucket: string;
  imagePrefix: string;
  useS3Images: boolean;
}

interface AwsStatus {
  state: "idle" | "working" | "error";
  detail: string;
}

interface BrowseState {
  loading: boolean;
  prefixes: string[];
  error: string | null;
}

interface SyncProgress {
  phase: string;
  processed: number;
  total: number;
  uploaded: number;
}

interface UploadPlan {
  loading: boolean;
  error: string | null;
  summary: UploadPlanSummary | null;
  json: string;
}

interface UploadPlanSummary {
  total: number;
  uploadCount: number;
  manifestFound: boolean;
  basePrefix: string;
  repairs?: { updated: number; skipped: number; failed: number };
  manifestRepairs?: { updated: number; skipped: number; failed: number };
}

interface SnapshotStatus {
  state: "idle" | "working" | "error";
  detail: string;
}

interface AwsSyncModalProps {
  config: AwsConfig;
  status: AwsStatus;
  browseState: BrowseState;
  syncProgress: SyncProgress;
  uploadPlan: UploadPlan;
  snapshotStatus: SnapshotStatus;
  hasAwsToken: boolean;
  awsReady: boolean;
  awsLoginConfigured: boolean;
  userLabel: string;
  username: string;
  password: string;
  onUpdateConfig: (patch: Partial<AwsConfig>) => void;
  onSetUsername: (v: string) => void;
  onSetPassword: (v: string) => void;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onBrowsePrefixes: () => void;
  onTestSetup: () => void;
  onPreviewUploads: () => void;
  onPullImages: () => void;
  onSyncImages: () => void;
  onReconcileManifest: () => void;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
}

// ---------------------------------------------------------------------------
// Sub-sections (keep each under complexity limit)
// ---------------------------------------------------------------------------

function SessionSection({
  awsLoginConfigured,
  hasAwsToken,
  userLabel,
}: Readonly<{
  awsLoginConfigured: boolean;
  hasAwsToken: boolean;
  userLabel: string;
}>) {
  let message: string;
  if (awsLoginConfigured) {
    message = hasAwsToken
      ? `Signed in as ${userLabel || "Cognito user"}.`
      : "Not authenticated. Login required.";
  } else {
    message = "No user pool configured. Identity pool must allow unauthenticated access.";
  }
  return (
    <div className="aws-section">
      <div className="aws-label">Session</div>
      <div className="aws-session-value">{message}</div>
    </div>
  );
}

function StatusSection({ status }: Readonly<{ status: AwsStatus }>) {
  if (!status.detail) return null;
  return (
    <div className="modal-status aws-section">
      <div className="modal-status-title">AWS Status</div>
      <div className="modal-status-subtitle">{status.detail}</div>
    </div>
  );
}

function SyncProgressSection({ progress }: Readonly<{ progress: SyncProgress }>) {
  if (progress.total <= 0) return null;
  return (
    <div className="aws-section">
      <div className="aws-hint">
        Sync progress: {progress.processed}/{progress.total} processed
        {progress.uploaded ? `, ${progress.uploaded} uploaded` : ""}
      </div>
      <div className="aws-progress-track">
        <progress
          className="canonry-aws-sync-progress"
          max={Math.max(progress.total, 1)}
          value={Math.min(progress.processed, Math.max(progress.total, 1))}
        />
      </div>
    </div>
  );
}

function CognitoAuthSection({
  config,
  hasAwsToken,
  userLabel,
  username,
  password,
  onUpdateConfig,
  onSetUsername,
  onSetPassword,
  onLogin,
  onLogout,
}: Readonly<Pick<
  AwsSyncModalProps,
  | "config"
  | "hasAwsToken"
  | "userLabel"
  | "username"
  | "password"
  | "onUpdateConfig"
  | "onSetUsername"
  | "onSetPassword"
  | "onLogin"
  | "onLogout"
>>) {
  return (
    <div className="aws-section">
      <div className="modal-title aws-section-title">Cognito Auth</div>
      <div className="aws-grid">
        <div className="aws-field">
          <label htmlFor="region" className="aws-label">Region</label>
          <input
            id="region"
            value={config.region}
            onChange={(e) => onUpdateConfig({ region: e.target.value })}
            placeholder="us-east-1"
            className="aws-input"
          />
        </div>
        <div className="aws-field">
          <label htmlFor="identity-pool-id" className="aws-label">Identity Pool ID</label>
          <input
            id="identity-pool-id"
            value={config.identityPoolId}
            onChange={(e) => onUpdateConfig({ identityPoolId: e.target.value })}
            placeholder="us-east-1:xxxx-xxxx"
            className="aws-input"
          />
        </div>
        <div className="aws-field">
          <label htmlFor="user-pool-id" className="aws-label">User Pool ID</label>
          <input
            id="user-pool-id"
            value={config.cognitoUserPoolId}
            onChange={(e) => onUpdateConfig({ cognitoUserPoolId: e.target.value })}
            placeholder="us-east-1_XXXXXX"
            className="aws-input"
          />
        </div>
        <div className="aws-field">
          <label htmlFor="app-client-id" className="aws-label">App Client ID</label>
          <input
            id="app-client-id"
            value={config.cognitoClientId}
            onChange={(e) => onUpdateConfig({ cognitoClientId: e.target.value })}
            placeholder="Cognito client id"
            className="aws-input"
          />
        </div>
      </div>
      <div className="aws-credentials">
        {hasAwsToken ? (
          <div className="aws-session-info">
            <div className="aws-user-row">
              {userLabel ? `User: ${userLabel}` : "User authenticated."}
            </div>
            <button className="btn-sm" onClick={onLogout}>Sign Out</button>
          </div>
        ) : (
          <div className="aws-login-grid">
            <div className="aws-field">
              <label htmlFor="username" className="aws-label">Username</label>
              <input
                id="username"
                value={username}
                onChange={(e) => onSetUsername(e.target.value)}
                placeholder="username"
                className="aws-input"
              />
            </div>
            <div className="aws-field">
              <label htmlFor="password" className="aws-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => onSetPassword(e.target.value)}
                placeholder="password"
                className="aws-input"
              />
            </div>
            <div className="aws-login-submit">
              <button className="btn-sm btn-sm-primary" onClick={onLogin}>Sign In</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function S3StorageSection({
  config,
  awsReady,
  uploadPlan,
  browseState,
  status,
  onUpdateConfig,
  onBrowsePrefixes,
  onTestSetup,
  onPreviewUploads,
  onPullImages,
  onSyncImages,
  onReconcileManifest,
}: Pick<
  AwsSyncModalProps,
  | "config"
  | "browseState"
  | "uploadPlan"
  | "status"
  | "onUpdateConfig"
  | "onBrowsePrefixes"
  | "onTestSetup"
  | "onPreviewUploads"
  | "onPullImages"
  | "onSyncImages"
  | "onReconcileManifest"
> & { awsReady: boolean }) {
  return (
    <div className="aws-section">
      <div className="modal-title aws-section-title">S3 Image Storage</div>
      <div className="aws-grid">
        <div className="aws-field">
          <label htmlFor="image-bucket" className="aws-label">Bucket</label>
          <input
            id="image-bucket"
            value={config.imageBucket}
            onChange={(e) => onUpdateConfig({ imageBucket: e.target.value })}
            placeholder="bucket-name"
            className="aws-input"
          />
        </div>
        <div className="aws-field">
          <label htmlFor="image-prefix" className="aws-label">Base Prefix</label>
          <input
            id="image-prefix"
            value={config.imagePrefix}
            onChange={(e) => onUpdateConfig({ imagePrefix: e.target.value })}
            placeholder="canonry"
            className="aws-input"
          />
        </div>
      </div>
      <div className="aws-s3-toggle">
        <button className="btn-sm" onClick={onBrowsePrefixes}>Browse Prefix</button>
        <button className="btn-sm" onClick={onTestSetup}>Test Setup</button>
        <button
          className="btn-sm"
          disabled={!awsReady || uploadPlan.loading}
          onClick={onPreviewUploads}
        >
          Preview Uploads
        </button>
        <button
          className="btn-sm"
          disabled={!awsReady || status.state === "working"}
          onClick={onPullImages}
        >
          Pull Images from S3
        </button>
        <button
          className="btn-sm btn-sm-primary"
          disabled={!awsReady || status.state === "working"}
          onClick={onSyncImages}
        >
          Push Images to S3
        </button>
        <button
          className="btn-sm"
          disabled={!awsReady || status.state === "working"}
          onClick={onReconcileManifest}
          title="Rebuild manifest from S3 object listing — recovers from interrupted uploads"
        >
          Reconcile Manifest
        </button>
      </div>
      {browseState.loading && (
        <div className="aws-browse-loading">Loading prefixes...</div>
      )}
      {browseState.error && (
        <div className="aws-browse-error">{browseState.error}</div>
      )}
      {browseState.prefixes.length > 0 && (
        <div className="aws-browse-prefixes">
          {browseState.prefixes.map((prefix) => (
            <button
              key={prefix}
              className="btn-sm aws-browse-prefix-btn"
              onClick={() => onUpdateConfig({ imagePrefix: prefix.replace(/\/$/, "") })}
            >
              {prefix}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UseS3Toggle({
  checked,
  onUpdateConfig,
}: Readonly<{
  checked: boolean;
  onUpdateConfig: (patch: Partial<AwsConfig>) => void;
}>) {
  return (
    <div className="aws-checkbox-section">
      <label className="aws-checkbox-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onUpdateConfig({ useS3Images: e.target.checked })}
        />
        <span>Use S3 images for viewer exports</span>
      </label>
    </div>
  );
}

function DataSnapshotSection({
  awsReady,
  snapshotStatus,
  onExportSnapshot,
  onImportSnapshot,
}: Readonly<{
  awsReady: boolean;
  snapshotStatus: SnapshotStatus;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
}>) {
  const statusClass =
    snapshotStatus.state === "error"
      ? "canonry-snapshot-detail canonry-snapshot-detail-error"
      : "canonry-snapshot-detail canonry-snapshot-detail-default";
  return (
    <div className="aws-section">
      <div className="modal-title aws-section-title">Data Snapshot</div>
      <div className="aws-actions-row">
        Export/import all IndexedDB data (projects, runs, entities, chronicles, costs,
        styles, etc.) to S3. Images excluded -- sync those separately.
      </div>
      <div className="aws-status-text">
        <button
          className="btn-sm"
          disabled={!awsReady || snapshotStatus.state === "working"}
          onClick={onExportSnapshot}
        >
          Export to S3
        </button>
        <button
          className="btn-sm"
          disabled={!awsReady || snapshotStatus.state === "working"}
          onClick={onImportSnapshot}
        >
          Import from S3
        </button>
      </div>
      {snapshotStatus.detail && <div className={statusClass}>{snapshotStatus.detail}</div>}
    </div>
  );
}

function UploadPlanSection({ uploadPlan }: Readonly<{ uploadPlan: UploadPlan }>) {
  let description: string;
  if (uploadPlan.loading) {
    description = "Calculating upload plan...";
  } else if (uploadPlan.summary) {
    description = `Would upload ${uploadPlan.summary.uploadCount} of ${uploadPlan.summary.total} images.`;
  } else {
    description = 'Click "Preview Uploads" to see which images would be uploaded.';
  }

  return (
    <div className="aws-section">
      <div className="modal-title aws-section-title">Upload Plan</div>
      <div className="aws-actions-row">{description}</div>
      {uploadPlan.summary && (
        <div className="aws-plan-summary">
          Manifest: {uploadPlan.summary.manifestFound ? "found" : "missing"} · Prefix:{" "}
          {uploadPlan.summary.basePrefix || "(root)"}
        </div>
      )}
      {uploadPlan.summary?.repairs && (
        <div className="aws-plan-detail">
          Repairs: {uploadPlan.summary.repairs.updated} updated,{" "}
          {uploadPlan.summary.repairs.skipped} skipped,{" "}
          {uploadPlan.summary.repairs.failed} failed.
        </div>
      )}
      {uploadPlan.summary?.manifestRepairs && (
        <div className="aws-plan-detail">
          Manifest repairs: {uploadPlan.summary.manifestRepairs.updated} updated,{" "}
          {uploadPlan.summary.manifestRepairs.skipped} skipped,{" "}
          {uploadPlan.summary.manifestRepairs.failed} failed.
        </div>
      )}
      {uploadPlan.error && <div className="aws-plan-error">{uploadPlan.error}</div>}
      {uploadPlan.json && (
        <textarea readOnly value={uploadPlan.json} className="aws-plan-json" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AwsSyncModal({
  config,
  status,
  browseState,
  syncProgress,
  uploadPlan,
  snapshotStatus,
  hasAwsToken,
  awsReady,
  awsLoginConfigured,
  userLabel,
  username,
  password,
  onUpdateConfig,
  onSetUsername,
  onSetPassword,
  onClose,
  onLogin,
  onLogout,
  onBrowsePrefixes,
  onTestSetup,
  onPreviewUploads,
  onPullImages,
  onSyncImages,
  onReconcileManifest,
  onExportSnapshot,
  onImportSnapshot,
}: Readonly<AwsSyncModalProps>) {
  const mouseDownRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownRef.current = e.target === e.currentTarget;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (mouseDownRef.current && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick(e as unknown as React.MouseEvent);
    },
    [handleClick],
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="modal modal-simple aws-modal">
        <div className="modal-header" role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
        }}>
          <div className="modal-title">AWS Sync</div>
          <button className="btn-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <SessionSection
            awsLoginConfigured={awsLoginConfigured}
            hasAwsToken={hasAwsToken}
            userLabel={userLabel}
          />
          <StatusSection status={status} />
          <SyncProgressSection progress={syncProgress} />
          <CognitoAuthSection
            config={config}
            hasAwsToken={hasAwsToken}
            userLabel={userLabel}
            username={username}
            password={password}
            onUpdateConfig={onUpdateConfig}
            onSetUsername={onSetUsername}
            onSetPassword={onSetPassword}
            onLogin={onLogin}
            onLogout={onLogout}
          />
          <S3StorageSection
            config={config}
            awsReady={awsReady}
            browseState={browseState}
            uploadPlan={uploadPlan}
            status={status}
            onUpdateConfig={onUpdateConfig}
            onBrowsePrefixes={onBrowsePrefixes}
            onTestSetup={onTestSetup}
            onPreviewUploads={onPreviewUploads}
            onPullImages={onPullImages}
            onSyncImages={onSyncImages}
            onReconcileManifest={onReconcileManifest}
          />
          <UseS3Toggle checked={Boolean(config.useS3Images)} onUpdateConfig={onUpdateConfig} />
          <DataSnapshotSection
            awsReady={awsReady}
            snapshotStatus={snapshotStatus}
            onExportSnapshot={onExportSnapshot}
            onImportSnapshot={onImportSnapshot}
          />
          <UploadPlanSection uploadPlan={uploadPlan} />
        </div>
        <div className="modal-actions">
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
