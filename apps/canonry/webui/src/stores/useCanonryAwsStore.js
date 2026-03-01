/**
 * Zustand store for Canonry AWS/Cognito state
 *
 * Manages: awsConfig, awsTokens, awsStatus, awsBrowseState,
 * credentials, sync progress, upload plan, snapshot status.
 * Persists config/tokens to localStorage via awsConfigStorage.
 */

import { create } from "zustand";
import {
  loadAwsConfig,
  saveAwsConfig,
  loadAwsTokens,
  saveAwsTokens,
  clearAwsTokens,
} from "../aws/awsConfigStorage";

const DEFAULT_AWS_CONFIG = {
  region: "",
  identityPoolId: "",
  cognitoUserPoolId: "",
  cognitoClientId: "",
  imageBucket: "",
  imagePrefix: "",
  useS3Images: false,
};

export const useCanonryAwsStore = create((set, get) => ({
  // Modal state
  modalOpen: false,

  // Config (persisted)
  config: loadAwsConfig() || { ...DEFAULT_AWS_CONFIG },

  // Auth tokens (persisted)
  tokens: loadAwsTokens(),

  // Status
  status: { state: "idle", detail: "" },

  // Browse state (S3 prefix listing)
  browseState: { loading: false, prefixes: [], error: null },

  // Cognito user credentials (form fields, not persisted)
  username: "",
  password: "",
  userLabel: "",

  // Sync progress
  syncProgress: { phase: "idle", processed: 0, total: 0, uploaded: 0 },

  // Upload plan
  uploadPlan: { loading: false, error: null, summary: null, json: "" },

  // Snapshot status
  snapshotStatus: { state: "idle", detail: "" },

  // Actions
  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),

  updateConfig: (patch) => {
    const next = { ...get().config, ...patch };
    saveAwsConfig(next);
    set({ config: next });
  },

  setTokens: (tokens) => {
    if (tokens) {
      saveAwsTokens(tokens);
    } else {
      clearAwsTokens();
    }
    set({ tokens });
  },

  setStatus: (status) => set({ status }),
  setBrowseState: (browseState) => set({ browseState }),
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setUserLabel: (userLabel) => set({ userLabel }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
  setUploadPlan: (uploadPlan) => set({ uploadPlan }),
  setSnapshotStatus: (snapshotStatus) => set({ snapshotStatus }),

  /** Reset all transient state (on modal close or project switch) */
  resetTransient: () =>
    set({
      status: { state: "idle", detail: "" },
      browseState: { loading: false, prefixes: [], error: null },
      syncProgress: { phase: "idle", processed: 0, total: 0, uploaded: 0 },
      uploadPlan: { loading: false, error: null, summary: null, json: "" },
      snapshotStatus: { state: "idle", detail: "" },
    }),
}));
