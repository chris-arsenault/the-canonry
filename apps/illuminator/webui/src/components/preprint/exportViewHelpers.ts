/**
 * Pure helpers for ExportView — S3 config parsing, download triggers.
 * Extracted to keep ExportView.tsx under the line-count limit.
 */

import type { S3ExportConfig } from "../../lib/preprint/prePrintTypes";

// ── S3 localStorage config ───────────────────────────────────────────

/** Shape of the AWS config stored in localStorage by Canonry */
interface StoredAwsConfig {
  imageBucket?: string;
  imagePrefix?: string;
  rawPrefix?: string;
  region?: string;
}

function isStoredAwsConfig(value: unknown): value is StoredAwsConfig {
  return typeof value === "object" && value !== null;
}

/** Read S3 export config from Canonry's localStorage entry. Returns null if absent or invalid. */
export function readS3ExportInfo(): S3ExportConfig | null {
  try {
    const raw = localStorage.getItem("canonry.aws.config");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredAwsConfig(parsed) || !parsed.imageBucket) return null;
    return {
      bucket: parsed.imageBucket,
      basePrefix: parsed.imagePrefix ?? "",
      rawPrefix: parsed.rawPrefix ?? "raw",
      region: parsed.region ?? "us-east-1",
    };
  } catch {
    return null;
  }
}

// ── Download trigger ─────────────────────────────────────────────────

/** Trigger a browser download of a Blob with the given filename */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Font preset check ────────────────────────────────────────────────

/** Type-safe check whether a font family string is one of the built-in presets */
export function isFontPreset(
  fontFamily: string,
  presets: readonly string[]
): boolean {
  return presets.includes(fontFamily);
}

// ── Error extraction ─────────────────────────────────────────────────

/** Safely extract a message string from an unknown caught value */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Export failed";
}
