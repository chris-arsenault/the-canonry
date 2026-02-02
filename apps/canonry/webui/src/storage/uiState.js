const UI_STATE_KEY = 'canonry:uiState';
const LAST_PROJECT_KEY = 'canonry:lastProjectId';

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

export function loadUiState() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUiState(state) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort only.
  }
}

export function loadLastProjectId() {
  if (!canUseStorage()) return null;
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function saveLastProjectId(projectId) {
  if (!canUseStorage()) return;
  try {
    if (projectId) {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  } catch {
    // Best-effort only.
  }
}
