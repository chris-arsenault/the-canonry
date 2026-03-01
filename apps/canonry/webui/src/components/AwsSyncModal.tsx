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
}: {
  awsLoginConfigured: boolean;
  hasAwsToken: boolean;
  userLabel: string;
}) {
  let message: string;
  if (awsLoginConfigured) {
    message = hasAwsToken
      ? `Signed in as ${userLabel || "Cognito user"}.`
      : "Not authenticated. Login required.";
  } else {
    message = "No user pool configured. Identity pool must allow unauthenticated access.";
  }
  return (
    <div className="inline-extracted-10">
      <div className="inline-extracted-11">Session</div>
      <div className="inline-extracted-12">{message}</div>
    </div>
  );
}

function StatusSection({ status }: { status: AwsStatus }) {
  if (!status.detail) return null;
  return (
    <div className="modal-status inline-extracted-13">
      <div className="modal-status-title">AWS Status</div>
      <div className="modal-status-subtitle">{status.detail}</div>
    </div>
  );
}

function SyncProgressSection({ progress }: { progress: SyncProgress }) {
  if (progress.total <= 0) return null;
  return (
    <div className="inline-extracted-14">
      <div className="inline-extracted-15">
        Sync progress: {progress.processed}/{progress.total} processed
        {progress.uploaded ? `, ${progress.uploaded} uploaded` : ""}
      </div>
      <div className="inline-extracted-16">
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
}: Pick<
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
>) {
  return (
    <div className="inline-extracted-17">
      <div className="modal-title inline-extracted-18">Cognito Auth</div>
      <div className="inline-extracted-19">
        <div className="inline-extracted-20">
          <label htmlFor="region" className="inline-extracted-21">Region</label>
          <input
            id="region"
            value={config.region}
            onChange={(e) => onUpdateConfig({ region: e.target.value })}
            placeholder="us-east-1"
            className="inline-extracted-22"
          />
        </div>
        <div className="inline-extracted-23">
          <label htmlFor="identity-pool-id" className="inline-extracted-24">Identity Pool ID</label>
          <input
            id="identity-pool-id"
            value={config.identityPoolId}
            onChange={(e) => onUpdateConfig({ identityPoolId: e.target.value })}
            placeholder="us-east-1:xxxx-xxxx"
            className="inline-extracted-25"
          />
        </div>
        <div className="inline-extracted-26">
          <label htmlFor="user-pool-id" className="inline-extracted-27">User Pool ID</label>
          <input
            id="user-pool-id"
            value={config.cognitoUserPoolId}
            onChange={(e) => onUpdateConfig({ cognitoUserPoolId: e.target.value })}
            placeholder="us-east-1_XXXXXX"
            className="inline-extracted-28"
          />
        </div>
        <div className="inline-extracted-29">
          <label htmlFor="app-client-id" className="inline-extracted-30">App Client ID</label>
          <input
            id="app-client-id"
            value={config.cognitoClientId}
            onChange={(e) => onUpdateConfig({ cognitoClientId: e.target.value })}
            placeholder="Cognito client id"
            className="inline-extracted-31"
          />
        </div>
      </div>
      <div className="inline-extracted-32">
        {hasAwsToken ? (
          <div className="inline-extracted-33">
            <div className="inline-extracted-34">
              {userLabel ? `User: ${userLabel}` : "User authenticated."}
            </div>
            <button className="btn-sm" onClick={onLogout}>Sign Out</button>
          </div>
        ) : (
          <div className="inline-extracted-35">
            <div className="inline-extracted-36">
              <label htmlFor="username" className="inline-extracted-37">Username</label>
              <input
                id="username"
                value={username}
                onChange={(e) => onSetUsername(e.target.value)}
                placeholder="username"
                className="inline-extracted-38"
              />
            </div>
            <div className="inline-extracted-39">
              <label htmlFor="password" className="inline-extracted-40">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => onSetPassword(e.target.value)}
                placeholder="password"
                className="inline-extracted-41"
              />
            </div>
            <div className="inline-extracted-42">
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
> & { awsReady: boolean }) {
  return (
    <div className="inline-extracted-43">
      <div className="modal-title inline-extracted-44">S3 Image Storage</div>
      <div className="inline-extracted-45">
        <div className="inline-extracted-46">
          <label htmlFor="image-bucket" className="inline-extracted-47">Bucket</label>
          <input
            id="image-bucket"
            value={config.imageBucket}
            onChange={(e) => onUpdateConfig({ imageBucket: e.target.value })}
            placeholder="bucket-name"
            className="inline-extracted-48"
          />
        </div>
        <div className="inline-extracted-49">
          <label htmlFor="image-prefix" className="inline-extracted-50">Base Prefix</label>
          <input
            id="image-prefix"
            value={config.imagePrefix}
            onChange={(e) => onUpdateConfig({ imagePrefix: e.target.value })}
            placeholder="canonry"
            className="inline-extracted-51"
          />
        </div>
      </div>
      <div className="inline-extracted-52">
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
      </div>
      {browseState.loading && (
        <div className="inline-extracted-53">Loading prefixes...</div>
      )}
      {browseState.error && (
        <div className="inline-extracted-54">{browseState.error}</div>
      )}
      {browseState.prefixes.length > 0 && (
        <div className="inline-extracted-55">
          {browseState.prefixes.map((prefix) => (
            <button
              key={prefix}
              className="btn-sm inline-extracted-56"
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
}: {
  checked: boolean;
  onUpdateConfig: (patch: Partial<AwsConfig>) => void;
}) {
  return (
    <div className="inline-extracted-57">
      <label className="inline-extracted-58">
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
}: {
  awsReady: boolean;
  snapshotStatus: SnapshotStatus;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
}) {
  const statusClass =
    snapshotStatus.state === "error"
      ? "canonry-snapshot-detail canonry-snapshot-detail-error"
      : "canonry-snapshot-detail canonry-snapshot-detail-default";
  return (
    <div className="inline-extracted-59">
      <div className="modal-title inline-extracted-60">Data Snapshot</div>
      <div className="inline-extracted-61">
        Export/import all IndexedDB data (projects, runs, entities, chronicles, costs,
        styles, etc.) to S3. Images excluded -- sync those separately.
      </div>
      <div className="inline-extracted-62">
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

function UploadPlanSection({ uploadPlan }: { uploadPlan: UploadPlan }) {
  let description: string;
  if (uploadPlan.loading) {
    description = "Calculating upload plan...";
  } else if (uploadPlan.summary) {
    description = `Would upload ${uploadPlan.summary.uploadCount} of ${uploadPlan.summary.total} images.`;
  } else {
    description = 'Click "Preview Uploads" to see which images would be uploaded.';
  }

  return (
    <div className="inline-extracted-63">
      <div className="modal-title inline-extracted-64">Upload Plan</div>
      <div className="inline-extracted-65">{description}</div>
      {uploadPlan.summary && (
        <div className="inline-extracted-66">
          Manifest: {uploadPlan.summary.manifestFound ? "found" : "missing"} · Prefix:{" "}
          {uploadPlan.summary.basePrefix || "(root)"}
        </div>
      )}
      {uploadPlan.summary?.repairs && (
        <div className="inline-extracted-67">
          Repairs: {uploadPlan.summary.repairs.updated} updated,{" "}
          {uploadPlan.summary.repairs.skipped} skipped,{" "}
          {uploadPlan.summary.repairs.failed} failed.
        </div>
      )}
      {uploadPlan.summary?.manifestRepairs && (
        <div className="inline-extracted-68">
          Manifest repairs: {uploadPlan.summary.manifestRepairs.updated} updated,{" "}
          {uploadPlan.summary.manifestRepairs.skipped} skipped,{" "}
          {uploadPlan.summary.manifestRepairs.failed} failed.
        </div>
      )}
      {uploadPlan.error && <div className="inline-extracted-69">{uploadPlan.error}</div>}
      {uploadPlan.json && (
        <textarea readOnly value={uploadPlan.json} className="inline-extracted-70" />
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
  onExportSnapshot,
  onImportSnapshot,
}: AwsSyncModalProps) {
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
      <div className="modal modal-simple inline-extracted-2">
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
