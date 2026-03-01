/**
 * useAppEffects - Lifecycle effects for the Canonry shell.
 *
 * Handles: Cognito token extraction, cross-MFE navigation, hash routing,
 * Illuminator world-data-changed events.
 */

import { useEffect } from "react";
import { useCanonryUiStore } from "../stores/useCanonryUiStore";
import { useCanonryAwsStore } from "../stores/useCanonryAwsStore";
import { extractCognitoTokensFromUrl, clearCognitoHash } from "../aws/cognitoAuth";
import { getUserPoolSession, sessionToTokens } from "../aws/cognitoUserAuth";
import { isTokenValid } from "../aws/awsConfigStorage";

interface UseAppEffectsParams {
  activeTab: string | null;
  handleTabChange: (tab: string) => void;
  awsConfig: Record<string, unknown>;
  awsTokens: unknown;
}

export function useAppEffects({
  activeTab,
  handleTabChange,
  awsConfig,
  awsTokens,
}: UseAppEffectsParams): void {
  const setAwsTokens = useCanonryAwsStore((s) => s.setTokens);
  const setAwsUserLabel = useCanonryAwsStore((s) => s.setUserLabel);

  // Extract Cognito tokens from URL hash on mount
  useEffect(() => {
    const tokens = extractCognitoTokensFromUrl();
    if (tokens) {
      setAwsTokens(tokens);
      clearCognitoHash();
    }
  }, [setAwsTokens]);

  // Try to restore Cognito session from user pool
  useEffect(() => {
    let canceled = false;
    const userPoolConfigured = Boolean(
      awsConfig?.cognitoUserPoolId && awsConfig?.cognitoClientId,
    );
    if (!userPoolConfigured || isTokenValid(awsTokens)) return;
    getUserPoolSession(awsConfig)
      .then((session: Record<string, unknown> | null) => {
        if (canceled || !session) return;
        const nextTokens = sessionToTokens(session);
        if (nextTokens) setAwsTokens(nextTokens);
        const payload = (
          session.getIdToken as () => { payload: Record<string, string> }
        )?.()?.payload;
        const username = payload?.["cognito:username"] || "";
        if (username) setAwsUserLabel(username);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [awsConfig, awsTokens, setAwsTokens, setAwsUserLabel]);

  // Cross-MFE navigation events
  useEffect(() => {
    const navigateTo = useCanonryUiStore.getState().navigateTo;
    const handleCrossNavigation = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { tab, pageId } = detail;
      if (tab) navigateTo(tab, pageId);
    };
    window.addEventListener("canonry:navigate", handleCrossNavigation);
    return () => window.removeEventListener("canonry:navigate", handleCrossNavigation);
  }, []);

  // Illuminator world data mutation events
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { simulationRunId } = detail;
      if (!simulationRunId) return;
      try {
        const [{ getEntitiesForRun }, { getNarrativeEventsForRun }] = await Promise.all([
          import("illuminator/entityRepository"),
          import("illuminator/eventRepository"),
        ]);
        await Promise.all([
          getEntitiesForRun(simulationRunId),
          getNarrativeEventsForRun(simulationRunId),
        ]);
      } catch (err) {
        console.warn("[Canonry] Failed to load Illuminator world data from Dexie:", err);
      }
    };
    window.addEventListener("illuminator:worlddata-changed", handler);
    return () => window.removeEventListener("illuminator:worlddata-changed", handler);
  }, []);

  // Hash-based tab routing (back button across MFEs)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/entity/") || hash === "#/entity") {
        if (activeTab !== "archivist") handleTabChange("archivist");
      } else if (hash.startsWith("#/page/") || hash === "#/page") {
        if (activeTab !== "chronicler") handleTabChange("chronicler");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab, handleTabChange]);
}
