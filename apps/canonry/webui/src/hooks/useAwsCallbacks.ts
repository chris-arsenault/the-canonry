/**
 * useAwsCallbacks - AWS/Cognito action callbacks for the Canonry shell.
 *
 * Each callback body is a standalone function that reads store state via
 * getState() at call time, keeping the hook itself under line-count limits.
 */

import { useCallback, useMemo, type RefObject } from "react";
import { useCanonryAwsStore } from "../stores/useCanonryAwsStore";
import { signInWithUserPool, signOutUserPool, sessionToTokens } from "../aws/cognitoUserAuth";
import {
  createS3Client,
  syncProjectImagesToS3,
  getS3ImageUploadPlan,
  listS3Prefixes,
  buildAndUploadCatalog,
} from "../aws/awsS3";
import type { S3Client } from "../aws/awsS3";
import { exportIndexedDbToS3, importIndexedDbFromS3 } from "../aws/indexedDbSnapshot";
import { pullImagesFromS3 } from "../aws/s3ImagePull";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProjectId(ref: RefObject<Record<string, unknown> | null>): string | undefined {
  return ref.current?.id as string | undefined;
}

function errorDetail(err: unknown, fallback: string): string {
  return (err as Error).message || fallback;
}

// ---------------------------------------------------------------------------
// Standalone callback implementations
// ---------------------------------------------------------------------------

async function doLogin(): Promise<void> {
  const { username, password, config, setStatus, setTokens, setUserLabel, setPassword } =
    useCanonryAwsStore.getState();
  if (!username || !password) {
    alert("Enter username and password.");
    return;
  }
  try {
    setStatus({ state: "working", detail: "Signing in..." });
    const session = await signInWithUserPool({ username, password, config });
    const nextTokens = sessionToTokens(session);
    if (nextTokens) setTokens(nextTokens);
    setUserLabel(username);
    setPassword("");
    setStatus({ state: "idle", detail: "Signed in." });
  } catch (err) {
    console.error("Failed to sign in:", err);
    setStatus({ state: "error", detail: errorDetail(err, "Sign in failed.") });
  }
}

function doLogout(): void {
  const { config, setTokens, setUserLabel, setStatus } = useCanonryAwsStore.getState();
  signOutUserPool(config);
  setTokens(null);
  setUserLabel("");
  setStatus({ state: "idle", detail: "Signed out." });
}

async function doBrowsePrefixes(s3Client: S3Client | null): Promise<void> {
  const { config, setBrowseState } = useCanonryAwsStore.getState();
  if (!s3Client || !config?.imageBucket) {
    setBrowseState({ loading: false, prefixes: [], error: "Missing S3 client or bucket." });
    return;
  }
  try {
    setBrowseState({ loading: true, prefixes: [], error: null });
    const prefixes = await listS3Prefixes(s3Client, {
      bucket: config.imageBucket, prefix: config.imagePrefix || "",
    });
    setBrowseState({ loading: false, prefixes, error: null });
  } catch (err) {
    setBrowseState({ loading: false, prefixes: [], error: errorDetail(err, "Failed to list prefixes.") });
  }
}

async function doTestSetup(s3Client: S3Client | null): Promise<void> {
  const { config, setStatus, setSyncProgress } = useCanonryAwsStore.getState();
  if (!s3Client) {
    setStatus({ state: "error", detail: "Missing AWS credentials." });
    return;
  }
  if (!config?.imageBucket) {
    setStatus({ state: "error", detail: "Missing image bucket." });
    return;
  }
  try {
    setStatus({ state: "working", detail: "Testing S3 access..." });
    setSyncProgress({ phase: "test", processed: 0, total: 0, uploaded: 0 });
    const prefixes = await listS3Prefixes(s3Client, {
      bucket: config.imageBucket, prefix: config.imagePrefix || "",
    });
    const prefixLabel = prefixes.length ? `Found ${prefixes.length} prefixes.` : "Access OK.";
    setStatus({ state: "idle", detail: `Test passed. ${prefixLabel}` });
  } catch (err) {
    console.error("Failed to test S3 setup:", err);
    setStatus({ state: "error", detail: errorDetail(err, "S3 test failed.") });
  }
}

async function doSyncImages(
  s3Client: S3Client | null,
  projectRef: RefObject<Record<string, unknown> | null>,
): Promise<void> {
  const projectId = getProjectId(projectRef);
  if (!projectId) return;
  if (!s3Client) {
    alert("Missing S3 client. Check Cognito configuration and login.");
    return;
  }
  const { config, setStatus, setSyncProgress } = useCanonryAwsStore.getState();
  setStatus({ state: "working", detail: "Scanning local images..." });
  setSyncProgress({ phase: "scan", processed: 0, total: 0, uploaded: 0 });
  try {
    const result = await syncProjectImagesToS3({
      projectId, s3: s3Client, config,
      onProgress: ({ phase, processed, total, uploaded }: { phase: string; processed: number; total: number; uploaded: number }) => {
        const labels: Record<string, string> = {
          scan: "Checking",
          upload: "Uploading",
          variants: "Generating WebP variants",
        };
        const label = labels[phase] || phase;
        if (phase === "scan") {
          setStatus({ state: "working", detail: `${label} ${processed}/${total}...` });
        } else if (phase === "variants") {
          setStatus({ state: "working", detail: `${label} ${processed}/${total}...` });
        } else {
          setStatus({ state: "working", detail: `${label} ${processed}/${total} (${uploaded} new)...` });
        }
        setSyncProgress({ phase, processed, total, uploaded });
      },
    });

    const syncSummary = `${result.uploaded} uploaded, ${result.total - result.uploaded} skipped` +
      (result.variantsCatchup ? `, ${result.variantsCatchup} variants generated` : "");

    // Build and upload catalog.json
    setStatus({ state: "working", detail: `Sync done (${syncSummary}). Building catalog.json...` });
    try {
      const cdnBaseUrl = config?.cdnBaseUrl?.trim() || "";
      const catalogResult = await buildAndUploadCatalog(s3Client, config, projectId, cdnBaseUrl);
      setStatus({ state: "idle", detail: `Complete: ${syncSummary}. Catalog: ${catalogResult.entries} images → s3://${config?.imageBucket}/${catalogResult.key}` });
    } catch (catalogErr) {
      console.error("Catalog upload failed:", catalogErr);
      const detail = catalogErr instanceof Error ? catalogErr.message : String(catalogErr);
      setStatus({ state: "error", detail: `Sync OK (${syncSummary}) but catalog upload FAILED: ${detail}` });
    }
  } catch (err) {
    console.error("Failed to sync images:", err);
    setStatus({ state: "error", detail: errorDetail(err, "Image sync failed.") });
  } finally {
    setSyncProgress({ phase: "idle", processed: 0, total: 0, uploaded: 0 });
  }
}

async function doExportSnapshot(s3Client: S3Client | null): Promise<void> {
  if (!s3Client) return;
  const { config, setSnapshotStatus } = useCanonryAwsStore.getState();
  setSnapshotStatus({ state: "working", detail: "Starting export..." });
  try {
    const result = await exportIndexedDbToS3(s3Client, config, ({ detail }: { detail: string }) => {
      setSnapshotStatus({ state: "working", detail });
    });
    setSnapshotStatus({
      state: "idle",
      detail: `Exported ${result.dbCount} databases, ${result.storeCount} stores (${result.sizeMb} MB) to s3://${config.imageBucket}/${result.key}`,
    });
  } catch (err) {
    console.error("Snapshot export failed:", err);
    setSnapshotStatus({ state: "error", detail: errorDetail(err, "Export failed.") });
  }
}

async function doImportSnapshot(s3Client: S3Client | null): Promise<void> {
  if (!s3Client) return;
  const confirmed = window.confirm(
    'This will REPLACE all local data (projects, runs, entities, chronicles, costs, etc.) with the snapshot from S3.\n\nImages are not included \u2014 use "Sync Images to S3" separately.\n\nThe page will reload after import. Continue?',
  );
  if (!confirmed) return;
  const { config, setSnapshotStatus } = useCanonryAwsStore.getState();
  setSnapshotStatus({ state: "working", detail: "Starting import..." });
  try {
    const result = await importIndexedDbFromS3(s3Client, config, ({ detail }: { detail: string }) => {
      setSnapshotStatus({ state: "working", detail });
    });
    const warnSuffix = result.warnings.length
      ? ` (${result.warnings.length} warnings \u2014 check console)`
      : "";
    setSnapshotStatus({
      state: "idle",
      detail: `Restored ${result.dbCount} databases, ${result.storeCount} stores, ${result.recordCount} records (snapshot from ${result.exportedAt})${warnSuffix}. Reloading...`,
    });
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    console.error("Snapshot import failed:", err);
    setSnapshotStatus({ state: "error", detail: errorDetail(err, "Import failed.") });
  }
}

async function doPullImages(
  s3Client: S3Client | null,
  projectRef: RefObject<Record<string, unknown> | null>,
): Promise<void> {
  if (!s3Client) {
    alert("Missing S3 client. Check Cognito configuration and login.");
    return;
  }
  const projectId = getProjectId(projectRef);
  const { config, setStatus, setSyncProgress } = useCanonryAwsStore.getState();
  setStatus({ state: "working", detail: "Pulling images from S3..." });
  setSyncProgress({ phase: "scan", processed: 0, total: 0, uploaded: 0 });
  try {
    const result = await pullImagesFromS3({
      s3: s3Client, config,
      projectId: projectId || null,
      onProgress: ({ detail }: { detail: string }) => {
        setStatus({ state: "working", detail });
      },
    });
    const parts = [`${result.downloaded} downloaded`, `${result.skipped} already local`];
    if (result.errors) parts.push(`${result.errors} errors`);
    setStatus({ state: "idle", detail: `Image pull complete: ${parts.join(", ")}.` });
  } catch (err) {
    console.error("Image pull failed:", err);
    setStatus({ state: "error", detail: errorDetail(err, "Image pull failed.") });
  }
  setSyncProgress({ phase: "idle", processed: 0, total: 0, uploaded: 0 });
}

async function doPreviewUploads(
  s3Client: S3Client | null,
  projectRef: RefObject<Record<string, unknown> | null>,
): Promise<void> {
  const projectId = getProjectId(projectRef);
  if (!projectId) return;
  const { config, setUploadPlan, setStatus } = useCanonryAwsStore.getState();
  if (!s3Client) {
    setUploadPlan({ loading: false, error: "Missing S3 client.", summary: null, json: "" });
    return;
  }
  if (!config?.imageBucket) {
    setUploadPlan({ loading: false, error: "Missing image bucket.", summary: null, json: "" });
    return;
  }
  setUploadPlan({ loading: true, error: null, summary: null, json: "" });
  try {
    const plan = await getS3ImageUploadPlan({
      projectId, s3: s3Client, config, repairSizes: true,
    });
    const summary = {
      total: plan.total, uploadCount: plan.candidates.length,
      manifestFound: plan.manifestFound, basePrefix: plan.basePrefix,
      repairs: plan.repairs, manifestRepairs: plan.manifestRepairs,
    };
    setUploadPlan({
      loading: false, error: null, summary,
      json: JSON.stringify({ summary, images: plan.candidates }, null, 2),
    });
    setStatus({ state: "idle", detail: `Upload plan ready: ${summary.uploadCount}/${summary.total} images.` });
  } catch (err) {
    console.error("Failed to build upload plan:", err);
    const msg = errorDetail(err, "Failed to build upload plan.");
    setUploadPlan({ loading: false, error: msg, summary: null, json: "" });
    setStatus({ state: "error", detail: msg });
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseAwsCallbacksParams {
  currentProjectRef: RefObject<Record<string, unknown> | null>;
}

export function useAwsCallbacks({ currentProjectRef }: UseAwsCallbacksParams) {
  const awsConfig = useCanonryAwsStore((s) => s.config);
  const awsTokens = useCanonryAwsStore((s) => s.tokens);

  const s3Client = useMemo(
    () => createS3Client(awsConfig, awsTokens),
    [awsConfig, awsTokens],
  );

  const handleAwsLogin = useCallback(() => doLogin(), []);
  const handleAwsLogout = useCallback(() => doLogout(), []);
  const handleAwsBrowsePrefixes = useCallback(() => doBrowsePrefixes(s3Client), [s3Client]);
  const handleAwsTestSetup = useCallback(() => doTestSetup(s3Client), [s3Client]);
  const handleAwsSyncImages = useCallback(() => doSyncImages(s3Client, currentProjectRef), [s3Client, currentProjectRef]);
  const handleExportSnapshot = useCallback(() => doExportSnapshot(s3Client), [s3Client]);
  const handleImportSnapshot = useCallback(() => doImportSnapshot(s3Client), [s3Client]);
  const handlePullImages = useCallback(() => doPullImages(s3Client, currentProjectRef), [s3Client, currentProjectRef]);
  const handleAwsPreviewUploads = useCallback(() => doPreviewUploads(s3Client, currentProjectRef), [s3Client, currentProjectRef]);

  return {
    s3Client,
    handleAwsLogin,
    handleAwsLogout,
    handleAwsBrowsePrefixes,
    handleAwsTestSetup,
    handleAwsSyncImages,
    handleExportSnapshot,
    handleImportSnapshot,
    handlePullImages,
    handleAwsPreviewUploads,
  };
}
