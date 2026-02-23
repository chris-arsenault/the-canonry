import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const SNAPSHOT_KEY_SUFFIX = 'indexeddb-snapshot.json';
const SKIPPED_STORES = new Set(['imageBlobs']);

function toS3Key(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

async function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Blob) {
    const base64 = await blobToBase64(value);
    return { __blob: true, type: value.type, data: base64 };
  }
  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { __arraybuffer: true, data: btoa(binary) };
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { __typedarray: true, kind: value.constructor.name, data: btoa(binary) };
  }
  if (value instanceof Date) {
    return { __date: true, value: value.toISOString() };
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) {
      result.push(await serializeValue(item));
    }
    return result;
  }
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = await serializeValue(value[key]);
    }
    return result;
  }
  return value;
}

function deserializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value.__blob === true && typeof value.data === 'string') {
    return base64ToBlob(value.data, value.type);
  }
  if (value.__arraybuffer === true && typeof value.data === 'string') {
    const binary = atob(value.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  if (value.__typedarray === true && typeof value.data === 'string') {
    const binary = atob(value.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (value.__date === true && typeof value.value === 'string') {
    return new Date(value.value);
  }
  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }
  const result = {};
  for (const key of Object.keys(value)) {
    result[key] = deserializeValue(value[key]);
  }
  return result;
}

function serializeKey(key) {
  if (key instanceof Date) return { __date: true, value: key.toISOString() };
  if (Array.isArray(key)) return key.map(serializeKey);
  return key;
}

function deserializeKey(key) {
  if (key && typeof key === 'object' && key.__date === true) return new Date(key.value);
  if (Array.isArray(key)) return key.map(deserializeKey);
  return key;
}

function openDbReadOnly(name, version) {
  return new Promise((resolve, reject) => {
    console.log(`[snapshot] Opening "${name}" v${version} for read...`);
    const request = indexedDB.open(name, version);
    request.onsuccess = () => {
      console.log(`[snapshot] Opened "${name}" v${version} OK`);
      resolve(request.result);
    };
    request.onerror = () => {
      console.error(`[snapshot] Failed to open "${name}":`, request.error);
      reject(request.error);
    };
    request.onupgradeneeded = () => {
      console.warn(`[snapshot] "${name}" needs upgrade (wanted v${version}), aborting read`);
      request.transaction.abort();
      reject(new Error(`Database "${name}" needs upgrade, skipping`));
    };
  });
}

function readAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();

    tx.oncomplete = () => {
      resolve({ keys: keysReq.result, values: valsReq.result });
    };
    tx.onerror = () => {
      console.error(`[snapshot]   store "${storeName}" read error:`, tx.error);
      reject(tx.error);
    };
  });
}

function getStoreSchema(db, storeName) {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const schema = {
    keyPath: store.keyPath,
    autoIncrement: store.autoIncrement,
    indexes: [],
  };
  for (const indexName of store.indexNames) {
    const index = store.index(indexName);
    schema.indexes.push({
      name: index.name,
      keyPath: index.keyPath,
      unique: index.unique,
      multiEntry: index.multiEntry,
    });
  }
  tx.abort();
  return schema;
}

// Open a database without triggering a version change.
// If the DB doesn't exist, creates it at the given version with the given stores.
// If it already exists (possibly at a different version), opens at whatever version it has.
function openDbForImport(name, snapshotVersion, storeSchemas) {
  return new Promise((resolve, reject) => {
    // First try: open without specifying version — gets current version if DB exists,
    // or creates at version 1 if new. We'll handle version/store mismatch below.
    console.log(`[snapshot] Probing "${name}" (snapshot has v${snapshotVersion})...`);
    const probe = indexedDB.open(name);

    probe.onsuccess = () => {
      const db = probe.result;
      const currentVersion = db.version;
      const existingStores = Array.from(db.objectStoreNames);
      console.log(`[snapshot] "${name}" exists at v${currentVersion}, stores: [${existingStores.join(', ')}]`);
      db.close();

      // Now reopen at the max of current and snapshot version so we can add missing stores
      const targetVersion = Math.max(currentVersion, snapshotVersion, 1);
      const needsUpgrade = targetVersion > currentVersion;

      if (!needsUpgrade) {
        // Same version — reopen normally, we'll work with existing stores
        console.log(`[snapshot] "${name}" v${currentVersion} — no upgrade needed, reopening...`);
        const reopen = indexedDB.open(name, currentVersion);
        reopen.onsuccess = () => resolve(reopen.result);
        reopen.onerror = () => {
          console.error(`[snapshot] "${name}" reopen failed:`, reopen.error);
          reject(reopen.error);
        };
        reopen.onblocked = () => {
          console.warn(`[snapshot] "${name}" reopen blocked by other connections`);
          // Still resolves when unblocked — the app's versionchange handler may close
        };
        return;
      }

      // Need upgrade to add missing stores
      console.log(`[snapshot] "${name}" upgrading v${currentVersion} → v${targetVersion}...`);
      const upgrade = indexedDB.open(name, targetVersion);

      upgrade.onupgradeneeded = () => {
        const udb = upgrade.result;
        const existing = new Set(udb.objectStoreNames);
        for (const [storeName, schema] of Object.entries(storeSchemas)) {
          if (existing.has(storeName)) {
            console.log(`[snapshot]   store "${storeName}" already exists, keeping`);
            continue;
          }
          console.log(`[snapshot]   creating store "${storeName}" (keyPath=${JSON.stringify(schema.keyPath)})`);
          const storeOpts = {};
          if (schema.keyPath != null) storeOpts.keyPath = schema.keyPath;
          if (schema.autoIncrement) storeOpts.autoIncrement = true;
          const store = udb.createObjectStore(storeName, storeOpts);
          for (const idx of schema.indexes || []) {
            store.createIndex(idx.name, idx.keyPath, {
              unique: idx.unique || false,
              multiEntry: idx.multiEntry || false,
            });
          }
        }
      };

      upgrade.onsuccess = () => {
        console.log(`[snapshot] "${name}" upgrade complete`);
        resolve(upgrade.result);
      };
      upgrade.onerror = () => {
        console.error(`[snapshot] "${name}" upgrade failed:`, upgrade.error);
        reject(upgrade.error);
      };
      upgrade.onblocked = () => {
        console.warn(`[snapshot] "${name}" upgrade BLOCKED — other connections must close first`);
        // The request will complete once other connections handle their versionchange event.
        // If they don't, this hangs. We set a timeout to fail gracefully.
      };
      setTimeout(() => {
        // Safety: if upgrade is still pending after 10s, reject
        if (!upgrade.result) {
          console.error(`[snapshot] "${name}" upgrade timed out (blocked by open connections)`);
          try { upgrade.result?.close(); } catch (_) {}
          reject(new Error(`Database "${name}" upgrade blocked — close other tabs and retry`));
        }
      }, 10000);
    };

    probe.onerror = () => {
      console.error(`[snapshot] "${name}" probe failed:`, probe.error);
      reject(probe.error);
    };

    probe.onupgradeneeded = () => {
      // DB didn't exist — the probe auto-creates at v1 with no stores.
      // We'll close this and reopen at the snapshot version with proper stores.
      console.log(`[snapshot] "${name}" is new (created by probe)`);
    };
  });
}

// Open a brand new database that doesn't exist yet with the full schema
function createFreshDatabase(name, version, storeSchemas) {
  return new Promise((resolve, reject) => {
    console.log(`[snapshot] Creating fresh "${name}" at v${version}...`);
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      const existing = new Set(db.objectStoreNames);
      for (const [storeName, schema] of Object.entries(storeSchemas)) {
        if (existing.has(storeName)) {
          console.log(`[snapshot]   store "${storeName}" already exists, keeping`);
          continue;
        }
        console.log(`[snapshot]   creating store "${storeName}"`);
        const storeOpts = {};
        if (schema.keyPath != null) storeOpts.keyPath = schema.keyPath;
        if (schema.autoIncrement) storeOpts.autoIncrement = true;
        const store = db.createObjectStore(storeName, storeOpts);
        for (const idx of schema.indexes || []) {
          store.createIndex(idx.name, idx.keyPath, {
            unique: idx.unique || false,
            multiEntry: idx.multiEntry || false,
          });
        }
      }
    };

    request.onsuccess = () => {
      console.log(`[snapshot] "${name}" created OK`);
      resolve(request.result);
    };
    request.onerror = () => {
      console.error(`[snapshot] "${name}" create failed:`, request.error);
      reject(request.error);
    };
  });
}

function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => {
      console.log(`[snapshot]   cleared "${storeName}"`);
      resolve();
    };
    tx.onerror = () => {
      console.error(`[snapshot]   clear "${storeName}" failed:`, tx.error);
      reject(tx.error);
    };
  });
}

function writeRecordsToStore(db, storeName, records, hasInlineKey) {
  return new Promise((resolve, reject) => {
    const n = records.length;
    const logInterval = n > 0 ? Math.max(1, Math.floor(n / 5)) : 1;
    console.log(`[snapshot]   writing ${n} records to "${storeName}"...`);
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    let written = 0;
    let errors = 0;
    for (const record of records) {
      const value = deserializeValue(record.value);
      const idx = written;
      const req = hasInlineKey
        ? store.put(value)
        : store.put(value, deserializeKey(record.key));
      req.onsuccess = () => {
        if (idx % logInterval === 0) {
          console.log(`[snapshot]   "${storeName}" ${idx + 1}/${n}`);
        }
      };
      req.onerror = () => {
        errors++;
        console.warn(`[snapshot]   put failed in "${storeName}" at record ${idx}:`, req.error);
        // Don't abort the whole tx for one bad record — skip it
        req.onerror = null;
      };
      written++;
    }
    tx.oncomplete = () => {
      const suffix = errors ? ` (${errors} errors)` : '';
      console.log(`[snapshot]   "${storeName}" done: ${written} records${suffix}`);
      resolve(written);
    };
    tx.onerror = () => {
      console.error(`[snapshot]   transaction error writing "${storeName}":`, tx.error);
      reject(tx.error);
    };
  });
}

// --- Export ---

export async function exportIndexedDbToS3(s3, config, onProgress) {
  if (!s3) throw new Error('Missing S3 client');
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error('Missing image bucket');
  const basePrefix = config?.imagePrefix?.trim() || '';

  const report = (detail) => {
    console.log(`[snapshot/export] ${detail}`);
    onProgress?.({ detail });
  };

  report('Enumerating databases...');
  const dbList = await indexedDB.databases();
  if (!dbList || dbList.length === 0) {
    throw new Error('No IndexedDB databases found');
  }

  const snapshot = {
    format: 'canonry-indexeddb-snapshot',
    version: 1,
    exportedAt: new Date().toISOString(),
    databases: {},
  };

  for (let i = 0; i < dbList.length; i++) {
    const { name, version } = dbList[i];
    if (!name) continue;

    report(`Exporting ${name} v${version} (${i + 1}/${dbList.length})...`);

    let db;
    try {
      db = await openDbReadOnly(name, version);
    } catch (err) {
      console.warn(`[snapshot/export] Skipping database "${name}":`, err.message);
      continue;
    }

    const dbSnapshot = { version, stores: {} };
    const storeNames = Array.from(db.objectStoreNames);

    for (const storeName of storeNames) {
      if (SKIPPED_STORES.has(storeName)) continue;

      const schema = getStoreSchema(db, storeName);
      const { keys, values } = await readAllFromStore(db, storeName);
      const logInterval = keys.length > 0 ? Math.max(1, Math.floor(keys.length / 5)) : 1;

      const records = [];
      for (let j = 0; j < keys.length; j++) {
        records.push({
          key: serializeKey(keys[j]),
          value: await serializeValue(values[j]),
        });
        if (j % logInterval === 0) {
          console.log(`[snapshot/export]   "${storeName}" serialized ${j + 1}/${keys.length}`);
        }
      }

      dbSnapshot.stores[storeName] = {
        ...schema,
        records,
      };
    }

    db.close();
    snapshot.databases[name] = dbSnapshot;
  }

  report('Uploading to S3...');
  const body = JSON.stringify(snapshot);
  const key = toS3Key(basePrefix, SNAPSHOT_KEY_SUFFIX);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'no-store, must-revalidate',
  }));

  const sizeMb = (body.length / (1024 * 1024)).toFixed(1);
  const dbCount = Object.keys(snapshot.databases).length;
  const storeCount = Object.values(snapshot.databases)
    .reduce((sum, db) => sum + Object.keys(db.stores).length, 0);

  console.log(`[snapshot/export] Done: ${dbCount} databases, ${storeCount} stores, ${sizeMb} MB`);

  return {
    size: body.length,
    sizeMb,
    dbCount,
    storeCount,
    key,
  };
}

// --- Import ---

async function readS3BodyAsText(body) {
  if (!body) return null;
  if (typeof body.transformToString === 'function') return body.transformToString();
  if (typeof body.text === 'function') return body.text();
  if (typeof body.arrayBuffer === 'function') {
    const buffer = await body.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    const blob = new Blob(chunks);
    return blob.text();
  }
  return null;
}

// Check which databases already exist on this browser
async function getExistingDatabases() {
  try {
    const list = await indexedDB.databases();
    const map = new Map();
    for (const entry of list || []) {
      if (entry.name) map.set(entry.name, entry.version);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function importIndexedDbFromS3(s3, config, onProgress) {
  if (!s3) throw new Error('Missing S3 client');
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error('Missing image bucket');
  const basePrefix = config?.imagePrefix?.trim() || '';

  const report = (detail) => {
    console.log(`[snapshot/import] ${detail}`);
    onProgress?.({ detail });
  };

  report('Downloading snapshot from S3...');
  const key = toS3Key(basePrefix, SNAPSHOT_KEY_SUFFIX);
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await readS3BodyAsText(response.Body);
  if (!text) throw new Error('Empty snapshot file');

  report(`Parsing snapshot (${(text.length / (1024 * 1024)).toFixed(1)} MB)...`);
  const snapshot = JSON.parse(text);
  if (snapshot.format !== 'canonry-indexeddb-snapshot') {
    throw new Error(`Unknown snapshot format: ${snapshot.format}`);
  }

  const existingDbs = await getExistingDatabases();
  const dbNames = Object.keys(snapshot.databases);
  console.log(`[snapshot/import] Snapshot from ${snapshot.exportedAt}, ${dbNames.length} databases: [${dbNames.join(', ')}]. Local: [${Array.from(existingDbs.keys()).join(', ')}]`);

  const warnings = [];
  let totalStoresRestored = 0;
  let totalRecordsWritten = 0;

  for (let i = 0; i < dbNames.length; i++) {
    const name = dbNames[i];
    const dbSnapshot = snapshot.databases[name];
    const snapshotStoreNames = Object.keys(dbSnapshot.stores);

    report(`Restoring ${name} v${dbSnapshot.version} (${i + 1}/${dbNames.length}) — ${snapshotStoreNames.length} stores [${snapshotStoreNames.join(', ')}]`);

    // Build schema map for store creation
    const storeSchemas = {};
    for (const [storeName, storeData] of Object.entries(dbSnapshot.stores)) {
      storeSchemas[storeName] = {
        keyPath: storeData.keyPath,
        autoIncrement: storeData.autoIncrement,
        indexes: storeData.indexes || [],
      };
    }

    let db;
    const localVersion = existingDbs.get(name);

    if (localVersion == null) {
      db = await createFreshDatabase(name, dbSnapshot.version, storeSchemas);
    } else {
      console.log(`[snapshot/import] "${name}" exists locally at v${localVersion}, merging`);
      try {
        db = await openDbForImport(name, dbSnapshot.version, storeSchemas);
      } catch (err) {
        const msg = `Failed to open "${name}" for import: ${err.message}`;
        console.error(`[snapshot/import] ${msg}`);
        warnings.push(msg);
        continue;
      }
    }

    const availableStores = new Set(db.objectStoreNames);

    // Clear existing data in stores we're about to populate
    for (const storeName of snapshotStoreNames) {
      if (!availableStores.has(storeName)) {
        const msg = `"${name}": store "${storeName}" in snapshot but not in local DB — skipped`;
        console.warn(`[snapshot/import] ${msg}`);
        warnings.push(msg);
        continue;
      }
      try {
        await clearStore(db, storeName);
      } catch (err) {
        console.warn(`[snapshot/import] Failed to clear "${storeName}" in "${name}":`, err.message);
      }
    }

    // Populate stores
    for (const [storeName, storeData] of Object.entries(dbSnapshot.stores)) {
      if (!availableStores.has(storeName)) continue;
      if (!storeData.records || storeData.records.length === 0) continue;
      const hasInlineKey = storeData.keyPath != null;
      try {
        const written = await writeRecordsToStore(db, storeName, storeData.records, hasInlineKey);
        totalRecordsWritten += written;
        totalStoresRestored++;
      } catch (err) {
        const msg = `"${name}": failed to write "${storeName}": ${err.message}`;
        console.error(`[snapshot/import] ${msg}`);
        warnings.push(msg);
      }
    }

    db.close();
    console.log(`[snapshot/import] "${name}" done`);
  }

  console.log(`[snapshot/import] Import complete: ${totalStoresRestored} stores, ${totalRecordsWritten} records`);
  if (warnings.length) {
    console.warn(`[snapshot/import] Warnings (${warnings.length}):`, warnings);
  }

  return {
    exportedAt: snapshot.exportedAt,
    dbCount: dbNames.length,
    storeCount: totalStoresRestored,
    recordCount: totalRecordsWritten,
    warnings,
  };
}
