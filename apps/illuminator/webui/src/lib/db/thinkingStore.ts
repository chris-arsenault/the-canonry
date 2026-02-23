/**
 * Thinking Store — Zustand store for LLM extended thinking visibility.
 *
 * Accumulates thinking deltas streamed from workers and exposes them
 * to the ThinkingViewer modal. Each entry is keyed by enrichment task ID.
 */

import { create } from 'zustand';

export interface ThinkingEntry {
  taskId: string;
  entityName: string;
  taskType: string;
  thinking: string;
  /** Accumulated text response from the LLM */
  text: string;
  isActive: boolean;
}

interface ThinkingStoreState {
  entries: Map<string, ThinkingEntry>;
  /** Task ID currently being viewed in the modal (null = modal closed) */
  viewingTaskId: string | null;

  startTask: (taskId: string, entityName: string, taskType: string) => void;
  appendDelta: (taskId: string, delta: string) => void;
  appendTextDelta: (taskId: string, delta: string) => void;
  finishTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
  clearAll: () => void;
  openViewer: (taskId: string) => void;
  closeViewer: () => void;
}

export const useThinkingStore = create<ThinkingStoreState>((set) => ({
  entries: new Map(),
  viewingTaskId: null,

  startTask: (taskId, entityName, taskType) => set((state) => {
    const entries = new Map(state.entries);
    entries.set(taskId, { taskId, entityName, taskType, thinking: '', text: '', isActive: true });
    return { entries };
  }),

  appendDelta: (taskId, delta) => set((state) => {
    const existing = state.entries.get(taskId);
    if (!existing) return state;
    const entries = new Map(state.entries);
    entries.set(taskId, { ...existing, thinking: existing.thinking + delta });
    return { entries };
  }),

  appendTextDelta: (taskId, delta) => set((state) => {
    const existing = state.entries.get(taskId);
    if (!existing) return state;
    const entries = new Map(state.entries);
    entries.set(taskId, { ...existing, text: existing.text + delta });
    return { entries };
  }),

  finishTask: (taskId) => set((state) => {
    const existing = state.entries.get(taskId);
    if (!existing) return state;
    const entries = new Map(state.entries);
    entries.set(taskId, { ...existing, isActive: false });
    return { entries };
  }),

  clearTask: (taskId) => set((state) => {
    const entries = new Map(state.entries);
    entries.delete(taskId);
    const viewingTaskId = state.viewingTaskId === taskId ? null : state.viewingTaskId;
    return { entries, viewingTaskId };
  }),

  clearAll: () => set({ entries: new Map(), viewingTaskId: null }),

  openViewer: (taskId) => set({ viewingTaskId: taskId }),
  closeViewer: () => set({ viewingTaskId: null }),
}));
