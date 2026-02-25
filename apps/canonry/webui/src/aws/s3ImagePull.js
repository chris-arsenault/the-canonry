/**
 * S3 Image Pull — download images FROM S3 into local IndexedDB.
 *
 * READ-ONLY WITH RESPECT TO S3.
 * This module MUST NOT write to, delete from, or modify any S3 object.
 * Only GetObjectCommand is imported. No Put/Delete commands exist here.
 * The manifest is read but never written back.
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { loadImageManifest } from "./awsS3";
import { openIlluminatorDb } from "../lib/illuminatorDbReader";

async function readBodyAsBlob(body, mimeType) {
  if (typeof body.arrayBuffer === "function") {
    const buffer = await body.arrayBuffer();
    return new Blob([buffer], { type: mimeType || "application/octet-stream" });
  }
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    return new Blob(chunks, { type: mimeType || "application/octet-stream" });
  }
  throw new Error("Cannot read S3 body as binary");
}

function getLocalBlobIds(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("imageBlobs", "readonly");
    const request = tx.objectStore("imageBlobs").getAllKeys();
    request.onsuccess = () => resolve(new Set(request.result || []));
    request.onerror = () => reject(request.error);
  });
}

function getLocalImageIds(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readonly");
    const request = tx.objectStore("images").getAllKeys();
    request.onsuccess = () => resolve(new Set(request.result || []));
    request.onerror = () => reject(request.error);
  });
}

function writeImageToDb(db, imageId, blob, metadataRecord) {
  return new Promise((resolve, reject) => {
    const storeNames = metadataRecord ? ["imageBlobs", "images"] : ["imageBlobs"];
    const tx = db.transaction(storeNames, "readwrite");
    tx.objectStore("imageBlobs").put({ imageId, blob });
    if (metadataRecord) {
      tx.objectStore("images").put(metadataRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function manifestEntryToMetadata(entry) {
  return {
    imageId: entry.imageId,
    projectId: entry.projectId || null,
    entityId: entry.entityId || null,
    entityName: entry.entityName || null,
    entityKind: entry.entityKind || null,
    imageType: entry.imageType || "entity",
    chronicleId: entry.chronicleId || null,
    imageRefId: entry.imageRefId || null,
    mimeType: entry.mimeType || "application/octet-stream",
    size: entry.size || null,
    model: entry.model || null,
    generatedAt: entry.generatedAt || Date.now(),
    savedAt: Date.now(),
  };
}

export async function pullImagesFromS3({ s3, config, projectId, onProgress }) {
  if (!s3) throw new Error("Missing S3 client");
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket");
  const basePrefix = config?.imagePrefix?.trim() || "";

  const report = (detail) => {
    console.log(`[s3-pull] ${detail}`);
    onProgress?.({ detail });
  };

  // 1. Load manifest (read-only — never written back)
  report("Loading image manifest from S3...");
  const manifest = await loadImageManifest(s3, { bucket, basePrefix });
  if (!manifest || !manifest.images) {
    throw new Error('No image manifest found in S3. Push images first with "Sync Images to S3".');
  }

  const allEntries = Object.values(manifest.images);
  // Filter to requested project if provided
  const entries = projectId ? allEntries.filter((e) => e.projectId === projectId) : allEntries;

  report(
    `Manifest has ${entries.length} images${projectId ? ` for project ${projectId}` : " (all projects)"}. Checking local state...`
  );

  // 2. Check what exists locally
  const db = await openIlluminatorDb();
  let localBlobIds;
  let localImageIds;
  try {
    localBlobIds = await getLocalBlobIds(db);
    localImageIds = await getLocalImageIds(db);
  } catch (err) {
    db.close();
    throw err;
  }

  // 3. Compute what needs downloading
  const missing = entries.filter((e) => !localBlobIds.has(e.imageId));
  const total = entries.length;
  const skippedCount = total - missing.length;

  report(`${missing.length} to download, ${skippedCount} already local`);

  if (missing.length === 0) {
    db.close();
    return { total, downloaded: 0, skipped: skippedCount, errors: 0 };
  }

  // 4. Download incrementally
  let downloaded = 0;
  let errors = 0;
  const logInterval = Math.max(1, Math.floor(missing.length / 5));

  for (let i = 0; i < missing.length; i++) {
    const entry = missing[i];

    if (i % logInterval === 0) {
      report(`Downloading ${i + 1}/${missing.length}...`);
    }

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: entry.rawKey,
        })
      );

      const blob = await readBodyAsBlob(response.Body, entry.mimeType);

      // Write blob, and metadata if missing locally
      const needsMetadata = !localImageIds.has(entry.imageId);
      const metadata = needsMetadata ? manifestEntryToMetadata(entry) : null;

      await writeImageToDb(db, entry.imageId, blob, metadata);
      downloaded++;
    } catch (err) {
      errors++;
      console.error(
        `[s3-pull] Failed to download "${entry.imageId}" (key=${entry.rawKey}):`,
        err.message
      );
    }
  }

  db.close();

  const summary = `Done: ${downloaded} downloaded, ${skippedCount} already local, ${errors} errors`;
  report(summary);

  return { total, downloaded, skipped: skippedCount, errors };
}
