/**
 * Zustand store for Canonry UI state
 *
 * Manages: active tab, per-tab section, showHome, helpModal, chronicler page requests.
 * Persists to localStorage via the existing uiState module.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { loadUiState, saveUiState } from "../storage/uiState";

const VALID_TABS = [
  "enumerist",
  "names",
  "cosmography",
  "coherence",
  "simulation",
  "illuminator",
  "archivist",
  "chronicler",
];

function normalizeUiState(raw) {
  const activeTab = VALID_TABS.includes(raw?.activeTab) ? raw.activeTab : null;
  const activeSectionByTab =
    raw?.activeSectionByTab && typeof raw.activeSectionByTab === "object"
      ? { ...raw.activeSectionByTab }
      : {};
  if (activeTab && typeof raw?.activeSection === "string") {
    activeSectionByTab[activeTab] = raw.activeSection;
  }
  const showHome = typeof raw?.showHome === "boolean" ? raw.showHome : !activeTab;
  return {
    activeTab,
    activeSectionByTab,
    showHome: activeTab ? showHome : true,
    helpModalOpen: !!raw?.helpModalOpen,
  };
}

const initial = normalizeUiState(loadUiState());

export const useCanonryUiStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    activeTab: initial.activeTab,
    activeSectionByTab: initial.activeSectionByTab,
    showHome: initial.showHome,
    helpModalOpen: initial.helpModalOpen,
    chroniclerRequestedPage: null,

    // Derived
    get activeSection() {
      const { activeTab, activeSectionByTab } = get();
      return activeTab ? (activeSectionByTab[activeTab] ?? null) : null;
    },

    // Actions
    setActiveTab: (tab) =>
      set({ activeTab: tab, showHome: false }),

    setActiveSection: (section) => {
      const { activeTab } = get();
      if (!activeTab) return;
      set((s) => ({
        activeSectionByTab: { ...s.activeSectionByTab, [activeTab]: section },
      }));
    },

    setActiveSectionForTab: (tabId, section) =>
      set((s) => ({
        activeSectionByTab: { ...s.activeSectionByTab, [tabId]: section },
      })),

    goHome: () => set({ showHome: true }),

    openHelpModal: () => set({ helpModalOpen: true }),
    closeHelpModal: () => set({ helpModalOpen: false }),

    setChroniclerRequestedPage: (pageId) =>
      set({ chroniclerRequestedPage: pageId }),
    clearChroniclerRequestedPage: () =>
      set({ chroniclerRequestedPage: null }),

    /** Handle cross-MFE navigation events */
    navigateTo: (tab, pageId) => {
      set({ activeTab: tab, showHome: false });
      if (tab === "chronicler" && pageId) {
        set({ chroniclerRequestedPage: pageId });
      }
    },
  }))
);

// Auto-persist to localStorage on relevant changes
useCanonryUiStore.subscribe(
  (s) => ({
    activeTab: s.activeTab,
    activeSectionByTab: s.activeSectionByTab,
    showHome: s.showHome,
    helpModalOpen: s.helpModalOpen,
  }),
  (slice) => {
    const activeSection = slice.activeTab
      ? (slice.activeSectionByTab[slice.activeTab] ?? null)
      : null;
    saveUiState({ ...slice, activeSection });
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
);

/** Selector for the computed activeSection */
export function selectActiveSection(s) {
  return s.activeTab ? (s.activeSectionByTab[s.activeTab] ?? null) : null;
}
