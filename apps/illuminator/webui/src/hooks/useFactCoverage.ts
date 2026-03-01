/**
 * useFactCoverage — Bulk canon fact coverage analysis for chronicles
 *
 * Three-phase state machine following useBulkHistorian pattern:
 * 1. prepareFactCoverage() — build chronicle summary, load canon facts, enter 'confirming'
 * 2. User reviews list in BulkFactCoverageModal and clicks Confirm
 * 3. confirmFactCoverage() — process chronicles sequentially via enrichment queue
 *
 * For each chronicle: dispatch factCoverage task → poll chronicle record for results → next.
 */

import { useState, useCallback, useRef } from "react";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import { getChronicle } from "../lib/db/chronicleRepository";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import type { ChronicleNavItem } from "../lib/db/chronicleNav";

// ============================================================================
// Types
// ============================================================================

export interface FactCoverageChronicleSummary {
  chronicleId: string;
  title: string;
}

export interface FactCoverageProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  chronicles: FactCoverageChronicleSummary[];
  totalChronicles: number;
  processedChronicles: number;
  currentTitle: string;
  totalCost: number;
  error?: string;
  failedChronicles: Array<{ chronicleId: string; title: string; error: string }>;
}

export interface UseFactCoverageReturn {
  progress: FactCoverageProgress;
  isActive: boolean;
  prepareFactCoverage: (chronicleItems: ChronicleNavItem[]) => void;
  confirmFactCoverage: () => void;
  cancelFactCoverage: () => void;
  closeFactCoverage: () => void;
}

const IDLE_PROGRESS: FactCoverageProgress = {
  status: "idle",
  chronicles: [],
  totalChronicles: 0,
  processedChronicles: 0,
  currentTitle: "",
  totalCost: 0,
  failedChronicles: [],
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================================
// Hook
// ============================================================================

export function useFactCoverage(): UseFactCoverageReturn {
  const [progress, setProgress] = useState<FactCoverageProgress>(IDLE_PROGRESS);

  const activeRef = useRef(false);
  const cancelledRef = useRef(false);
  const scanRef = useRef<{
    chronicles: FactCoverageChronicleSummary[];
    facts: Array<{ id: string; text: string }>;
  } | null>(null);

  const isActive = progress.status === "running" || progress.status === "confirming";

  // Phase 1: Prepare
  const prepareFactCoverage = useCallback((chronicleItems: ChronicleNavItem[]) => {
    if (activeRef.current) return;

    // Filter to eligible chronicles (have content)
    const eligible = chronicleItems.filter(
      (c) => (c.status === "complete" || c.status === "assembly_ready") && c.wordCount > 0
    );

    const chronicles: FactCoverageChronicleSummary[] = eligible.map((c) => ({
      chronicleId: c.chronicleId,
      title: c.title || c.name,
    }));

    // Load canon facts from config store
    const worldContext = useIlluminatorConfigStore.getState().worldContext;
    const rawFacts = worldContext?.canonFactsWithMetadata ?? [];
    const facts = rawFacts
      .filter((f: Record<string, unknown>) => !f.disabled)
      .map((f: Record<string, unknown>) => ({
        id: (f.id as string) || (typeof f.text === 'string' ? f.text : "").slice(0, 20),
        text: f.text as string,
      }));

    if (facts.length === 0) {
      setProgress({
        ...IDLE_PROGRESS,
        status: "failed",
        error: "No canon facts configured",
      });
      return;
    }

    scanRef.current = { chronicles, facts };

    setProgress({
      ...IDLE_PROGRESS,
      status: "confirming",
      chronicles,
      totalChronicles: chronicles.length,
    });
  }, []);

  // Phase 2: Confirm and run
  const confirmFactCoverage = useCallback(() => {
    const scan = scanRef.current;
    if (!scan || activeRef.current) return;

    activeRef.current = true;
    cancelledRef.current = false;

    setProgress((p) => ({ ...p, status: "running" }));

    void (async () => {
      try {
        const { chronicles, facts } = scan;
        let globalProcessed = 0;
        let globalCost = 0;
        const failedChronicles: Array<{ chronicleId: string; title: string; error: string }> = [];

        for (let i = 0; i < chronicles.length; i++) {
          if (cancelledRef.current) break;

          const chron = chronicles[i];

          setProgress((p) => ({
            ...p,
            currentTitle: chron.title,
          }));

          try {
            // Load full chronicle record
            const record = await getChronicle(chron.chronicleId);
            const narrativeText = record?.assembledContent || record?.finalContent;

            if (!narrativeText) {
              globalProcessed++;
              setProgress((p) => ({ ...p, processedChronicles: globalProcessed }));
              continue;
            }

            // Build payload
            const payload = {
              chronicleId: chron.chronicleId,
              narrativeText,
              facts,
            };

            // Create synthetic entity for queue dispatch (same pattern as temporal check)
            const primaryRole =
              record?.roleAssignments?.find((r) => r.isPrimary) || record?.roleAssignments?.[0];
            const syntheticEntity = {
              id: primaryRole?.entityId || chron.chronicleId,
              name: primaryRole?.entityName || chron.title,
              kind: primaryRole?.entityKind || "chronicle",
              subtype: "",
              prominence: "recognized",
              culture: "",
              status: "active",
              description: "",
              tags: {},
            };

            // Clear any previous report timestamp so we can detect the new one
            const prevTimestamp = record?.factCoverageReportGeneratedAt ?? 0;

            // Dispatch
            getEnqueue()([
              {
                entity: syntheticEntity as never,
                type: "factCoverage" as const,
                prompt: JSON.stringify(payload),
                chronicleId: chron.chronicleId,
              },
            ]);

            // Poll for completion
            let result: { cost: number } | null = null;
            while (!cancelledRef.current) {
              await sleep(1500);
              if (cancelledRef.current) break;

              const updated = await getChronicle(chron.chronicleId);
              if (
                updated?.factCoverageReportGeneratedAt &&
                updated.factCoverageReportGeneratedAt > prevTimestamp
              ) {
                result = { cost: updated.factCoverageReport?.actualCost ?? 0 };
                break;
              }
            }

            if (cancelledRef.current || !result) break;
            globalCost += result.cost;
          } catch (err) {
            console.error(`[Fact Coverage] Chronicle "${chron.title}" failed:`, err);
            failedChronicles.push({
              chronicleId: chron.chronicleId,
              title: chron.title,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          globalProcessed++;
          setProgress((p) => ({
            ...p,
            processedChronicles: globalProcessed,
            totalCost: globalCost,
            failedChronicles: [...failedChronicles],
          }));
        }

        if (cancelledRef.current) {
          setProgress((p) => ({ ...p, status: "cancelled", currentTitle: "" }));
        } else {
          setProgress((p) => ({ ...p, status: "complete", currentTitle: "" }));
        }
      } catch (err) {
        console.error("[Fact Coverage] Fatal error:", err);
        setProgress((p) => ({
          ...p,
          status: "failed",
          currentTitle: "",
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        activeRef.current = false;
        scanRef.current = null;
      }
    })();
  }, []);

  // Cancel
  const cancelFactCoverage = useCallback(() => {
    cancelledRef.current = true;
    scanRef.current = null;
    setProgress((p) => {
      if (p.status === "confirming") return IDLE_PROGRESS;
      return p; // running → let the loop handle it
    });
  }, []);

  // Close (reset from terminal state)
  const closeFactCoverage = useCallback(() => {
    setProgress(IDLE_PROGRESS);
  }, []);

  return {
    progress,
    isActive,
    prepareFactCoverage,
    confirmFactCoverage,
    cancelFactCoverage,
    closeFactCoverage,
  };
}
