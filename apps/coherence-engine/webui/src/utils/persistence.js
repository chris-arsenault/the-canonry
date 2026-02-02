const STORAGE_PREFIX = 'coherence:ui:';

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

export function buildStorageKey(projectId, suffix) {
  if (!projectId) return null;
  return `${STORAGE_PREFIX}${projectId}:${suffix}`;
}

export function loadStoredValue(key) {
  if (!key || !canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredValue(key, value) {
  if (!key || !canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

export function clearStoredValue(key) {
  if (!key || !canUseStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Best-effort only.
  }
}
