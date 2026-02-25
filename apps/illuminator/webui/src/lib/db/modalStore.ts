/**
 * useIlluminatorModals — Zustand store for modal open/close state.
 *
 * Moves modal-opening triggers out of prop threading. Components call
 * store actions directly (e.g. `useIlluminatorModals.getState().openRename(id)`)
 * instead of receiving `onRename`, `onCreateEntity`, etc. as props.
 *
 * The modal *rendering* and *apply* callbacks stay in IlluminatorRemote —
 * only the "open" triggers and state are centralized here.
 */

import { create } from "zustand";
import { useEntityStore } from "./entityStore";

interface RenameModalState {
  entityId: string;
  mode: "rename" | "patch";
}

interface EraNarrativeModalState {
  narrativeId?: string;
}

interface IlluminatorModalsState {
  // State
  renameModal: RenameModalState | null;
  createEntityModal: boolean;
  editEntityModal: unknown | null; // PersistedEntity | null
  imageSettingsOpen: boolean;
  eraNarrativeModal: EraNarrativeModalState | null;

  // Open actions — called by child components
  openRename: (entityId: string) => void;
  openPatchEvents: (entityId: string) => void;
  openCreateEntity: () => void;
  openEditEntity: (entity: unknown) => void;
  openImageSettings: () => void;
  openEraNarrative: () => void;
  openEraNarrativeResume: (narrativeId: string) => void;

  // Close actions — called by IlluminatorRemote after apply
  closeRename: () => void;
  closeCreateEntity: () => void;
  closeEditEntity: () => void;
  closeImageSettings: () => void;
  closeEraNarrative: () => void;

  // Update actions
  setEraNarrativeId: (narrativeId: string) => void;
}

export const useIlluminatorModals = create<IlluminatorModalsState>((set) => ({
  renameModal: null,
  createEntityModal: false,
  editEntityModal: null,
  imageSettingsOpen: false,
  eraNarrativeModal: null,

  openRename: (entityId) => set({ renameModal: { entityId, mode: "rename" } }),
  openPatchEvents: (entityId) => set({ renameModal: { entityId, mode: "patch" } }),
  openCreateEntity: () => {
    // Guard: only open if a simulation is loaded
    if (!useEntityStore.getState().simulationRunId) return;
    set({ createEntityModal: true });
  },
  openEditEntity: (entity) => {
    if (!useEntityStore.getState().simulationRunId) return;
    set({ editEntityModal: entity });
  },
  openImageSettings: () => set({ imageSettingsOpen: true }),
  openEraNarrative: () => set({ eraNarrativeModal: {} }),
  openEraNarrativeResume: (narrativeId) => set({ eraNarrativeModal: { narrativeId } }),

  closeRename: () => set({ renameModal: null }),
  closeCreateEntity: () => set({ createEntityModal: false }),
  closeEditEntity: () => set({ editEntityModal: null }),
  closeImageSettings: () => set({ imageSettingsOpen: false }),
  closeEraNarrative: () => set({ eraNarrativeModal: null }),

  setEraNarrativeId: (narrativeId) =>
    set((state) => ({
      eraNarrativeModal: state.eraNarrativeModal
        ? { ...state.eraNarrativeModal, narrativeId }
        : null,
    })),
}));
