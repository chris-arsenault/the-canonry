/**
 * useAwsCallbacks - AWS/Cognito action callbacks for the Canonry shell.
 *
 * Extracted from App.jsx to keep the main component under complexity limits.
 */

import { useCallback, useMemo, type MutableRefObject } from "react";
import { useCanonryAwsStore } from "../stores/useCanonryAwsStore";
import { signInWithUserPool, signOutUserPool, sessionToTokens } from "../aws/cognitoUserAuth";
import {
  createS3Client,
  syncProjectImagesToS3,
  getS3ImageUploadPlan,
  listS3Prefixes,
} from "../aws/awsS3";
import { exportIndexedDbToS3, importIndexedDbFromS3 } from "../aws/indexedDbSnapshot";
import { pullImagesFromS3 } from "../aws/s3ImagePull";

interface UseAwsCallbacksParams {
  currentProjectRef: MutableRefObject<Record<string, unknown> | null>;
}

export function useAwsCallbacks({ currentProjectRef }: UseAwsCallbacksParams) {
  const awsConfig = useCanonryAwsStore((s) => s.config);
  const awsTokens = useCanonryAwsStore((s) => s.tokens);
  const awsUsername = useCanonryAwsStore((s) => s.username);
  const awsPassword = useCanonryAwsStore((s) => s.password);
  const setAwsTokens = useCanonryAwsStore((s) => s.setTokens);
  const setAwsStatus = useCanonryAwsStore((s) => s.setStatus);
  const setAwsBrowseState = useCanonryAwsStore((s) => s.setBrowseState);
  const setAwsUserLabel = useCanonryAwsStore((s) => s.setUserLabel);
  const setAwsPassword = useCanonryAwsStore((s) => s.setPassword);
  const setAwsSyncProgress = useCanonryAwsStore((s) => s.setSyncProgress);
  const setAwsUploadPlan = useCanonryAwsStore((s) => s.setUploadPlan);
  const setSnapshotStatus = useCanonryAwsStore((s) => s.setSnapshotStatus);

  const s3Client = useMemo(
    () => createS3Client(awsConfig, awsTokens),
    [awsConfig, awsTokens],
  );

  const handleAwsLogin = useCallback(async () => {
    if (!awsUsername || !awsPassword) {
      alert("Enter username and password.");
      return;
    }
    try {
      setAwsStatus({ state: "working", detail: "Signing in..." });
      const session = await signInWithUserPool({
        username: awsUsername, password: awsPassword, config: awsConfig,
      });
      const nextTokens = sessionToTokens(session);
      if (nextTokens) setAwsTokens(nextTokens);
      setAwsUserLabel(awsUsername);
      setAwsPassword("");
      setAwsStatus({ state: "idle", detail: "Signed in." });
    } catch (err) {
      console.error("Failed to sign in:", err);
      setAwsStatus({ state: "error", detail: (err as Error).message || "Sign in failed." });
    }
  }, [awsUsername, awsPassword, awsConfig, setAwsStatus, setAwsTokens, setAwsUserLabel, setAwsPassword]);

  const handleAwsLogout = useCallback(() => {
    signOutUserPool(awsConfig);
    setAwsTokens(null);
    setAwsUserLabel("");
    setAwsStatus({ state: "idle", detail: "Signed out." });
  }, [awsConfig, setAwsTokens, setAwsUserLabel, setAwsStatus]);

  const handleAwsBrowsePrefixes = useCallback(async () => {
    if (!s3Client || !awsConfig?.imageBucket) {
      setAwsBrowseState({ loading: false, prefixes: [], error: "Missing S3 client or bucket." });
      return;
    }
    try {
      setAwsBrowseState({ loading: true, prefixes: [], error: null });
      const prefixes = await listS3Prefixes(s3Client, {
        bucket: awsConfig.imageBucket, prefix: awsConfig.imagePrefix || "",
      });
      setAwsBrowseState({ loading: false, prefixes, error: null });
    } catch (err) {
      setAwsBrowseState({ loading: false, prefixes: [], error: (err as Error).message || "Failed to list prefixes." });
    }
  }, [s3Client, awsConfig, setAwsBrowseState]);

  const handleAwsTestSetup = useCallback(async () => {
    if (!s3Client) {
      setAwsStatus({ state: "error", detail: "Missing AWS credentials." });
      return;
    }
    if (!awsConfig?.imageBucket) {
      setAwsStatus({ state: "error", detail: "Missing image bucket." });
      return;
    }
    try {
      setAwsStatus({ state: "working", detail: "Testing S3 access..." });
      setAwsSyncProgress({ phase: "test", processed: 0, total: 0, uploaded: 0 });
      const prefixes = await listS3Prefixes(s3Client, {
        bucket: awsConfig.imageBucket, prefix: awsConfig.imagePrefix || "",
      });
      const prefixLabel = prefixes.length ? `Found ${prefixes.length} prefixes.` : "Access OK.";
      setAwsStatus({ state: "idle", detail: `Test passed. ${prefixLabel}` });
    } catch (err) {
      console.error("Failed to test S3 setup:", err);
      setAwsStatus({ state: "error", detail: (err as Error).message || "S3 test failed." });
    }
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress]);

  const handleAwsSyncImages = useCallback(async () => {
    const projectId = currentProjectRef.current?.id as string | undefined;
    if (!projectId) return;
    if (!s3Client) {
      alert("Missing S3 client. Check Cognito configuration and login.");
      return;
    }
    setAwsStatus({ state: "working", detail: "Syncing images to S3..." });
    setAwsSyncProgress({ phase: "scan", processed: 0, total: 0, uploaded: 0 });
    try {
      await syncProjectImagesToS3({
        projectId, s3: s3Client, config: awsConfig,
        onProgress: ({ phase, processed, total, uploaded }: { phase: string; processed: number; total: number; uploaded: number }) => {
          const label = phase === "upload" ? "Uploading" : "Scanning";
          setAwsStatus({ state: "working", detail: `${label} images ${processed}/${total} (uploaded ${uploaded})...` });
          setAwsSyncProgress({ phase, processed, total, uploaded });
        },
      });
      setAwsStatus({ state: "idle", detail: "Image sync complete." });
    } catch (err) {
      console.error("Failed to sync images:", err);
      setAwsStatus({ state: "error", detail: (err as Error).message || "Image sync failed." });
    }
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress, currentProjectRef]);

  const handleExportSnapshot = useCallback(async () => {
    if (!s3Client) return;
    setSnapshotStatus({ state: "working", detail: "Starting export..." });
    try {
      const result = await exportIndexedDbToS3(s3Client, awsConfig, ({ detail }: { detail: string }) => {
        setSnapshotStatus({ state: "working", detail });
      });
      setSnapshotStatus({
        state: "idle",
        detail: `Exported ${result.dbCount} databases, ${result.storeCount} stores (${result.sizeMb} MB) to s3://${awsConfig.imageBucket}/${result.key}`,
      });
    } catch (err) {
      console.error("Snapshot export failed:", err);
      setSnapshotStatus({ state: "error", detail: (err as Error).message || "Export failed." });
    }
  }, [s3Client, awsConfig, setSnapshotStatus]);

  const handleImportSnapshot = useCallback(async () => {
    if (!s3Client) return;
    const confirmed = window.confirm(
      'This will REPLACE all local data (projects, runs, entities, chronicles, costs, etc.) with the snapshot from S3.\n\nImages are not included \u2014 use "Sync Images to S3" separately.\n\nThe page will reload after import. Continue?',
    );
    if (!confirmed) return;
    setSnapshotStatus({ state: "working", detail: "Starting import..." });
    try {
      const result = await importIndexedDbFromS3(s3Client, awsConfig, ({ detail }: { detail: string }) => {
        setSnapshotStatus({ state: "working", detail });
      });
      const warnSuffix = result.warnings?.length
        ? ` (${result.warnings.length} warnings \u2014 check console)`
        : "";
      setSnapshotStatus({
        state: "idle",
        detail: `Restored ${result.dbCount} databases, ${result.storeCount} stores, ${result.recordCount} records (snapshot from ${result.exportedAt})${warnSuffix}. Reloading...`,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Snapshot import failed:", err);
      setSnapshotStatus({ state: "error", detail: (err as Error).message || "Import failed." });
    }
  }, [s3Client, awsConfig, setSnapshotStatus]);

  const handlePullImages = useCallback(async () => {
    const projectId = currentProjectRef.current?.id as string | undefined;
    if (!s3Client) {
      alert("Missing S3 client. Check Cognito configuration and login.");
      return;
    }
    setAwsStatus({ state: "working", detail: "Pulling images from S3..." });
    setAwsSyncProgress({ phase: "scan", processed: 0, total: 0, uploaded: 0 });
    try {
      const result = await pullImagesFromS3({
        s3: s3Client, config: awsConfig,
        projectId: projectId || null,
        onProgress: ({ detail }: { detail: string }) => {
          setAwsStatus({ state: "working", detail });
        },
      });
      const parts = [`${result.downloaded} downloaded`, `${result.skipped} already local`];
      if (result.errors) parts.push(`${result.errors} errors`);
      setAwsStatus({ state: "idle", detail: `Image pull complete: ${parts.join(", ")}.` });
    } catch (err) {
      console.error("Image pull failed:", err);
      setAwsStatus({ state: "error", detail: (err as Error).message || "Image pull failed." });
    }
    setAwsSyncProgress({ phase: "idle", processed: 0, total: 0, uploaded: 0 });
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress, currentProjectRef]);

  const handleAwsPreviewUploads = useCallback(async () => {
    const projectId = currentProjectRef.current?.id as string | undefined;
    if (!projectId) return;
    if (!s3Client) {
      setAwsUploadPlan({ loading: false, error: "Missing S3 client.", summary: null, json: "" });
      return;
    }
    if (!awsConfig?.imageBucket) {
      setAwsUploadPlan({ loading: false, error: "Missing image bucket.", summary: null, json: "" });
      return;
    }
    setAwsUploadPlan({ loading: true, error: null, summary: null, json: "" });
    try {
      const plan = await getS3ImageUploadPlan({
        projectId, s3: s3Client, config: awsConfig, repairSizes: true,
      });
      const summary = {
        total: plan.total, uploadCount: plan.candidates.length,
        manifestFound: plan.manifestFound, basePrefix: plan.basePrefix,
        repairs: plan.repairs, manifestRepairs: plan.manifestRepairs,
      };
      setAwsUploadPlan({
        loading: false, error: null, summary,
        json: JSON.stringify({ summary, images: plan.candidates }, null, 2),
      });
      setAwsStatus({ state: "idle", detail: `Upload plan ready: ${summary.uploadCount}/${summary.total} images.` });
    } catch (err) {
      console.error("Failed to build upload plan:", err);
      const msg = (err as Error).message || "Failed to build upload plan.";
      setAwsUploadPlan({ loading: false, error: msg, summary: null, json: "" });
      setAwsStatus({ state: "error", detail: msg });
    }
  }, [s3Client, awsConfig, setAwsUploadPlan, setAwsStatus, currentProjectRef]);

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
