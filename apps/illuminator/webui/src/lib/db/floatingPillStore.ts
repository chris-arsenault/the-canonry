/**
 * Floating Pill Store — Zustand store for minimized process modals.
 *
 * When a process modal (BulkToneRanking, BulkHistorian, etc.) is minimized,
 * it registers a pill here. The FloatingPills container renders pills in a
 * fixed position. Clicking a pill expands the modal again.
 */

import { create } from "zustand";

export interface FloatingPill {
  id: string;
  label: string;
  statusText: string;
  statusColor: string;
  /** Enrichment queue task ID — for linking to thinking viewer */
  taskId?: string;
  /** Tab to navigate to when expanding this pill */
  tabId?: string;
}

interface FloatingPillStoreState {
  pills: Map<string, FloatingPill>;

  minimize: (pill: FloatingPill) => void;
  expand: (id: string) => void;
  updatePill: (id: string, updates: Partial<Omit<FloatingPill, "id">>) => void;
  remove: (id: string) => void;
  isMinimized: (id: string) => boolean;
}

export const useFloatingPillStore = create<FloatingPillStoreState>((set, get) => ({
  pills: new Map(),

  minimize: (pill) =>
    set((state) => {
      const pills = new Map(state.pills);
      pills.set(pill.id, pill);
      return { pills };
    }),

  expand: (id) =>
    set((state) => {
      const pills = new Map(state.pills);
      pills.delete(id);
      return { pills };
    }),

  updatePill: (id, updates) =>
    set((state) => {
      const existing = state.pills.get(id);
      if (!existing) return state;
      const pills = new Map(state.pills);
      pills.set(id, { ...existing, ...updates });
      return { pills };
    }),

  remove: (id) =>
    set((state) => {
      const pills = new Map(state.pills);
      pills.delete(id);
      return { pills };
    }),

  isMinimized: (id) => get().pills.has(id),
}));
