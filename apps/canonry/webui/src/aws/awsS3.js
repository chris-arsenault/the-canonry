import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { getImageBlob, getImagesByProject } from '../lib/imageExportHelpers';

const DEFAULT_RAW_PREFIX = 'raw';
const DEFAULT_WEBP_PREFIX = 'webp';
const DEFAULT_THUMB_PREFIX = 'thumb';
const MANIFEST_NAME = 'image-manifest.json';

function toS3Key(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function buildImageStorageConfig(config, projectId) {
  if (!config?.imageBucket) return null;
  const basePrefix = config?.imagePrefix?.trim() || '';
  return {
    provider: 's3',
    bucket: config.imageBucket.trim(),
    region: config.region?.trim() || 'us-east-1',
    basePrefix,
    rawPrefix: DEFAULT_RAW_PREFIX,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    projectId,
  };
}

export function createS3Client(config, tokens) {
  if (!config?.identityPoolId || !config?.region) return null;
  const region = config.region.trim();
  const identityPoolId = config.identityPoolId.trim();
  const logins = {};
  const userPoolId = config.cognitoUserPoolId?.trim();
  if (tokens?.idToken && userPoolId) {
    const loginKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    logins[loginKey] = tokens.idToken;
  }

  return new S3Client({
    region,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region },
      identityPoolId,
      logins: Object.keys(logins).length ? logins : undefined,
    }),
  });
}

async function readBodyAsText(body) {
  if (!body) return null;
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }
  if (typeof body.text === 'function') {
    return body.text();
  }
  if (typeof body.arrayBuffer === 'function') {
    const buffer = await body.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  if (typeof body.getReader === 'function' && typeof Response !== 'undefined') {
    return new Response(body).text();
  }
  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const buffer = chunks.length === 1 ? chunks[0] : new Blob(chunks);
    if (buffer?.arrayBuffer) {
      const ab = await buffer.arrayBuffer();
      return new TextDecoder().decode(ab);
    }
  }
  return null;
}

export async function loadImageManifest(s3, { bucket, basePrefix }) {
  if (!s3 || !bucket) return null;
  const key = toS3Key(basePrefix, MANIFEST_NAME);
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await readBodyAsText(response.Body);
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.warn('Failed to load image manifest:', err);
    return null;
  }
}

export async function saveImageManifest(s3, { bucket, basePrefix }, manifest) {
  if (!s3 || !bucket) return;
  const key = toS3Key(basePrefix, MANIFEST_NAME);
  const body = JSON.stringify(manifest, null, 2);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'no-store, must-revalidate',
  }));
}

function safeTagValue(value, maxLen = 256) {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function buildTagging(metadata) {
  const tags = [
    ['imageId', metadata.imageId],
    ['projectId', metadata.projectId],
    ['entityId', metadata.entityId],
    ['entityKind', metadata.entityKind],
    ['imageType', metadata.imageType],
    ['chronicleId', metadata.chronicleId],
    ['imageRefId', metadata.imageRefId],
    ['generatedAt', metadata.generatedAt],
    ['savedAt', metadata.savedAt],
  ]
    .map(([key, value]) => [key, safeTagValue(value)])
    .filter(([, value]) => value != null && value !== '');

  if (!tags.length) return undefined;
  return tags.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export async function listS3Prefixes(s3, { bucket, prefix }) {
  if (!s3 || !bucket) return [];
  const response = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix || undefined,
    Delimiter: '/',
    MaxKeys: 200,
  }));
  return (response.CommonPrefixes || []).map((item) => item.Prefix).filter(Boolean);
}

export async function syncProjectImagesToS3({
  projectId,
  s3,
  config,
  onProgress,
}) {
  if (!projectId) throw new Error('Missing projectId for image sync');
  if (!s3) throw new Error('Missing S3 client');
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error('Missing image bucket');

  const basePrefix = config?.imagePrefix?.trim() || '';
  const rawPrefix = DEFAULT_RAW_PREFIX;
  const manifest = (await loadImageManifest(s3, { bucket, basePrefix })) || {
    version: 1,
    generatedAt: new Date().toISOString(),
    bucket,
    basePrefix,
    rawPrefix,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    images: {},
  };

  const existing = manifest.images || {};
  const images = await getImagesByProject(projectId);
  let processed = 0;
  let uploaded = 0;
  const total = images.length;

  for (const image of images) {
    if (!image?.imageId) continue;
    processed += 1;
    if (onProgress) {
      onProgress({ phase: 'scan', processed, total, uploaded });
    }

    const updatedAt = image.savedAt || image.generatedAt || 0;
    const entry = existing[image.imageId];
    if (entry && entry.updatedAt >= updatedAt && entry.size === image.size) {
      continue;
    }

    const blob = await getImageBlob(image.imageId);
    if (!blob) continue;
    const buffer = await blob.arrayBuffer();
    const body = new Uint8Array(buffer);
    const contentLength = body.byteLength;

    const rawKey = toS3Key(basePrefix, rawPrefix, projectId, image.imageId);
    const tagging = buildTagging({ ...image, projectId, savedAt: updatedAt });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: rawKey,
      Body: body,
      ContentType: image.mimeType || blob.type || 'application/octet-stream',
      ContentLength: contentLength,
      Tagging: tagging,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    existing[image.imageId] = {
      imageId: image.imageId,
      projectId,
      rawKey,
      mimeType: image.mimeType || blob.type || 'application/octet-stream',
      size: image.size || contentLength || null,
      updatedAt,
      entityId: image.entityId || null,
      entityKind: image.entityKind || null,
      entityName: image.entityName || null,
      imageType: image.imageType || 'entity',
      chronicleId: image.chronicleId || null,
      imageRefId: image.imageRefId || null,
      generatedAt: image.generatedAt || null,
      model: image.model || null,
    };

    uploaded += 1;
    if (onProgress) {
      onProgress({ phase: 'upload', processed, total, uploaded });
    }
  }

  manifest.images = existing;
  manifest.generatedAt = new Date().toISOString();
  manifest.count = Object.keys(existing).length;
  await saveImageManifest(s3, { bucket, basePrefix }, manifest);

  return { total, uploaded, manifest };
}

export function buildStorageImageUrl(storage, variant, imageId) {
  if (!storage || !imageId) return null;
  const basePrefix = storage.basePrefix || '';
  const projectId = storage.projectId || '';
  const prefix = variant === 'raw'
    ? storage.rawPrefix
    : variant === 'thumb'
      ? storage.thumbPrefix
      : storage.webpPrefix;
  const filename = variant === 'raw' ? imageId : `${imageId}.webp`;
  const path = toS3Key(basePrefix, prefix, projectId, filename);
  return `/${path}`;
}
