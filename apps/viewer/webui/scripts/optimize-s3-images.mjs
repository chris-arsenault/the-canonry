import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const DEFAULT_MANIFEST_KEY = 'image-manifest.json';
const THUMBNAIL_WIDTH = 400;
const FULL_QUALITY = 85;
const THUMBNAIL_QUALITY = 80;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function toS3Key(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function loadManifest(s3, bucket, manifestKey) {
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manifestKey }));
    const buffer = await streamToBuffer(response.Body);
    return JSON.parse(buffer.toString('utf8'));
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const bucket = args.get('bucket');
  const manifestKey = args.get('manifest-key') || DEFAULT_MANIFEST_KEY;
  const region = args.get('region') || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!bucket) {
    console.error('Missing --bucket');
    process.exit(1);
  }
  if (!region) {
    console.error('Missing region. Provide --region or set AWS_REGION.');
    process.exit(1);
  }

  const s3 = new S3Client({ region });
  const manifest = await loadManifest(s3, bucket, manifestKey);
  if (!manifest?.images) {
    console.log('No manifest or empty manifest; skipping image optimization.');
    return;
  }

  const images = manifest.images;
  const now = new Date().toISOString();
  let processed = 0;
  let optimized = 0;

  for (const imageId of Object.keys(images)) {
    const entry = images[imageId];
    processed += 1;
    const sourceUpdatedAt = entry.updatedAt || 0;
    const optimizedInfo = entry.optimized || {};
    if (optimizedInfo.sourceUpdatedAt && optimizedInfo.sourceUpdatedAt >= sourceUpdatedAt) {
      continue;
    }

    const rawKey = entry.rawKey || entry.key;
    if (!rawKey) continue;

    const projectId = entry.projectId || 'project';
    const basePrefix = manifest.basePrefix || '';
    const webpKey = optimizedInfo.fullKey || toS3Key(basePrefix, manifest.webpPrefix || 'webp', projectId, `${imageId}.webp`);
    const thumbKey = optimizedInfo.thumbKey || toS3Key(basePrefix, manifest.thumbPrefix || 'thumb', projectId, `${imageId}.webp`);

    const rawObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: rawKey }));
    const rawBuffer = await streamToBuffer(rawObject.Body);
    const image = sharp(rawBuffer);

    const thumbBuffer = await image
      .clone()
      .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    const fullBuffer = await image
      .clone()
      .webp({ quality: FULL_QUALITY })
      .toBuffer();

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: webpKey,
      Body: fullBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    entry.optimized = {
      fullKey: webpKey,
      thumbKey,
      optimizedAt: now,
      sourceUpdatedAt,
    };
    optimized += 1;

    if (optimized % 10 === 0) {
      console.log(`Optimized ${optimized} images so far...`);
    }
  }

  manifest.optimizedAt = now;
  manifest.optimizedCount = optimized;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: manifestKey,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json',
    CacheControl: 'no-store, must-revalidate',
  }));

  console.log(`Optimized ${optimized} of ${processed} images.`);
}

main().catch((err) => {
  console.error('Failed to optimize S3 images:', err);
  process.exitCode = 1;
});
