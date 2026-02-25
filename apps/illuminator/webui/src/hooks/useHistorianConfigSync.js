import { useState, useCallback, useEffect, useRef } from "react";
import { DEFAULT_HISTORIAN_CONFIG, isHistorianConfigured } from "../lib/historianTypes";

const LEGACY_HISTORIAN_CONFIG_KEY = "illuminator:historianConfig";

function readLegacyHistorianConfig() {
  try {
    const stored = localStorage.getItem(LEGACY_HISTORIAN_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignored */ }
  return null;
}

function resolveInitialHistorianConfig(externalConfig) {
  if (externalConfig) return externalConfig;
  const legacy = readLegacyHistorianConfig();
  return legacy || DEFAULT_HISTORIAN_CONFIG;
}

function resolveExternalChange(externalConfig, hasMigrated) {
  if (externalConfig) return { config: externalConfig, migrated: hasMigrated };
  if (!hasMigrated) {
    const legacy = readLegacyHistorianConfig();
    if (legacy && isHistorianConfigured(legacy)) {
      return { config: legacy, migrated: true };
    }
  }
  return { config: DEFAULT_HISTORIAN_CONFIG, migrated: hasMigrated };
}

export default function useHistorianConfigSync({ externalHistorianConfig, onHistorianConfigChange }) {
  const [localHistorianConfig, setLocalHistorianConfig] = useState(() =>
    resolveInitialHistorianConfig(externalHistorianConfig)
  );
  const [hasMigrated, setHasMigrated] = useState(false);
  const pendingHistorianConfigRef = useRef(localHistorianConfig);

  // Detect external changes during render (no ref access)
  const [prevExternal, setPrevExternal] = useState(externalHistorianConfig);
  if (externalHistorianConfig !== prevExternal) {
    setPrevExternal(externalHistorianConfig);
    if (externalHistorianConfig !== undefined) {
      const resolved = resolveExternalChange(externalHistorianConfig, hasMigrated);
      setLocalHistorianConfig(resolved.config);
      if (resolved.migrated !== hasMigrated) setHasMigrated(resolved.migrated);
    }
  }

  // Ref + side effects in effect (legacy migration, cleanup)
  useEffect(() => {
    if (externalHistorianConfig === undefined) return;
    const resolved = resolveExternalChange(externalHistorianConfig, hasMigrated);
    pendingHistorianConfigRef.current = resolved.config;
    if (resolved.migrated && !externalHistorianConfig) {
      if (onHistorianConfigChange) onHistorianConfigChange(resolved.config);
      try { localStorage.removeItem(LEGACY_HISTORIAN_CONFIG_KEY); } catch { /* ignored */ }
    }
  }, [externalHistorianConfig, onHistorianConfigChange, hasMigrated]);

  const historianConfigSyncTimeoutRef = useRef(null);
  const updateHistorianConfig = useCallback((next) => {
    setLocalHistorianConfig(next);
    pendingHistorianConfigRef.current = next;
    if (!onHistorianConfigChange) return;
    if (historianConfigSyncTimeoutRef.current) clearTimeout(historianConfigSyncTimeoutRef.current);
    historianConfigSyncTimeoutRef.current = setTimeout(() => {
      onHistorianConfigChange(pendingHistorianConfigRef.current);
      historianConfigSyncTimeoutRef.current = null;
    }, 300);
  }, [onHistorianConfigChange]);

  return { historianConfig: localHistorianConfig, updateHistorianConfig };
}
