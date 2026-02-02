/**
 * Unified World Store
 *
 * Shared IndexedDB persistence for world data across Lore Weave, Illuminator, and Archivist.
 *
 * Stores per-project:
 * - activeSlotIndex: Currently active slot (0=scratch, 1-4=saved)
 * - worldContext: Illuminator's world context (name, description, canon facts, tone)
 * - enrichmentConfig: Illuminator's saved settings (shared across slots)
 *
 * Run slots are persisted in a separate IndexedDB store (canonry-runs).
 */

import {
  getRunSlots,
  getRunSlot,
  saveRunSlot,
  deleteRunSlot,
  deleteRunSlotsForProject
} from './runStore.js';

const DB_NAME = 'canonry-world';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const LOCAL_PREFIX = 'canonry:world:';

const MAX_SAVE_SLOTS = 4; // Slots 1-4

let dbPromise = null;

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

async function idbSet(projectId, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    tx.objectStore(STORE_NAME).put({ projectId, ...data, savedAt: Date.now() });
  });
}

async function idbGet(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(projectId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IDB read failed'));
  });
}

async function idbDelete(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    tx.objectStore(STORE_NAME).delete(projectId);
  });
}

function lsKey(projectId) {
  return `${LOCAL_PREFIX}${projectId}`;
}

function lsSet(projectId, data) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(lsKey(projectId), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
}

function lsGet(projectId) {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(lsKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lsDelete(projectId) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(lsKey(projectId));
  } catch {
    // Best-effort only.
  }
}

function normalizeWorldStore(record) {
  if (!record) return null;
  return {
    ...record,
    activeSlotIndex: typeof record.activeSlotIndex === 'number' ? record.activeSlotIndex : 0
  };
}

// =============================================================================
// Public API - Core Store Operations
// =============================================================================

/**
 * Load all persisted data for a project
 */
export async function loadWorldStore(projectId) {
  if (!projectId) return null;
  let record = null;
  try {
    record = await idbGet(projectId);
  } catch {
    // Fall back to localStorage
    record = lsGet(projectId);
  }
  if (!record) record = lsGet(projectId);
  return normalizeWorldStore(record);
}

/**
 * Save all data for a project (merges with existing)
 */
export async function saveWorldStore(projectId, data) {
  if (!projectId) return;
  let existing = null;
  try {
    existing = await idbGet(projectId);
  } catch {
    existing = null;
  }

  const merged = { ...(normalizeWorldStore(existing) || { activeSlotIndex: 0 }), ...data };
  delete merged.projectId;
  delete merged.slots;

  try {
    await idbSet(projectId, merged);
  } catch {
    const localExisting = normalizeWorldStore(lsGet(projectId)) || { activeSlotIndex: 0 };
    const localMerged = { ...localExisting, ...data };
    delete localMerged.slots;
    lsSet(projectId, localMerged);
  }
}

/**
 * Clear all persisted data for a project
 */
export async function clearWorldStore(projectId) {
  if (!projectId) return;
  try {
    await idbDelete(projectId);
  } catch {
    // Ignore
  }
  lsDelete(projectId);
  await deleteRunSlotsForProject(projectId);
}

// =============================================================================
// Slot Operations
// =============================================================================

/**
 * Get the active slot index for a project
 */
export async function getActiveSlotIndex(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.activeSlotIndex ?? 0;
}

/**
 * Set the active slot index for a project
 */
export async function setActiveSlotIndex(projectId, slotIndex) {
  await saveWorldStore(projectId, { activeSlotIndex: slotIndex });
}

/**
 * Get all slots for a project
 */
export async function getSlots(projectId) {
  await loadWorldStore(projectId);
  return getRunSlots(projectId);
}

/**
 * Get data for a specific slot
 */
export async function getSlot(projectId, slotIndex) {
  await loadWorldStore(projectId);
  return getRunSlot(projectId, slotIndex);
}

/**
 * Get data for the currently active slot
 */
export async function getActiveSlot(projectId) {
  const activeIndex = await getActiveSlotIndex(projectId);
  return getSlot(projectId, activeIndex);
}

/**
 * Save data to a specific slot
 */
export async function saveSlot(projectId, slotIndex, slotData) {
  await saveRunSlot(projectId, slotIndex, slotData);
}

/**
 * Save data to the currently active slot (merges with existing slot data)
 */
export async function saveToActiveSlot(projectId, slotData) {
  const activeIndex = await getActiveSlotIndex(projectId);
  const existingSlot = await getSlot(projectId, activeIndex) || {};
  const updatedSlot = { ...existingSlot, ...slotData };
  await saveRunSlot(projectId, activeIndex, updatedSlot);
}

/**
 * Move data from scratch (slot 0) to a save slot (1-4)
 * Clears scratch and switches active to the target slot
 */
export async function saveToSlot(projectId, targetSlotIndex) {
  if (targetSlotIndex < 1 || targetSlotIndex > MAX_SAVE_SLOTS) {
    throw new Error(`Invalid save slot: ${targetSlotIndex}. Must be 1-${MAX_SAVE_SLOTS}`);
  }

  const scratchData = await getSlot(projectId, 0);

  if (!scratchData || !scratchData.simulationResults) {
    throw new Error('No data in scratch slot to save');
  }

  // Generate title if not present
  const title = scratchData.title && scratchData.title !== 'Scratch'
    ? scratchData.title
    : generateSlotTitle(targetSlotIndex);

  // Move data to target slot
  await saveRunSlot(projectId, targetSlotIndex, { ...scratchData, title, savedAt: Date.now() });
  await deleteRunSlot(projectId, 0);
  await saveWorldStore(projectId, { activeSlotIndex: targetSlotIndex });

  return targetSlotIndex;
}

/**
 * Load a saved slot by switching active index
 */
export async function loadSlot(projectId, slotIndex) {
  const slot = await getSlot(projectId, slotIndex);
  if (!slot) {
    throw new Error(`Slot ${slotIndex} is empty`);
  }
  await saveWorldStore(projectId, { activeSlotIndex: slotIndex });
  return slotIndex;
}

/**
 * Clear a specific slot
 */
export async function clearSlot(projectId, slotIndex) {
  const store = await loadWorldStore(projectId) || { activeSlotIndex: 0 };
  await deleteRunSlot(projectId, slotIndex);

  const slots = await getSlots(projectId);

  // Determine new active slot index
  let newActiveSlotIndex = store.activeSlotIndex ?? 0;
  if (newActiveSlotIndex === slotIndex) {
    // If clearing the active slot:
    // - If it's slot 0 (scratch), stay on 0 (scratch is conceptually always available)
    // - Otherwise, switch to scratch (0) or first available slot
    if (slotIndex === 0) {
      newActiveSlotIndex = 0;
    } else {
      // Find first available slot (prefer scratch if it exists, otherwise first saved slot)
      const availableSlots = Object.keys(slots).map(Number).sort((a, b) => a - b);
      newActiveSlotIndex = availableSlots.length > 0 ? availableSlots[0] : 0;
    }
  }

  await saveWorldStore(projectId, { activeSlotIndex: newActiveSlotIndex });
}

/**
 * Update the title of a slot
 */
export async function updateSlotTitle(projectId, slotIndex, title) {
  const slot = await getSlot(projectId, slotIndex);
  if (!slot) {
    throw new Error(`Slot ${slotIndex} does not exist`);
  }
  await saveRunSlot(projectId, slotIndex, { ...slot, title });
}

/**
 * Get the next available save slot (1-4), or null if all full
 */
export async function getNextAvailableSlot(projectId) {
  const slots = await getSlots(projectId);
  for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
    if (!slots[i]) return i;
  }
  return null;
}

/**
 * Generate a default title for a slot
 */
export function generateSlotTitle(slotIndex, timestamp = Date.now()) {
  const date = new Date(timestamp);
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Run ${slotIndex} - ${formatted}`;
}

// =============================================================================
// Convenience methods - operate on active slot
// =============================================================================

/**
 * Save simulation run data to the active slot
 */
export async function saveSimulationData(projectId, { simulationResults, simulationState }) {
  // Always write new simulations to scratch (slot 0)
  const existingSlot = await getSlot(projectId, 0) || {};
  const updatedSlot = { ...existingSlot, simulationResults, simulationState };
  await saveRunSlot(projectId, 0, updatedSlot);
  await saveWorldStore(projectId, { activeSlotIndex: 0 });
}

/**
 * Load simulation run data from the active slot
 */
export async function loadSimulationData(projectId) {
  const slot = await getActiveSlot(projectId);
  return {
    simulationResults: slot?.simulationResults || null,
    simulationState: slot?.simulationState || null,
  };
}

/**
 * Save world data to the active slot
 */
export async function saveWorldData(projectId, worldData) {
  await saveToActiveSlot(projectId, { worldData });
}

/**
 * Load world data from the active slot
 */
export async function loadWorldData(projectId) {
  const slot = await getActiveSlot(projectId);
  return slot?.worldData || null;
}

/**
 * Save Illuminator world context (shared across slots)
 */
export async function saveWorldContext(projectId, worldContext) {
  await saveWorldStore(projectId, { worldContext });
}

/**
 * Load Illuminator world context
 */
export async function loadWorldContext(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.worldContext || null;
}

/**
 * Save Illuminator enrichment config (shared across slots)
 */
export async function saveEnrichmentConfig(projectId, enrichmentConfig) {
  await saveWorldStore(projectId, { enrichmentConfig });
}

/**
 * Load Illuminator enrichment config
 */
export async function loadEnrichmentConfig(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.enrichmentConfig || null;
}

/**
 * Save entity guidance (shared across slots)
 */
export async function saveEntityGuidance(projectId, entityGuidance) {
  await saveWorldStore(projectId, { entityGuidance });
}

/**
 * Save culture identities (shared across slots)
 */
export async function saveCultureIdentities(projectId, cultureIdentities) {
  await saveWorldStore(projectId, { cultureIdentities });
}

/**
 * Save Illuminator style selection (shared across slots)
 */
export async function saveStyleSelection(projectId, styleSelection) {
  await saveWorldStore(projectId, { styleSelection });
}

/**
 * Load Illuminator style selection
 */
export async function loadStyleSelection(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.styleSelection || null;
}

